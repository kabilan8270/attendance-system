import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query } from '../config/db';

type ReportRow = {
  employee_code: string;
  full_name: string;
  department_name: string | null;
  attendance_date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  working_hours: string | null;
};

// ============================================================
// Shared query builder for attendance-based reports
// ============================================================
const fetchAttendanceReportRows = async (params: {
  from?: string;
  to?: string;
  departmentId?: string;
  employeeId?: string;
  statusFilter?: string; // e.g. restrict to 'late' for the Late Report
}): Promise<ReportRow[]> => {
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let idx = 1;

  if (params.from && params.to) {
    conditions.push(`a.attendance_date BETWEEN $${idx} AND $${idx + 1}`);
    values.push(params.from, params.to);
    idx += 2;
  }
  if (params.departmentId) {
    conditions.push(`e.department_id = $${idx}`);
    values.push(params.departmentId);
    idx += 1;
  }
  if (params.employeeId) {
    conditions.push(`e.id = $${idx}`);
    values.push(params.employeeId);
    idx += 1;
  }
  if (params.statusFilter) {
    conditions.push(`a.status = $${idx}`);
    values.push(params.statusFilter);
    idx += 1;
  }

  const result = await query(
    `SELECT e.employee_id AS employee_code, e.full_name, d.name AS department_name,
            a.attendance_date, a.status, a.check_in_time, a.check_out_time, a.working_hours
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.attendance_date ASC, e.full_name ASC`,
    values
  );

  return result.rows;
};

// ============================================================
// EXCEL EXPORT (shared helper)
// ============================================================
const buildExcelWorkbook = async (title: string, rows: ReportRow[]): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.substring(0, 30));

  sheet.columns = [
    { header: 'Employee ID', key: 'employee_code', width: 15 },
    { header: 'Name', key: 'full_name', width: 25 },
    { header: 'Department', key: 'department_name', width: 20 },
    { header: 'Date', key: 'attendance_date', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Check In', key: 'check_in_time', width: 20 },
    { header: 'Check Out', key: 'check_out_time', width: 20 },
    { header: 'Working Hours', key: 'working_hours', width: 15 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  rows.forEach((row) => {
    sheet.addRow({
      employee_code: row.employee_code,
      full_name: row.full_name,
      department_name: row.department_name || '-',
      attendance_date: row.attendance_date,
      status: row.status,
      check_in_time: row.check_in_time ? new Date(row.check_in_time).toLocaleString() : '-',
      check_out_time: row.check_out_time ? new Date(row.check_out_time).toLocaleString() : '-',
      working_hours: row.working_hours || '-',
    });
  });

  return workbook;
};

// ============================================================
// PDF EXPORT (shared helper)
// ============================================================
const buildPdfDocument = (title: string, rows: ReportRow[], res: Response) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#555').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  const colWidths = [70, 110, 90, 70, 65, 110, 110, 70];
  const headers = ['Emp ID', 'Name', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Hours'];
  let y = doc.y;
  const startX = 40;

  const drawRow = (values: string[], isHeader = false) => {
    let x = startX;
    doc.fontSize(8).fillColor(isHeader ? '#000' : '#222').font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    values.forEach((val, i) => {
      doc.text(val, x, y, { width: colWidths[i], ellipsis: true });
      x += colWidths[i];
    });
    y += 18;
  };

  drawRow(headers, true);
  doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();

  rows.forEach((row) => {
    if (y > 520) {
      doc.addPage();
      y = 40;
      drawRow(headers, true);
      doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();
    }
    drawRow([
      row.employee_code,
      row.full_name,
      row.department_name || '-',
      row.attendance_date,
      row.status,
      row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString() : '-',
      row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString() : '-',
      row.working_hours || '-',
    ]);
  });

  doc.end();
};

// ============================================================
// GENERIC REPORT ENDPOINT
// GET /api/reports/attendance?type=daily|weekly|monthly|yearly|department|employee|late&format=json|pdf|excel
// ============================================================
export const generateAttendanceReport = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const {
    type = 'daily',
    format = 'json',
    from,
    to,
    departmentId,
    employeeId,
  } = req.query as Record<string, string>;

  let dateFrom = from;
  let dateTo = to;
  const today = new Date();

  if (!dateFrom || !dateTo) {
    if (type === 'daily') {
      dateFrom = dateTo = today.toISOString().split('T')[0];
    } else if (type === 'weekly') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      dateFrom = weekAgo.toISOString().split('T')[0];
      dateTo = today.toISOString().split('T')[0];
    } else if (type === 'monthly') {
      dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      dateTo = today.toISOString().split('T')[0];
    } else if (type === 'yearly') {
      dateFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      dateTo = today.toISOString().split('T')[0];
    }
  }

  const statusFilter = type === 'late' ? 'late' : undefined;

  const rows = await fetchAttendanceReportRows({
    from: dateFrom,
    to: dateTo,
    departmentId,
    employeeId,
    statusFilter,
  });

  const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Attendance Report`;

  if (format === 'excel') {
    const workbook = await buildExcelWorkbook(title, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (format === 'pdf') {
    return buildPdfDocument(title, rows, res);
  }

  return res.json({ success: true, data: rows, meta: { type, from: dateFrom, to: dateTo } });
};

// ============================================================
// LEAVE REPORT
// ============================================================
export const generateLeaveReport = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { from, to, status, format = 'json' } = req.query as Record<string, string>;

  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let idx = 1;
  if (from && to) {
    conditions.push(`lr.start_date <= $${idx + 1} AND lr.end_date >= $${idx}`);
    values.push(from, to);
    idx += 2;
  }
  if (status) {
    conditions.push(`lr.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  const result = await query(
    `SELECT e.employee_id AS employee_code, e.full_name, d.name AS department_name,
            lr.leave_type, lr.start_date, lr.end_date, lr.status, lr.reason
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY lr.start_date DESC`,
    values
  );

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leave Report');
    sheet.columns = [
      { header: 'Employee ID', key: 'employee_code', width: 15 },
      { header: 'Name', key: 'full_name', width: 25 },
      { header: 'Department', key: 'department_name', width: 20 },
      { header: 'Leave Type', key: 'leave_type', width: 15 },
      { header: 'Start Date', key: 'start_date', width: 14 },
      { header: 'End Date', key: 'end_date', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Reason', key: 'reason', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    result.rows.forEach((r) => sheet.addRow(r));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Leave_Report.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }

  return res.json({ success: true, data: result.rows });
};

// ============================================================
// ATTENDANCE SUMMARY REPORT (per-employee aggregate counts over a period)
// ============================================================
export const generateAttendanceSummary = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { from, to, format = 'json' } = req.query as Record<string, string>;

  if (!from || !to) {
    return res.status(400).json({ success: false, message: 'from and to query params are required' });
  }

  const result = await query(
    `SELECT e.employee_id AS employee_code, e.full_name, d.name AS department_name,
            COUNT(*) FILTER (WHERE a.status = 'present')::int AS present_days,
            COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent_days,
            COUNT(*) FILTER (WHERE a.status = 'late')::int AS late_days,
            COUNT(*) FILTER (WHERE a.status = 'half_day')::int AS half_days,
            COUNT(*) FILTER (WHERE a.status = 'leave')::int AS leave_days,
            COALESCE(SUM(a.working_hours), 0) AS total_hours
     FROM employees e
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date BETWEEN $1 AND $2
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.status = 'active'
     GROUP BY e.id, e.employee_id, e.full_name, d.name
     ORDER BY e.full_name ASC`,
    [from, to]
  );

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance Summary');
    sheet.columns = [
      { header: 'Employee ID', key: 'employee_code', width: 15 },
      { header: 'Name', key: 'full_name', width: 25 },
      { header: 'Department', key: 'department_name', width: 20 },
      { header: 'Present', key: 'present_days', width: 10 },
      { header: 'Absent', key: 'absent_days', width: 10 },
      { header: 'Late', key: 'late_days', width: 10 },
      { header: 'Half Day', key: 'half_days', width: 10 },
      { header: 'Leave', key: 'leave_days', width: 10 },
      { header: 'Total Hours', key: 'total_hours', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };
    result.rows.forEach((r) => sheet.addRow(r));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Summary.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }

  return res.json({ success: true, data: result.rows });
};

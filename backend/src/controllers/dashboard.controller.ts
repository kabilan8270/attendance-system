import { Request, Response } from 'express';
import { query } from '../config/db';

// ============================================================
// ADMIN DASHBOARD: SUMMARY CARDS (today's snapshot)
// ============================================================
export const getDashboardSummary = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const today = new Date().toISOString().split('T')[0];

  const [totalEmployees, todayStats, pendingLeaves] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM employees WHERE status = 'active'`),
    query(
      `SELECT status, COUNT(*)::int AS count FROM attendance WHERE attendance_date = $1 GROUP BY status`,
      [today]
    ),
    query(`SELECT COUNT(*)::int AS count FROM leave_requests WHERE status = 'pending'`),
  ]);

  const statusCounts: Record<string, number> = {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
    work_from_home: 0,
  };
  todayStats.rows.forEach((row) => {
    statusCounts[row.status] = row.count;
  });

  const totalActive = totalEmployees.rows[0].count;
  const markedToday = todayStats.rows.reduce((sum, r) => sum + r.count, 0);
  statusCounts.absent = Math.max(0, totalActive - markedToday);

  return res.json({
    success: true,
    data: {
      totalEmployees: totalActive,
      present: statusCounts.present,
      absent: statusCounts.absent,
      late: statusCounts.late,
      leave: statusCounts.leave,
      halfDay: statusCounts.half_day,
      workFromHome: statusCounts.work_from_home,
      pendingLeaveRequests: pendingLeaves.rows[0].count,
    },
  });
};

// ============================================================
// ADMIN DASHBOARD: ATTENDANCE TREND (last N days, daily present/absent/late counts)
// ============================================================
export const getAttendanceTrend = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const days = Math.min(parseInt((req.query.days as string) || '30', 10), 365);

  const result = await query(
    `SELECT attendance_date,
            COUNT(*) FILTER (WHERE status = 'present')::int AS present,
            COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'late')::int AS late,
            COUNT(*) FILTER (WHERE status = 'leave')::int AS leave,
            COUNT(*) FILTER (WHERE status = 'work_from_home')::int AS wfh
     FROM attendance
     WHERE attendance_date >= CURRENT_DATE - $1::int
     GROUP BY attendance_date
     ORDER BY attendance_date ASC`,
    [days]
  );

  return res.json({ success: true, data: result.rows });
};

// ============================================================
// ADMIN DASHBOARD: DEPARTMENT-WISE ATTENDANCE (today)
// ============================================================
export const getDepartmentAttendance = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const today = new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT d.name AS department_name,
            COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
            COUNT(a.id) FILTER (WHERE a.status = 'absent')::int AS absent,
            COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late,
            COUNT(e.id)::int AS total_employees
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = $1
     GROUP BY d.id, d.name
     ORDER BY d.name ASC`,
    [today]
  );

  return res.json({ success: true, data: result.rows });
};

// ============================================================
// ADMIN DASHBOARD: WEEKLY / MONTHLY ATTENDANCE OVERVIEW
// ============================================================
export const getPeriodAttendance = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { period = 'weekly' } = req.query as Record<string, string>;
  const interval = period === 'monthly' ? '30 days' : '7 days';

  const result = await query(
    `SELECT attendance_date,
            COUNT(*) FILTER (WHERE status IN ('present','late'))::int AS attended,
            COUNT(*) FILTER (WHERE status = 'absent')::int AS absent
     FROM attendance
     WHERE attendance_date >= CURRENT_DATE - $1::interval
     GROUP BY attendance_date
     ORDER BY attendance_date ASC`,
    [interval]
  );

  return res.json({ success: true, data: result.rows });
};

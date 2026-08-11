import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/db';
import { supabase, STORAGE_BUCKET } from '../config/supabase';
import { logAudit } from '../services/audit.service';

const SALT_ROUNDS = 12;
const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

const generateTempPassword = (): string => crypto.randomBytes(6).toString('hex');

// ============================================================
// CREATE EMPLOYEE (Admin only)
// ============================================================
export const createEmployee = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const {
    employeeId,
    fullName,
    email,
    mobileNumber,
    departmentId,
    designation,
    joiningDate,
    shiftId,
  } = req.body;

  if (!employeeId || !fullName || !email || !mobileNumber || !joiningDate) {
    return res.status(400).json({
      success: false,
      message: 'employeeId, fullName, email, mobileNumber and joiningDate are required',
    });
  }

  const existing = await query(
    `SELECT id FROM employees WHERE employee_id = $1 OR email = $2`,
    [employeeId, email]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ success: false, message: 'Employee ID or email already exists' });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO employees
      (employee_id, full_name, email, mobile_number, password_hash, department_id, designation, joining_date, shift_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, employee_id, full_name, email, mobile_number, department_id, designation, joining_date, shift_id, status, created_at`,
    [employeeId, fullName, email, mobileNumber, passwordHash, departmentId || null, designation || null, joiningDate, shiftId || null]
  );

  await logAudit(req.user.id, 'admin', 'CREATE_EMPLOYEE', 'employees', result.rows[0].id, { employeeId }, getIp(req));

  // In production, temp password is emailed to the employee, not returned in the API response.
  return res.status(201).json({
    success: true,
    data: result.rows[0],
    ...(process.env.NODE_ENV === 'development' ? { devTempPassword: tempPassword } : {}),
  });
};

// ============================================================
// LIST / SEARCH EMPLOYEES (Admin only)
// ============================================================
export const listEmployees = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { search, departmentId, status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(e.full_name ILIKE $${idx} OR e.employee_id ILIKE $${idx} OR e.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx += 1;
  }
  if (departmentId) {
    conditions.push(`e.department_id = $${idx}`);
    params.push(departmentId);
    idx += 1;
  }
  if (status) {
    conditions.push(`e.status = $${idx}`);
    params.push(status);
    idx += 1;
  }

  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (parseInt(page, 10) - 1) * limitNum;

  const result = await query(
    `SELECT e.id, e.employee_id, e.full_name, e.email, e.mobile_number, e.designation,
            e.joining_date, e.status, e.face_image_url, e.profile_photo_url,
            e.department_id, e.shift_id,
            d.name AS department_name, s.name AS shift_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN shifts s ON s.id = e.shift_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.full_name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limitNum, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM employees e WHERE ${conditions.join(' AND ')}`,
    params
  );

  return res.json({
    success: true,
    data: result.rows,
    pagination: { page: parseInt(page, 10), limit: limitNum, total: parseInt(countResult.rows[0].count, 10) },
  });
};

// ============================================================
// GET SINGLE EMPLOYEE
// ============================================================
export const getEmployee = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const targetId = req.user.userType === 'employee' ? req.user.id : req.params.id;

  const result = await query(
    `SELECT e.id, e.employee_id, e.full_name, e.email, e.mobile_number, e.designation,
            e.joining_date, e.status, e.face_image_url, e.profile_photo_url,
            d.id AS department_id, d.name AS department_name,
            s.id AS shift_id, s.name AS shift_name, s.start_time, s.end_time
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN shifts s ON s.id = e.shift_id
     WHERE e.id = $1`,
    [targetId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// UPDATE EMPLOYEE (Admin only)
// ============================================================
export const updateEmployee = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { id } = req.params;
  const allowedFields = [
    'full_name',
    'email',
    'mobile_number',
    'department_id',
    'designation',
    'joining_date',
    'shift_id',
  ];
  const fieldMap: Record<string, string> = {
    fullName: 'full_name',
    email: 'email',
    mobileNumber: 'mobile_number',
    departmentId: 'department_id',
    designation: 'designation',
    joiningDate: 'joining_date',
    shiftId: 'shift_id',
  };

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [bodyKey, column] of Object.entries(fieldMap)) {
    if (req.body[bodyKey] !== undefined && allowedFields.includes(column)) {
      updates.push(`${column} = $${idx}`);
      params.push(req.body[bodyKey]);
      idx += 1;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
  }

  params.push(id);
  const result = await query(
    `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, employee_id, full_name, email, status`,
    params
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  await logAudit(req.user.id, 'admin', 'UPDATE_EMPLOYEE', 'employees', id, req.body, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// ENABLE / DISABLE EMPLOYEE (Admin only)
// ============================================================
export const setEmployeeStatus = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { id } = req.params;
  const { status } = req.body; // 'active' | 'disabled'

  if (!['active', 'disabled'].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be 'active' or 'disabled'" });
  }

  const result = await query(
    `UPDATE employees SET status = $1 WHERE id = $2 RETURNING id, employee_id, status`,
    [status, id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  await logAudit(req.user.id, 'admin', `EMPLOYEE_${status.toUpperCase()}`, 'employees', id, {}, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// DELETE EMPLOYEE (Admin only)
// ============================================================
export const deleteEmployee = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { id } = req.params;
  const result = await query(`DELETE FROM employees WHERE id = $1 RETURNING id`, [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  await logAudit(req.user.id, 'admin', 'DELETE_EMPLOYEE', 'employees', id, {}, getIp(req));

  return res.json({ success: true, message: 'Employee deleted successfully' });
};

// ============================================================
// RESET EMPLOYEE PASSWORD (Admin only)
// ============================================================
export const adminResetEmployeePassword = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { id } = req.params;
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  const result = await query(
    `UPDATE employees SET password_hash = $1 WHERE id = $2 RETURNING id, employee_id`,
    [passwordHash, id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  await logAudit(req.user.id, 'admin', 'ADMIN_RESET_EMPLOYEE_PASSWORD', 'employees', id, {}, getIp(req));

  return res.json({
    success: true,
    message: 'Password reset successfully',
    ...(process.env.NODE_ENV === 'development' ? { devTempPassword: tempPassword } : {}),
  });
};

// ============================================================
// UPLOAD / ENROLL EMPLOYEE FACE (Admin only)
// Accepts a base64 image + the 128-d descriptor computed client-side by
// face-api.js at enrollment time (recommended), OR just the image if the
// descriptor is to be computed elsewhere.
// ============================================================
export const enrollEmployeeFace = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { id } = req.params;
  const { imageBase64, faceDescriptor } = req.body;

  if (!imageBase64 || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    return res.status(400).json({
      success: false,
      message: 'imageBase64 and a valid 128-length faceDescriptor are required',
    });
  }

  const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const filePath = `faces/${id}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    return res.status(500).json({ success: false, message: `Failed to upload face image: ${uploadError.message}` });
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  const result = await query(
    `UPDATE employees SET face_descriptor = $1, face_image_url = $2 WHERE id = $3
     RETURNING id, employee_id, face_image_url`,
    [JSON.stringify(faceDescriptor), publicUrlData.publicUrl, id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  await logAudit(req.user.id, 'admin', 'ENROLL_EMPLOYEE_FACE', 'employees', id, {}, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};

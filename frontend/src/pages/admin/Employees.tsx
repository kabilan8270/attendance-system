import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, KeyRound, Fingerprint, Ban, CheckCircle, Trash2, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import FaceCapture from '../../components/attendance/FaceCapture';
import { Department, Shift } from '../../types';

export default function AdminEmployees() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [faceEnrollId, setFaceEnrollId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: async () => (await api.get(`/employees?search=${encodeURIComponent(search)}`)).data.data,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data.data as Department[],
  });

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => (await api.get('/shifts')).data.data as Shift[],
  });

  const [form, setForm] = useState({
    employeeId: '', fullName: '', email: '', mobileNumber: '', departmentId: '', designation: '', joiningDate: '', shiftId: '',
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/employees', form);
      toast.success(
        data.devTempPassword ? `Employee created. Temp password: ${data.devTempPassword}` : 'Employee created'
      );
      setAddOpen(false);
      setForm({ employeeId: '', fullName: '', email: '', mobileNumber: '', departmentId: '', designation: '', joiningDate: '', shiftId: '' });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create employee');
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    try {
      await api.patch(`/employees/${id}/status`, { status: current === 'active' ? 'disabled' : 'active' });
      toast.success('Status updated');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const resetPassword = async (id: string) => {
    try {
      const { data } = await api.post(`/employees/${id}/reset-password`);
      toast.success(data.devTempPassword ? `New temp password: ${data.devTempPassword}` : 'Password reset');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password');
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Delete this employee permanently? This cannot be undone.')) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employee deleted');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete employee');
    }
  };

  const handleEnrollFace = async (result: { descriptor: number[]; imageBase64: string }) => {
    if (!faceEnrollId) return;
    try {
      await api.post(`/employees/${faceEnrollId}/enroll-face`, {
        imageBase64: result.imageBase64,
        faceDescriptor: result.descriptor,
      });
      toast.success('Face enrolled successfully');
      setFaceEnrollId(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to enroll face');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Employee</button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by name, ID or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Shift</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Face</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees?.map((emp: any) => (
                <tr key={emp.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-2.5 pr-4 font-mono text-xs">{emp.employee_id}</td>
                  <td className="py-2.5 pr-4">{emp.full_name}</td>
                  <td className="py-2.5 pr-4">{emp.department_name || '—'}</td>
                  <td className="py-2.5 pr-4">{emp.shift_name || '—'}</td>
                  <td className="py-2.5 pr-4"><StatusBadge status={emp.status} /></td>
                  <td className="py-2.5 pr-4">
                    {emp.face_image_url ? (
                      <span className="text-green-600 text-xs">Enrolled</span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not enrolled</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1">
                      <button title="Enroll face" onClick={() => setFaceEnrollId(emp.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Fingerprint className="w-4 h-4 text-indigo-600" />
                      </button>
                      <button title="Reset password" onClick={() => resetPassword(emp.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <KeyRound className="w-4 h-4 text-amber-600" />
                      </button>
                      <button title={emp.status === 'active' ? 'Disable' : 'Enable'} onClick={() => toggleStatus(emp.id, emp.status)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        {emp.status === 'active' ? <Ban className="w-4 h-4 text-gray-500" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                      </button>
                      <button title="Delete" onClick={() => deleteEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {employees && employees.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No employees found</p>}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Employee" wide>
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
          <div><label className="label">Employee ID</label><input className="input" required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></div>
          <div><label className="label">Full Name</label><input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Mobile Number</label><input className="input" required value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} /></div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">—</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Shift</label>
            <select className="input" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
              <option value="">—</option>
              {shifts?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div><label className="label">Joining Date</label><input type="date" className="input" required value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary w-full">Create Employee</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!faceEnrollId} onClose={() => setFaceEnrollId(null)} title="Enroll Employee Face">
        <FaceCapture requireLiveness={false} onCapture={handleEnrollFace} />
      </Modal>
    </div>
  );
}

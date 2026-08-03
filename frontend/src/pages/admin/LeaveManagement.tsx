import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X, Ban, Plus } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

export default function AdminLeave() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'casual', startDate: '', endDate: '', reason: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-leaves', statusFilter],
    queryFn: async () => (await api.get(`/leaves?status=${statusFilter}`)).data.data,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => (await api.get('/employees?limit=200')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-leaves'] });

  const approve = async (id: string) => {
    try {
      await api.patch(`/leaves/${id}/approve`);
      toast.success('Leave approved');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve');
    }
  };

  const reject = async (id: string) => {
    const reviewNote = prompt('Reason for rejection (optional):') || undefined;
    try {
      await api.patch(`/leaves/${id}/reject`, { reviewNote });
      toast.success('Leave rejected');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject');
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.patch(`/leaves/${id}/admin-cancel`);
      toast.success('Leave cancelled');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  const addLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leaves/admin-add', form);
      toast.success('Leave added for employee');
      setAddOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add leave');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Leave</button>
      </div>

      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={statusFilter === s ? 'btn-primary' : 'btn-secondary'}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Dates</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-2.5 pr-4">{r.full_name} <span className="text-xs text-gray-400">({r.employee_code})</span></td>
                  <td className="py-2.5 pr-4 capitalize">{r.leave_type}</td>
                  <td className="py-2.5 pr-4">{r.start_date} → {r.end_date}</td>
                  <td className="py-2.5 pr-4 max-w-xs truncate text-gray-500">{r.reason || '—'}</td>
                  <td className="py-2.5 pr-4"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5">
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => approve(r.id)} title="Approve" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                        <button onClick={() => reject(r.id)} title="Reject" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                    {r.status === 'approved' && (
                      <button onClick={() => cancel(r.id)} title="Cancel" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Ban className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No {statusFilter} requests</p>}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Leave for Employee">
        <form onSubmit={addLeave} className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select className="input" required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee</option>
              {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Leave Type</label>
            <select className="input" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
              <option value="casual">Casual</option>
              <option value="medical">Medical</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Start Date</label><input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Reason</label><textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Add Leave</button>
        </form>
      </Modal>
    </div>
  );
}

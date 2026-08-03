import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { LeaveType } from '../../types';

export default function LeaveRequests() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leaveType: 'casual' as LeaveType, startDate: '', endDate: '', reason: '' });
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: async () => (await api.get('/leaves/me')).data.data,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leaves', form);
      toast.success('Leave request submitted');
      setOpen(false);
      setForm({ leaveType: 'casual', startDate: '', endDate: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit request');
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.patch(`/leaves/${id}/cancel`);
      toast.success('Leave request cancelled');
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Requests</h1>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Request</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Start</th>
              <th className="py-2 pr-4">End</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.requests?.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50">
                <td className="py-2.5 pr-4 capitalize">{r.leave_type}</td>
                <td className="py-2.5 pr-4">{r.start_date}</td>
                <td className="py-2.5 pr-4">{r.end_date}</td>
                <td className="py-2.5 pr-4 text-gray-500 max-w-xs truncate">{r.reason || '—'}</td>
                <td className="py-2.5 pr-4"><StatusBadge status={r.status} /></td>
                <td className="py-2.5">
                  {r.status === 'pending' && (
                    <button onClick={() => cancel(r.id)} className="text-red-600 hover:underline text-xs">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data?.requests || data.requests.length === 0) && (
          <p className="text-center text-gray-400 py-8 text-sm">No leave requests yet</p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Submit Leave Request">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Leave Type</label>
            <select
              className="input"
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}
            >
              <option value="casual">Casual Leave</option>
              <option value="medical">Medical Leave</option>
              <option value="paid">Paid Leave</option>
              <option value="unpaid">Unpaid Leave</option>
              <option value="emergency">Emergency Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea className="input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Submit Request</button>
        </form>
      </Modal>
    </div>
  );
}

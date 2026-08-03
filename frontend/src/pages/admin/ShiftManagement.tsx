import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';

export default function AdminShifts() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, isOvernight: false });
  const queryClient = useQueryClient();

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => (await api.get('/shifts')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shifts'] });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, isOvernight: false });
    setOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5), gracePeriodMinutes: s.grace_period_minutes, isOvernight: s.is_overnight });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/shifts/${editing.id}`, form);
        toast.success('Shift updated');
      } else {
        await api.post('/shifts', form);
        toast.success('Shift created');
      }
      setOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save shift');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try {
      await api.delete(`/shifts/${id}`);
      toast.success('Shift deleted');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete shift');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift Management</h1>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Shift</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts?.map((s: any) => (
          <div key={s.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-sm text-gray-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                <p className="text-xs text-gray-400 mt-1">Grace period: {s.grace_period_minutes} min</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil className="w-4 h-4 text-blue-600" /></button>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Trash2 className="w-4 h-4 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Shift' : 'New Shift'}>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Shift Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Start Time</label><input type="time" className="input" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="label">End Time</label><input type="time" className="input" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div><label className="label">Grace Period (minutes)</label><input type="number" className="input" value={form.gracePeriodMinutes} onChange={(e) => setForm({ ...form, gracePeriodMinutes: Number(e.target.value) })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isOvernight} onChange={(e) => setForm({ ...form, isOvernight: e.target.checked })} /> Overnight shift (e.g. Night shift)
          </label>
          <button type="submit" className="btn-primary w-full">{editing ? 'Update Shift' : 'Create Shift'}</button>
        </form>
      </Modal>
    </div>
  );
}

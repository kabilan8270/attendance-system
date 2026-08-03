import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';

export default function AdminHolidays() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', holidayDate: '', description: '' });
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();

  const { data: holidays } = useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => (await api.get(`/holidays?year=${year}`)).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['holidays'] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/holidays', form);
      toast.success('Holiday added');
      setOpen(false);
      setForm({ name: '', holidayDate: '', description: '' });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add holiday');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}`);
      toast.success('Holiday deleted');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete holiday');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holiday Management ({year})</h1>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Holiday</button>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        {holidays?.map((h: any) => (
          <div key={h.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{h.name}</p>
              <p className="text-sm text-gray-500">{h.holiday_date} {h.description ? `· ${h.description}` : ''}</p>
            </div>
            <button onClick={() => remove(h.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        ))}
        {(!holidays || holidays.length === 0) && <p className="text-gray-400 text-sm py-6 text-center">No holidays added yet</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Holiday">
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Holiday Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Date</label><input type="date" className="input" required value={form.holidayDate} onChange={(e) => setForm({ ...form, holidayDate: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Add Holiday</button>
        </form>
      </Modal>
    </div>
  );
}

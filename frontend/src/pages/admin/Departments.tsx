import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';

export default function AdminDepartments() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/departments', form);
      toast.success('Department created');
      setOpen(false);
      setForm({ name: '', description: '' });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create department');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Department deleted');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete department');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Department</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments?.map((d: any) => (
          <div key={d.id} className="card flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{d.name}</h3>
              <p className="text-sm text-gray-500">{d.employee_count} employees</p>
              {d.description && <p className="text-xs text-gray-400 mt-1">{d.description}</p>}
            </div>
            <button onClick={() => remove(d.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Department">
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Department Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Create Department</button>
        </form>
      </Modal>
    </div>
  );
}

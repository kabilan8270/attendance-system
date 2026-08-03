import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, MapPin, LocateFixed } from 'lucide-react';
import { api } from '../../api/client';
import Modal from '../../components/ui/Modal';
import { useGeolocation } from '../../hooks/useGeolocation';

export default function AdminOfficeLocations() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: 100 });
  const queryClient = useQueryClient();
  const { getLocation } = useGeolocation();

  const { data: locations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: async () => (await api.get('/office-locations')).data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['office-locations'] });

  const useCurrentLocation = async () => {
    try {
      const coords = await getLocation();
      setForm({ ...form, latitude: String(coords.latitude), longitude: String(coords.longitude) });
      toast.success('Current location filled in');
    } catch (err: any) {
      toast.error(err.message || 'Could not get location');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/office-locations', {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      });
      toast.success('Office location configured');
      setOpen(false);
      setForm({ name: '', latitude: '', longitude: '', radiusMeters: 100 });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save location');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this office location?')) return;
    try {
      await api.delete(`/office-locations/${id}`);
      toast.success('Location deleted');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Office Locations (GPS Geofence)</h1>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Location</button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Employees can only mark attendance when their device GPS is within the configured radius of at least one active location below.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {locations?.map((loc: any) => (
          <div key={loc.id} className="card flex items-start justify-between">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold">{loc.name}</h3>
                <p className="text-sm text-gray-500">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p>
                <p className="text-xs text-gray-400 mt-1">Radius: {loc.radius_meters}m · {loc.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
            <button onClick={() => remove(loc.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        ))}
        {(!locations || locations.length === 0) && (
          <p className="text-gray-400 text-sm col-span-2 text-center py-8">
            No office locations configured yet. Employees cannot check in until at least one is added.
          </p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Office Location">
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Location Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Head Office" /></div>
          <button type="button" onClick={useCurrentLocation} className="btn-secondary w-full">
            <LocateFixed className="w-4 h-4" /> Use My Current Location
          </button>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Latitude</label><input className="input" required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
            <div><label className="label">Longitude</label><input className="input" required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
          </div>
          <div><label className="label">Radius (meters)</label><input type="number" className="input" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} /></div>
          <button type="submit" className="btn-primary w-full">Save Location</button>
        </form>
      </Modal>
    </div>
  );
}

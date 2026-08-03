import { useState } from 'react';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';

const reportTypes = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'yearly', label: 'Yearly Report' },
  { value: 'late', label: 'Late Report' },
];

export default function AdminReports() {
  const [type, setType] = useState('daily');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const baseUrl = import.meta.env.VITE_API_URL || '/api';

  const buildUrl = (endpoint: string, format: string) => {
    const params = new URLSearchParams({ format, ...(from ? { from } : {}), ...(to ? { to } : {}) });
    if (endpoint === 'attendance') params.set('type', type);
    return `${baseUrl}/reports/${endpoint}?${params.toString()}`;
  };

  const download = (endpoint: string, format: string) => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    fetch(buildUrl(endpoint, format), {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${endpoint}_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Attendance Report</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {reportTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="date" className="input" placeholder="From (optional)" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input" placeholder="To (optional)" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={() => download('attendance', 'excel')} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
          <button onClick={() => download('attendance', 'pdf')} className="btn-secondary"><Download className="w-4 h-4" /> Export PDF</button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Leave Report</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="date" className="input" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={() => download('leave', 'excel')} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Attendance Summary (per employee)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="date" className="input" placeholder="From" required value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input" placeholder="To" required value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button
          disabled={!from || !to}
          onClick={() => download('attendance-summary', 'excel')}
          className="btn-secondary disabled:opacity-40"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </button>
      </div>
    </div>
  );
}

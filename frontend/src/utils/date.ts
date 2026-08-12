// All attendance times must be displayed in India Standard Time explicitly —
// never left to the browser's local timezone (which may differ from IST for
// employees viewing attendance from abroad, or on misconfigured devices).

const IST_TZ = 'Asia/Kolkata';

/** e.g. "08:05 PM" */
export const formatISTTime = (value: string | Date | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/** Compact 24-hour form used inside tight calendar cells, e.g. "20:05" */
export const formatISTTimeCompact = (value: string | Date | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
};

/** e.g. "11 Aug 2026, 08:05 PM" */
export const formatISTDateTime = (value: string | Date | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

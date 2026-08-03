import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  late: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  half_day: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  leave: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  holiday: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  work_from_home: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  disabled: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('badge', statusStyles[status] || 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

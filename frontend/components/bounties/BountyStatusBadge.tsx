'use client';

interface BountyStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Open' },
  CLAIMED: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'In Progress' },
  SUBMITTED: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Under Review' },
  COMPLETED: { bg: 'bg-primary/20', text: 'text-primary', label: 'Completed' },
  REJECTED: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Rejected' },
  AUTO_RELEASED: { bg: 'bg-purple-900/50', text: 'text-purple-400', label: 'Auto Released' },
};

export function BountyStatusBadge({ status, size = 'md' }: BountyStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.OPEN;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${config.bg} ${config.text} ${sizeClasses} rounded-full font-medium`}>
      {config.label}
    </span>
  );
}

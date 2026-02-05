'use client';

import { BountyStatusBadge } from './BountyStatusBadge';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: string;
  requiredSkills: string[];
  posterAddress: string;
  createdAt: number;
  submitDeadline?: number;
}

interface BountyCardProps {
  bounty: Bounty;
  onClick?: () => void;
}

export function BountyCard({ bounty, onClick }: BountyCardProps) {
  const shortPoster = `${bounty.posterAddress.slice(0, 6)}...${bounty.posterAddress.slice(-4)}`;

  // Format deadline if exists
  const deadlineText = bounty.submitDeadline
    ? new Date(bounty.submitDeadline).toLocaleDateString()
    : null;

  return (
    <div
      className={`
        bg-slate-800/50 border border-slate-700 rounded-xl p-5
        hover:border-primary/50 hover:bg-slate-800/70 transition-all
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-lg truncate">{bounty.title}</h3>
          <p className="text-slate-400 text-sm font-mono">by {shortPoster}</p>
        </div>
        <BountyStatusBadge status={bounty.status} size="sm" />
      </div>

      {/* Description */}
      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
        {bounty.description}
      </p>

      {/* Reward */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">${bounty.reward}</span>
          <span className="text-slate-400 text-sm">USDC</span>
        </div>
        {deadlineText && (
          <span className="text-slate-500 text-xs">
            Due: {deadlineText}
          </span>
        )}
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-2">
        {bounty.requiredSkills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
          >
            {skill}
          </span>
        ))}
        {bounty.requiredSkills.length > 4 && (
          <span className="text-slate-500 text-xs py-1">
            +{bounty.requiredSkills.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}

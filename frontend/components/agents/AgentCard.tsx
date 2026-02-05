'use client';

import { ReputationBadge } from './ReputationBadge';

interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  skills: string[];
  reputation: {
    score: number;
    totalJobs: number;
    confidence?: number;
  };
  erc8004Id?: string | null;
}

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  // Truncate wallet address
  const shortAddress = `${agent.walletAddress.slice(0, 6)}...${agent.walletAddress.slice(-4)}`;

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
        <div>
          <h3 className="font-semibold text-white text-lg">{agent.name}</h3>
          <p className="text-slate-400 text-sm font-mono">{shortAddress}</p>
        </div>

        {/* ERC-8004 Badge */}
        {agent.erc8004Id && (
          <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Verified</span>
          </div>
        )}
      </div>

      {/* Reputation */}
      <div className="mb-4">
        <ReputationBadge
          score={agent.reputation.score}
          totalJobs={agent.reputation.totalJobs}
          confidence={agent.reputation.confidence}
        />
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-2">
        {agent.skills.slice(0, 5).map((skill) => (
          <span
            key={skill}
            className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
          >
            {skill}
          </span>
        ))}
        {agent.skills.length > 5 && (
          <span className="text-slate-500 text-xs py-1">
            +{agent.skills.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { BountyCard } from './BountyCard';
import { useRouter } from 'next/navigation';

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

export function BountyList() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetchBounties();
  }, [statusFilter]);

  async function fetchBounties() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/bounties?${params}`);
      const data = await res.json();

      if (data.success) {
        setBounties(data.bounties);
      }
    } catch (error) {
      console.error('Failed to fetch bounties:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'OPEN', 'CLAIMED', 'SUBMITTED', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary text-background-dark'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400">Loading bounties...</div>
      )}

      {/* Empty state */}
      {!loading && bounties.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No bounties found. Be the first to create one!
        </div>
      )}

      {/* Grid */}
      {!loading && bounties.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bounties.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              onClick={() => router.push(`/bounties/${bounty.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

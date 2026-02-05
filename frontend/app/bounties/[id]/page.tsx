'use client';

import { useState, useEffect, use } from 'react';
import { Navbar } from '@/components/Navbar';
import { BountyStatusBadge } from '@/components/bounties/BountyStatusBadge';
import { ClaimBountyButton } from '@/components/bounties/ClaimBountyButton';
import { SubmitWorkForm } from '@/components/bounties/SubmitWorkForm';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: string;
  type: string;
  posterAddress: string;
  assignedAgentId?: string;
  assignedAgentAddress?: string;
  requiredSkills: string[];
  requirements?: string;
  createdAt: number;
  submitDeadline?: number;
  reviewDeadline?: number;
  deliverableCID?: string;
  deliverableMessage?: string;
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address } = useAccount();
  const router = useRouter();

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    fetchBounty();
    if (address) fetchAgentId();
  }, [id, address]);

  async function fetchBounty() {
    try {
      const res = await fetch(`/api/bounties/${id}`);
      const data = await res.json();
      if (data.success) {
        setBounty(data.bounty);
      }
    } catch (error) {
      console.error('Failed to fetch bounty:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgentId() {
    try {
      const res = await fetch(`/api/agents?wallet=${address}`);
      const data = await res.json();
      if (data.agents?.[0]) {
        setAgentId(data.agents[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
    }
  }

  async function handleApprove(approved: boolean) {
    try {
      const res = await fetch(`/api/bounties/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterAddress: address, approved }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBounty();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-slate-400">Bounty not found</div>
      </div>
    );
  }

  const isPoster = address?.toLowerCase() === bounty.posterAddress;
  const isAssignedAgent = address?.toLowerCase() === bounty.assignedAgentAddress;

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{bounty.title}</h1>
            <div className="flex items-center gap-4">
              <BountyStatusBadge status={bounty.status} />
              <span className="text-slate-400 text-sm">
                Posted by {bounty.posterAddress.slice(0, 8)}...
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">${bounty.reward}</div>
            <div className="text-slate-400">USDC</div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
          <p className="text-slate-300 whitespace-pre-wrap">{bounty.description}</p>

          {bounty.requirements && (
            <>
              <h3 className="text-md font-semibold text-white mt-4 mb-2">Requirements</h3>
              <p className="text-slate-300 whitespace-pre-wrap">{bounty.requirements}</p>
            </>
          )}
        </div>

        {/* Skills */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {bounty.requiredSkills.map(skill => (
              <span key={skill} className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Deliverable (if submitted) */}
        {bounty.deliverableMessage && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Submitted Work</h2>
            {bounty.deliverableCID && (
              <p className="text-primary font-mono text-sm mb-2">IPFS: {bounty.deliverableCID}</p>
            )}
            <p className="text-slate-300">{bounty.deliverableMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          {bounty.status === 'OPEN' && !isPoster && (
            <ClaimBountyButton bountyId={bounty.id} onClaimed={fetchBounty} />
          )}

          {bounty.status === 'CLAIMED' && isAssignedAgent && agentId && (
            <SubmitWorkForm bountyId={bounty.id} agentId={agentId} onSubmitted={fetchBounty} />
          )}

          {bounty.status === 'SUBMITTED' && isPoster && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Review Submission</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handleApprove(true)}
                  className="flex-1 bg-primary text-background-dark px-6 py-3 rounded-lg font-bold hover:opacity-90"
                >
                  Approve & Pay
                </button>
                <button
                  onClick={() => handleApprove(false)}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {bounty.status === 'COMPLETED' && (
            <div className="text-center py-4">
              <span className="text-primary text-lg font-semibold">✓ Bounty Completed</span>
            </div>
          )}

          {bounty.status === 'OPEN' && isPoster && (
            <div className="text-center py-4 text-slate-400">
              Waiting for an agent to claim this bounty...
            </div>
          )}

          {bounty.status === 'CLAIMED' && isPoster && (
            <div className="text-center py-4 text-slate-400">
              Agent is working on this bounty...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

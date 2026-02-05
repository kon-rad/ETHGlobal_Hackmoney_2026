'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { BountyCard } from '@/components/bounties/BountyCard';
import { ReputationBadge } from '@/components/agents/ReputationBadge';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import type { Bounty } from '@/lib/types/bounty';

interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  skills: string[];
  reputation: {
    score: number;
    totalJobs: number;
    positive: number;
    negative: number;
    confidence: number;
  };
  erc8004Id?: string;
}

type Tab = 'active' | 'posted' | 'completed';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [postedBounties, setPostedBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('active');

  useEffect(() => {
    if (address) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [address]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch agent profile
      const agentRes = await fetch(`/api/agents?skill=&limit=100`);
      const agentData = await agentRes.json();
      const myAgent = agentData.agents?.find(
        (a: Agent) => a.walletAddress.toLowerCase() === address?.toLowerCase()
      );
      setAgent(myAgent || null);

      // Fetch bounties assigned to agent
      const assignedRes = await fetch(`/api/bounties?agentAddress=${address}`);
      const assignedData = await assignedRes.json();
      setBounties(assignedData.bounties || []);

      // Fetch bounties posted by user
      const postedRes = await fetch(`/api/bounties?posterAddress=${address}`);
      const postedData = await postedRes.json();
      setPostedBounties(postedData.bounties || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const activeBounties = bounties.filter(b => ['CLAIMED', 'SUBMITTED'].includes(b.status));
  const completedBounties = bounties.filter(b => ['COMPLETED', 'AUTO_RELEASED'].includes(b.status));
  const pendingReview = postedBounties.filter(b => b.status === 'SUBMITTED');

  // Calculate stats
  const totalEarnings = completedBounties.reduce((sum, b) => sum + b.reward, 0);
  const totalPosted = postedBounties.reduce((sum, b) => sum + b.reward, 0);
  const completionRate = bounties.length > 0
    ? Math.round((completedBounties.length / bounties.length) * 100)
    : 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Dashboard</h1>
          <p className="text-slate-400 mb-8">Connect your wallet to view your dashboard</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-slate-400">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Total Earnings</div>
            <div className="text-2xl font-bold text-primary">${totalEarnings}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Active Bounties</div>
            <div className="text-2xl font-bold text-white">{activeBounties.length}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Completion Rate</div>
            <div className="text-2xl font-bold text-white">{completionRate}%</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Total Posted</div>
            <div className="text-2xl font-bold text-white">${totalPosted}</div>
          </div>
        </div>

        {/* Agent Profile Card */}
        {agent && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{agent.name}</h2>
                <p className="text-slate-400 font-mono text-sm mb-3">
                  {address?.slice(0, 8)}...{address?.slice(-6)}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {agent.skills.slice(0, 6).map(skill => (
                    <span key={skill} className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <ReputationBadge
                  score={agent.reputation.score}
                  totalJobs={agent.reputation.totalJobs}
                  confidence={agent.reputation.confidence}
                />
                {agent.erc8004Id && (
                  <div className="mt-2 text-xs text-primary">
                    ERC-8004 #{agent.erc8004Id}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {pendingReview.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">!</span>
              <span className="text-yellow-400">
                You have {pendingReview.length} submission{pendingReview.length > 1 ? 's' : ''} to review
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'active'
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Work ({activeBounties.length})
          </button>
          <button
            onClick={() => setActiveTab('posted')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'posted'
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            My Bounties ({postedBounties.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'completed'
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed ({completedBounties.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'active' && (
          <div>
            {activeBounties.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No active bounties</p>
                <button
                  onClick={() => router.push('/bounties')}
                  className="bg-primary text-background-dark px-6 py-2 rounded-lg font-bold hover:opacity-90"
                >
                  Browse Bounties
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {activeBounties.map(bounty => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    onClick={() => router.push(`/bounties/${bounty.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'posted' && (
          <div>
            {postedBounties.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">You haven&apos;t posted any bounties yet</p>
                <button
                  onClick={() => router.push('/bounties/create')}
                  className="bg-primary text-background-dark px-6 py-2 rounded-lg font-bold hover:opacity-90"
                >
                  Post a Bounty
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {postedBounties.map(bounty => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    onClick={() => router.push(`/bounties/${bounty.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div>
            {completedBounties.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No completed bounties yet
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {completedBounties.map(bounty => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    onClick={() => router.push(`/bounties/${bounty.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

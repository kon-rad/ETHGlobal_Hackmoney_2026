'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

interface ClaimBountyButtonProps {
  bountyId: string;
  onClaimed?: () => void;
}

export function ClaimBountyButton({ bountyId, onClaimed }: ClaimBountyButtonProps) {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First check if user is registered as agent
      const agentsRes = await fetch(`/api/agents?wallet=${address}`);
      const agentsData = await agentsRes.json();

      let agentId = agentsData.agents?.[0]?.id;

      if (!agentId) {
        setError('Please register as an agent first');
        setLoading(false);
        return;
      }

      // Claim the bounty
      const res = await fetch(`/api/bounties/${bountyId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentAddress: address }),
      });

      const data = await res.json();

      if (data.success) {
        onClaimed?.();
      } else {
        setError(data.error?.message || 'Failed to claim bounty');
      }
    } catch (err) {
      setError('Failed to claim bounty');
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <button
        disabled
        className="w-full bg-slate-700 text-slate-400 px-6 py-3 rounded-lg font-bold cursor-not-allowed"
      >
        Connect Wallet to Claim
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={loading}
        className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
          loading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-primary text-background-dark hover:opacity-90'
        }`}
      >
        {loading ? 'Claiming...' : 'Claim Bounty'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

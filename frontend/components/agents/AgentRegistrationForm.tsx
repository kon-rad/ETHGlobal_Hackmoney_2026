'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useRegisterIdentity } from '@/lib/hooks/useIdentityRegistry';
import { getAgentId } from '@/lib/contracts/erc8004';

const COMMON_SKILLS = [
  'solidity', 'typescript', 'javascript', 'python', 'rust',
  'testing', 'auditing', 'research', 'design', 'writing',
];

type RegistrationStep = 'form' | 'minting' | 'complete';

export function AgentRegistrationForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [name, setName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<RegistrationStep>('form');
  const [firebaseAgentId, setFirebaseAgentId] = useState<string | null>(null);
  const [existingErc8004Id, setExistingErc8004Id] = useState<string | null>(null);

  const {
    register: registerIdentity,
    hash: mintHash,
    agentId: mintedAgentId,
    agentURI,
    isPending: isMinting,
    isUploading,
    isConfirming,
    isConfirmed: isMintConfirmed,
    error: mintError,
  } = useRegisterIdentity();

  // Check for existing ERC-8004 identity on mount
  useEffect(() => {
    async function checkExisting() {
      if (address) {
        const existingId = await getAgentId(address);
        if (existingId) {
          setExistingErc8004Id(existingId.toString());
        }
      }
    }
    checkExisting();
  }, [address]);

  // Handle mint confirmation - update Firebase with ERC-8004 ID
  useEffect(() => {
    if (isMintConfirmed && mintedAgentId && firebaseAgentId) {
      // Use async IIFE to handle the Firebase update
      (async () => {
        try {
          await fetch('/api/agents', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: firebaseAgentId,
              erc8004Id: mintedAgentId.toString(),
              wallet: address,
            }),
          });
        } catch (err) {
          console.error('Failed to update Firebase:', err);
        }
        // Set step after async operation completes
        setStep('complete');
        setTimeout(() => router.push('/bounties'), 2000);
      })();
    }
  }, [isMintConfirmed, mintedAgentId, firebaseAgentId, address, router]);

  function toggleSkill(skill: string) {
    setSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim().toLowerCase();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setCustomSkill('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    if (skills.length === 0) {
      setError('Select at least one skill');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Register in Firebase
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          name: name.trim(),
          skills,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFirebaseAgentId(data.agentId);

        // If already has ERC-8004 ID, skip minting
        if (data.erc8004Id || existingErc8004Id) {
          router.push('/bounties');
        } else {
          // Proceed to minting step
          setStep('minting');
          setLoading(false);
        }
      } else {
        setError(data.error?.message || 'Registration failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Registration failed');
      setLoading(false);
    }
  }

  async function handleMint() {
    setError(null);
    try {
      await registerIdentity({
        name: name.trim(),
        skills,
        description: `Agent registered via Clawork`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Minting failed');
    }
  }

  function handleSkipMint() {
    router.push('/bounties');
  }

  // Minting step UI
  if (step === 'minting') {
    return (
      <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Mint ERC-8004 Identity</h2>

        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Why mint on-chain?</h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>- Portable identity across platforms</li>
              <li>- On-chain reputation that follows you</li>
              <li>- Verifiable work history</li>
              <li>- No platform lock-in</li>
            </ul>
          </div>

          {/* Status indicators */}
          <div className="space-y-3">
            {isUploading && (
              <div className="flex items-center gap-3 text-yellow-400">
                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span>Uploading metadata to IPFS...</span>
              </div>
            )}

            {isMinting && !isUploading && (
              <div className="flex items-center gap-3 text-yellow-400">
                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span>Confirm transaction in wallet...</span>
              </div>
            )}

            {isConfirming && (
              <div className="flex items-center gap-3 text-yellow-400">
                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span>Waiting for confirmation...</span>
              </div>
            )}

            {isMintConfirmed && (
              <div className="flex items-center gap-3 text-primary">
                <span className="text-lg">&#10003;</span>
                <span>Identity minted successfully!</span>
              </div>
            )}

            {mintHash && (
              <div className="text-slate-400 text-sm font-mono truncate">
                TX: {mintHash}
              </div>
            )}

            {agentURI && (
              <div className="text-slate-400 text-sm font-mono truncate">
                URI: {agentURI}
              </div>
            )}
          </div>

          {(error || mintError) && (
            <p className="text-red-400 text-sm">{error || mintError?.message}</p>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleMint}
              disabled={isMinting || isConfirming || isMintConfirmed}
              className={`flex-1 px-6 py-3 rounded-lg font-bold transition-opacity ${
                isMinting || isConfirming || isMintConfirmed
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-primary text-background-dark hover:opacity-90'
              }`}
            >
              {isMinting || isConfirming ? 'Minting...' : isMintConfirmed ? 'Minted!' : 'Mint Identity'}
            </button>
            <button
              onClick={handleSkipMint}
              disabled={isMinting || isConfirming}
              className="px-6 py-3 rounded-lg font-bold bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Skip
            </button>
          </div>

          <p className="text-slate-500 text-xs text-center">
            You can mint your identity later from your dashboard
          </p>
        </div>
      </div>
    );
  }

  // Complete step UI
  if (step === 'complete') {
    return (
      <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
        <div className="text-6xl mb-4">&#10003;</div>
        <h2 className="text-2xl font-bold text-white mb-2">Registration Complete!</h2>
        <p className="text-slate-400 mb-4">
          Your ERC-8004 identity has been minted on Polygon Amoy.
        </p>
        <p className="text-primary font-mono text-sm">
          Agent ID: #{mintedAgentId?.toString()}
        </p>
        <p className="text-slate-500 text-sm mt-4">Redirecting to bounties...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Register as Agent</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">Connect your wallet to register</p>
          <ConnectButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Wallet */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wallet Address
            </label>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-400 font-mono text-sm">
              {address}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              maxLength={50}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Skills * (select at least one)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_SKILLS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    skills.includes(skill)
                      ? 'bg-primary text-background-dark'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            {/* Custom skill input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                placeholder="Add custom skill"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-600 text-sm"
              >
                Add
              </button>
            </div>
            {/* Selected skills display */}
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.filter(s => !COMMON_SKILLS.includes(s)).map(skill => (
                  <span
                    key={skill}
                    className="bg-primary/20 text-primary px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className="hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
              loading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-background-dark hover:opacity-90'
            }`}
          >
            {loading ? 'Registering...' : 'Register Agent'}
          </button>
        </form>
      )}
    </div>
  );
}

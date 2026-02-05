'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';

const COMMON_SKILLS = [
  'solidity', 'typescript', 'javascript', 'python', 'rust',
  'testing', 'auditing', 'research', 'design', 'writing',
];

export function AgentRegistrationForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [name, setName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        router.push('/bounties');
      } else {
        setError(data.error?.message || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
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

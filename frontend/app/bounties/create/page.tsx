'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';

const COMMON_SKILLS = ['solidity', 'typescript', 'testing', 'auditing', 'research', 'design'];

export default function CreateBountyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [reward, setReward] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSkill(skill: string) {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim(),
          reward: parseFloat(reward),
          posterAddress: address,
          requiredSkills: skills,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/bounties/${data.bountyId}`);
      } else {
        setError(data.error?.message || 'Failed to create bounty');
      }
    } catch (err) {
      setError('Failed to create bounty');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Post a Bounty</h1>

        {!isConnected ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">Connect your wallet to post a bounty</p>
            <ConnectButton />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Write unit tests for smart contract"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of what you need..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Requirements</label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Specific requirements or acceptance criteria..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reward (USDC) *</label>
              <input
                type="number"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="100"
                min="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Required Skills</label>
              <div className="flex flex-wrap gap-2">
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
              {loading ? 'Creating...' : 'Create Bounty'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

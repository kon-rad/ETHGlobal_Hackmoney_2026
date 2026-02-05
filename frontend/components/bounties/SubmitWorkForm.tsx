'use client';

import { useState } from 'react';

interface SubmitWorkFormProps {
  bountyId: string;
  agentId: string;
  onSubmitted?: () => void;
}

export function SubmitWorkForm({ bountyId, agentId, onSubmitted }: SubmitWorkFormProps) {
  const [deliverableCID, setDeliverableCID] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!deliverableCID && !message.trim()) {
      setError('Please provide a deliverable CID or message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bounties/${bountyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          deliverableCID: deliverableCID || null,
          message: message.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSubmitted?.();
      } else {
        setError(data.error?.message || 'Failed to submit work');
      }
    } catch (err) {
      setError('Failed to submit work');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          IPFS CID (optional)
        </label>
        <input
          type="text"
          value={deliverableCID}
          onChange={(e) => setDeliverableCID(e.target.value)}
          placeholder="Qm..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Message / Description
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your work..."
          rows={4}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
        />
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
        {loading ? 'Submitting...' : 'Submit Work'}
      </button>
    </form>
  );
}

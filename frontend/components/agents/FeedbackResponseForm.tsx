'use client';

import { useState } from 'react';
import { type Address } from 'viem';
import { useAppendResponse } from '@/lib/hooks/useReputationRegistry';

interface FeedbackResponseFormProps {
  agentId: bigint;
  clientAddress: Address;
  feedbackIndex: bigint;
  feedbackCID?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FeedbackResponseForm({
  agentId,
  clientAddress,
  feedbackIndex,
  feedbackCID,
  onSuccess,
  onCancel,
}: FeedbackResponseFormProps) {
  const [response, setResponse] = useState('');

  const {
    appendResponse,
    hash,
    responseURI,
    isPending,
    isUploading,
    isConfirming,
    isConfirmed,
    error,
    reset,
  } = useAppendResponse();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!response.trim()) return;

    try {
      await appendResponse({
        agentId,
        clientAddress,
        feedbackIndex,
        response: response.trim(),
        feedbackCID,
      });
    } catch (err) {
      console.error('Failed to append response:', err);
    }
  }

  // Handle success
  if (isConfirmed) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-3 text-primary mb-3">
          <span className="text-lg">&#10003;</span>
          <span className="font-medium">Response submitted successfully!</span>
        </div>
        {responseURI && (
          <p className="text-slate-400 text-sm font-mono truncate mb-3">
            IPFS: {responseURI}
          </p>
        )}
        <button
          onClick={() => {
            reset();
            setResponse('');
            onSuccess?.();
          }}
          className="bg-primary text-background-dark px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h4 className="text-white font-medium mb-3">Respond to Feedback</h4>

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write your response to this feedback..."
        rows={4}
        disabled={isPending || isConfirming}
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none disabled:opacity-50"
      />

      {/* Status indicators */}
      {isUploading && (
        <div className="flex items-center gap-3 text-yellow-400 mt-3">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Uploading to IPFS...</span>
        </div>
      )}

      {isPending && !isUploading && (
        <div className="flex items-center gap-3 text-yellow-400 mt-3">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Confirm transaction in wallet...</span>
        </div>
      )}

      {isConfirming && (
        <div className="flex items-center gap-3 text-yellow-400 mt-3">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Waiting for confirmation...</span>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-3">{error.message}</p>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={!response.trim() || isPending || isConfirming}
          className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm ${
            !response.trim() || isPending || isConfirming
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-primary text-background-dark hover:opacity-90'
          }`}
        >
          {isPending || isConfirming ? 'Submitting...' : 'Submit Response'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending || isConfirming}
            className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-slate-500 text-xs mt-3">
        Your response will be recorded on-chain and linked to the feedback
      </p>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { type Address } from 'viem';
import { useAgentFeedbackHistory, int128ToRating } from '@/lib/hooks/useReputationRegistry';
import { FeedbackResponseForm } from './FeedbackResponseForm';
import { RatingDisplay } from '@/components/bounties/RatingInput';
import { fetchFromIPFS, type FeedbackMetadata } from '@/lib/services/ipfs';

interface FeedbackHistoryListProps {
  agentId: bigint;
  canRespond?: boolean;
}

export function FeedbackHistoryList({ agentId, canRespond = false }: FeedbackHistoryListProps) {
  const { feedbackList, isLoading, error, refetch } = useAgentFeedbackHistory(agentId);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, FeedbackMetadata>>({});

  // Fetch metadata for a feedback entry
  async function loadMetadata(feedbackURI: string, key: string) {
    if (metadata[key] || !feedbackURI) return;

    try {
      const cid = feedbackURI.replace('ipfs://', '');
      const data = await fetchFromIPFS<FeedbackMetadata>(cid);
      setMetadata(prev => ({ ...prev, [key]: data }));
    } catch (err) {
      console.warn('Failed to load feedback metadata:', err);
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading feedback history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error.message}</p>
        <button
          onClick={refetch}
          className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (feedbackList.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No feedback yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackList.map((feedback) => {
        const key = `${feedback.clientAddress}-${feedback.index}`;
        const rating = int128ToRating(feedback.value, feedback.valueDecimals);
        const hasResponse = feedback.responseURI && feedback.responseURI !== '';
        const isExpanded = expandedIndex === key;
        const isResponding = respondingTo === key;
        const feedbackMeta = metadata[key];

        // Load metadata when expanded
        if (isExpanded && feedback.feedbackURI && !feedbackMeta) {
          loadMetadata(feedback.feedbackURI, key);
        }

        return (
          <div
            key={key}
            className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div
              onClick={() => setExpandedIndex(isExpanded ? null : key)}
              className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RatingDisplay value={rating} size="sm" />
                  <span className="text-slate-400 text-sm">
                    from {feedback.clientAddress.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {hasResponse && (
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                      Responded
                    </span>
                  )}
                  <span className="text-slate-500 text-xs">
                    {new Date(Number(feedback.timestamp) * 1000).toLocaleDateString()}
                  </span>
                  <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    &#9660;
                  </span>
                </div>
              </div>

              {/* Tags */}
              {(feedback.tag1 || feedback.tag2) && (
                <div className="flex gap-2 mt-2">
                  {feedback.tag1 && (
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">
                      {feedback.tag1}
                    </span>
                  )}
                  {feedback.tag2 && (
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">
                      {feedback.tag2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-slate-700 p-4 space-y-4">
                {/* Metadata from IPFS */}
                {feedbackMeta && (
                  <div className="space-y-2">
                    {feedbackMeta.bountyTitle && (
                      <p className="text-white">
                        <span className="text-slate-400">Bounty:</span> {feedbackMeta.bountyTitle}
                      </p>
                    )}
                    {feedbackMeta.comment && (
                      <p className="text-slate-300">{feedbackMeta.comment}</p>
                    )}
                  </div>
                )}

                {/* IPFS links */}
                <div className="space-y-1 text-xs">
                  {feedback.feedbackURI && (
                    <p className="text-slate-500 font-mono truncate">
                      Feedback: {feedback.feedbackURI}
                    </p>
                  )}
                  {hasResponse && (
                    <p className="text-slate-500 font-mono truncate">
                      Response: {feedback.responseURI}
                    </p>
                  )}
                </div>

                {/* Response section */}
                {hasResponse ? (
                  <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Your response:</p>
                    <p className="text-slate-300 text-sm">
                      Response recorded on-chain. View on IPFS for full content.
                    </p>
                  </div>
                ) : canRespond && (
                  <>
                    {isResponding ? (
                      <FeedbackResponseForm
                        agentId={agentId}
                        clientAddress={feedback.clientAddress}
                        feedbackIndex={feedback.index}
                        feedbackCID={feedback.feedbackURI?.replace('ipfs://', '')}
                        onSuccess={() => {
                          setRespondingTo(null);
                          refetch();
                        }}
                        onCancel={() => setRespondingTo(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setRespondingTo(key)}
                        className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm hover:bg-slate-600"
                      >
                        Respond to this feedback
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

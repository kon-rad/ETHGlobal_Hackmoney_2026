'use client';

/**
 * useReputationRegistry Hook
 *
 * React hooks for interacting with the ERC-8004 Reputation Registry contract.
 * Provides functions for:
 * - Submitting feedback (giveFeedback)
 * - Appending agent responses to feedback
 * - Reading feedback history
 * - Getting reputation summaries
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { type Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { REPUTATION_REGISTRY_ABI } from '@/lib/contracts/abis/reputationRegistry';
import { uploadFeedbackMetadata, uploadResponseMetadata, computeHash } from '@/lib/services/ipfs';

// ============================================================================
// Types
// ============================================================================

export interface GiveFeedbackParams {
  agentId: bigint;
  rating: number; // 1-5 star rating, will be converted to int128
  comment?: string;
  bountyId?: string;
  bountyTitle?: string;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  deliverableCID?: string;
}

export interface AppendResponseParams {
  agentId: bigint;
  clientAddress: Address;
  feedbackIndex: bigint;
  response: string;
  feedbackCID?: string;
}

export interface FeedbackEntry {
  clientAddress: Address;
  index: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  timestamp: bigint;
  responseURI: string;
  responseHash: `0x${string}`;
}

export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert 1-5 star rating to int128 value with decimals
 * Uses decimals=1 so 5 stars = 50, 4 stars = 40, etc.
 */
function ratingToInt128(rating: number): { value: bigint; decimals: number } {
  // Clamp rating to 1-5
  const clampedRating = Math.max(1, Math.min(5, rating));
  // Multiply by 10 to use 1 decimal place (e.g., 5.0 -> 50)
  return {
    value: BigInt(Math.round(clampedRating * 10)),
    decimals: 1,
  };
}

/**
 * Convert int128 value with decimals back to star rating (1-5)
 */
export function int128ToRating(value: bigint, decimals: number): number {
  const divisor = 10 ** decimals;
  return Number(value) / divisor;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for giving feedback (ERC-8004 spec compliant)
 */
export function useGiveFeedback() {
  const publicClient = usePublicClient();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [feedbackURI, setFeedbackURI] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash });

  const giveFeedback = useCallback(
    async (params: GiveFeedbackParams): Promise<void> => {
      setUploadError(null);
      setFeedbackURI(null);
      resetWrite();

      try {
        // Step 1: Upload feedback metadata to IPFS
        setIsUploading(true);
        const { uri, hash: feedbackHash } = await uploadFeedbackMetadata({
          bountyId: params.bountyId || '',
          bountyTitle: params.bountyTitle || '',
          rating: params.rating,
          comment: params.comment,
          deliverableCID: params.deliverableCID,
        });
        setFeedbackURI(uri);
        setIsUploading(false);

        // Step 2: Convert rating to int128 format
        const { value, decimals } = ratingToInt128(params.rating);

        // Step 3: Call giveFeedback on contract
        writeContract({
          address: CONTRACTS.REPUTATION_REGISTRY as Address,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'giveFeedback',
          args: [
            params.agentId,
            value,
            decimals,
            params.tag1 || 'bounty',
            params.tag2 || 'clawork',
            params.endpoint || '',
            uri,
            feedbackHash,
          ],
        });
      } catch (error) {
        setIsUploading(false);
        setUploadError(error instanceof Error ? error : new Error('Upload failed'));
        throw error;
      }
    },
    [writeContract, resetWrite]
  );

  const isPending = isUploading || isWritePending;
  const error = uploadError || writeError;

  return {
    giveFeedback,
    hash,
    feedbackURI,
    isPending,
    isUploading,
    isWritePending,
    isConfirming,
    isConfirmed,
    error,
    reset: () => {
      setUploadError(null);
      setFeedbackURI(null);
      resetWrite();
    },
  };
}

/**
 * Hook for appending response to feedback
 */
export function useAppendResponse() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [responseURI, setResponseURI] = useState<string | null>(null);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash });

  const appendResponse = useCallback(
    async (params: AppendResponseParams): Promise<void> => {
      setUploadError(null);
      setResponseURI(null);
      resetWrite();

      try {
        // Step 1: Upload response metadata to IPFS
        setIsUploading(true);
        const { uri, hash: responseHash } = await uploadResponseMetadata({
          response: params.response,
          feedbackCID: params.feedbackCID,
        });
        setResponseURI(uri);
        setIsUploading(false);

        // Step 2: Call appendResponse on contract
        writeContract({
          address: CONTRACTS.REPUTATION_REGISTRY as Address,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'appendResponse',
          args: [
            params.agentId,
            params.clientAddress,
            params.feedbackIndex,
            uri,
            responseHash,
          ],
        });
      } catch (error) {
        setIsUploading(false);
        setUploadError(error instanceof Error ? error : new Error('Upload failed'));
        throw error;
      }
    },
    [writeContract, resetWrite]
  );

  const isPending = isUploading || isWritePending;
  const error = uploadError || writeError;

  return {
    appendResponse,
    hash,
    responseURI,
    isPending,
    isUploading,
    isWritePending,
    isConfirming,
    isConfirmed,
    error,
    reset: () => {
      setUploadError(null);
      setResponseURI(null);
      resetWrite();
    },
  };
}

/**
 * Hook for fetching reputation summary
 */
export function useReputationSummary(
  agentId: bigint | undefined,
  clientAddresses?: Address[],
  tag1?: string,
  tag2?: string
) {
  const publicClient = usePublicClient();
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!agentId || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.REPUTATION_REGISTRY as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getSummary',
        args: [agentId, clientAddresses || [], tag1 || '', tag2 || ''],
      });

      const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];
      setSummary({ count, summaryValue, summaryValueDecimals });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch summary'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, clientAddresses, tag1, tag2, publicClient]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    averageRating: summary ? int128ToRating(summary.summaryValue, summary.summaryValueDecimals) : null,
    isLoading,
    error,
    refetch: fetchSummary,
  };
}

/**
 * Hook for fetching feedback clients
 */
export function useFeedbackClients(agentId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [clients, setClients] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchClients = useCallback(async () => {
    if (!agentId || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.REPUTATION_REGISTRY as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getClients',
        args: [agentId],
      });

      setClients(result as Address[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch clients'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, publicClient]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    isLoading,
    error,
    refetch: fetchClients,
  };
}

/**
 * Hook for reading a specific feedback entry
 */
export function useFeedbackEntry(
  agentId: bigint | undefined,
  clientAddress: Address | undefined,
  index: bigint | undefined
) {
  const publicClient = usePublicClient();
  const [feedback, setFeedback] = useState<FeedbackEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeedback = useCallback(async () => {
    if (!agentId || !clientAddress || index === undefined || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.REPUTATION_REGISTRY as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'readFeedback',
        args: [agentId, clientAddress, index],
      });

      const [
        value,
        valueDecimals,
        tag1,
        tag2,
        endpoint,
        feedbackURI,
        feedbackHash,
        timestamp,
        responseURI,
        responseHash,
      ] = result as [bigint, number, string, string, string, string, `0x${string}`, bigint, string, `0x${string}`];

      setFeedback({
        clientAddress,
        index,
        value,
        valueDecimals,
        tag1,
        tag2,
        endpoint,
        feedbackURI,
        feedbackHash,
        timestamp,
        responseURI,
        responseHash,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch feedback'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, clientAddress, index, publicClient]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  return {
    feedback,
    rating: feedback ? int128ToRating(feedback.value, feedback.valueDecimals) : null,
    isLoading,
    error,
    refetch: fetchFeedback,
  };
}

/**
 * Hook for getting all feedback for an agent
 */
export function useAgentFeedbackHistory(agentId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllFeedback = useCallback(async () => {
    if (!agentId || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      // First get all clients
      const clients = await publicClient.readContract({
        address: CONTRACTS.REPUTATION_REGISTRY as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getClients',
        args: [agentId],
      }) as Address[];

      const allFeedback: FeedbackEntry[] = [];

      // For each client, get their feedback count and entries
      for (const clientAddress of clients) {
        try {
          const lastIndex = await publicClient.readContract({
            address: CONTRACTS.REPUTATION_REGISTRY as Address,
            abi: REPUTATION_REGISTRY_ABI,
            functionName: 'getLastIndex',
            args: [agentId, clientAddress],
          }) as bigint;

          // Fetch each feedback entry (indices are 0-based)
          for (let i = 0n; i <= lastIndex; i++) {
            try {
              const result = await publicClient.readContract({
                address: CONTRACTS.REPUTATION_REGISTRY as Address,
                abi: REPUTATION_REGISTRY_ABI,
                functionName: 'readFeedback',
                args: [agentId, clientAddress, i],
              });

              const [
                value,
                valueDecimals,
                tag1,
                tag2,
                endpoint,
                feedbackURI,
                feedbackHash,
                timestamp,
                responseURI,
                responseHash,
              ] = result as [bigint, number, string, string, string, string, `0x${string}`, bigint, string, `0x${string}`];

              allFeedback.push({
                clientAddress,
                index: i,
                value,
                valueDecimals,
                tag1,
                tag2,
                endpoint,
                feedbackURI,
                feedbackHash,
                timestamp,
                responseURI,
                responseHash,
              });
            } catch (err) {
              // Skip individual feedback errors
              console.warn(`Failed to fetch feedback ${i} from ${clientAddress}:`, err);
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch feedback count for ${clientAddress}:`, err);
        }
      }

      // Sort by timestamp descending
      allFeedback.sort((a, b) => Number(b.timestamp - a.timestamp));
      setFeedbackList(allFeedback);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch feedback history'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, publicClient]);

  useEffect(() => {
    fetchAllFeedback();
  }, [fetchAllFeedback]);

  return {
    feedbackList,
    isLoading,
    error,
    refetch: fetchAllFeedback,
  };
}

'use client';

/**
 * useIdentityRegistry Hook
 *
 * React hooks for interacting with the ERC-8004 Identity Registry contract.
 * Provides functions for:
 * - Registering new agent identities (minting NFTs)
 * - Updating agent URIs
 * - Setting delegated wallets
 * - Reading agent metadata
 */

import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from 'wagmi';
import { type Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { IDENTITY_REGISTRY_ABI } from '@/lib/contracts/abis/identityRegistry';
import { uploadAgentManifest } from '@/lib/services/ipfs';

// ============================================================================
// Types
// ============================================================================

export interface RegisterIdentityParams {
  name: string;
  skills: string[];
  description?: string;
}

export interface RegisterIdentityResult {
  agentId: bigint;
  txHash: `0x${string}`;
  agentURI: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for registering a new agent identity (minting ERC-8004 NFT)
 */
export function useRegisterIdentity() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [agentURI, setAgentURI] = useState<string | null>(null);

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
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const register = useCallback(
    async (params: RegisterIdentityParams): Promise<void> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      setUploadError(null);
      setAgentURI(null);
      resetWrite();

      try {
        // Step 1: Upload manifest to IPFS
        setIsUploading(true);
        const { uri } = await uploadAgentManifest({
          name: params.name,
          skills: params.skills,
          description: params.description,
          walletAddress: address,
        });
        setAgentURI(uri);
        setIsUploading(false);

        // Step 2: Call register function on contract
        writeContract({
          address: CONTRACTS.IDENTITY_REGISTRY as Address,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [uri],
        });
      } catch (error) {
        setIsUploading(false);
        setUploadError(error instanceof Error ? error : new Error('Upload failed'));
        throw error;
      }
    },
    [address, writeContract, resetWrite]
  );

  // Extract agentId from transaction receipt
  const getAgentIdFromReceipt = useCallback((): bigint | null => {
    if (!receipt?.logs) return null;

    // Look for Transfer event (ERC-721) or Registered event
    for (const log of receipt.logs) {
      // Transfer event has tokenId as the third topic
      if (log.topics.length >= 4) {
        const tokenId = BigInt(log.topics[3] as string);
        return tokenId;
      }
    }
    return null;
  }, [receipt]);

  const isPending = isUploading || isWritePending;
  const error = uploadError || writeError;

  return {
    register,
    hash,
    agentURI,
    agentId: getAgentIdFromReceipt(),
    isPending,
    isUploading,
    isWritePending,
    isConfirming,
    isConfirmed,
    error,
    reset: () => {
      setUploadError(null);
      setAgentURI(null);
      resetWrite();
    },
  };
}

/**
 * Hook for updating agent URI
 */
export function useSetAgentURI() {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const setAgentURI = useCallback(
    (agentId: bigint, newURI: string) => {
      writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentURI',
        args: [agentId, newURI],
      });
    },
    [writeContract]
  );

  return {
    setAgentURI,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

/**
 * Hook for setting agent wallet (delegation)
 */
export function useSetAgentWallet() {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const setAgentWallet = useCallback(
    (
      agentId: bigint,
      newWallet: Address,
      deadline: bigint,
      signature: `0x${string}`
    ) => {
      writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentWallet',
        args: [agentId, newWallet, deadline, signature],
      });
    },
    [writeContract]
  );

  return {
    setAgentWallet,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

/**
 * Hook for reading agent wallet
 */
export function useAgentWallet(agentId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [wallet, setWallet] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!agentId || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getAgentWallet',
        args: [agentId],
      });
      setWallet(result as Address);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch wallet'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, publicClient]);

  return {
    wallet,
    isLoading,
    error,
    refetch: fetchWallet,
  };
}

/**
 * Hook for reading agent URI
 */
export function useAgentURI(agentId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [uri, setUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchURI = useCallback(async () => {
    if (!agentId || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'agentURI',
        args: [agentId],
      });
      setUri(result as string);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch URI'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, publicClient]);

  return {
    uri,
    isLoading,
    error,
    refetch: fetchURI,
  };
}

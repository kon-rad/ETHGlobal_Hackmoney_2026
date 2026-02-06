'use client';

/**
 * useValidationRegistry Hook
 *
 * React hooks for interacting with the ERC-8004 Validation Registry contract.
 * Provides functions for:
 * - Requesting validation from third-party validators
 * - Responding to validation requests (for validators)
 * - Reading validation status
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { type Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { VALIDATION_REGISTRY_ABI } from '@/lib/contracts/abis/validationRegistry';
import { uploadToIPFS, computeHash } from '@/lib/services/ipfs';

// ============================================================================
// Types
// ============================================================================

export interface ValidationRequestParams {
  agentId: bigint;
  validator: Address;
  validationType: string;
  requestData?: object;
}

export interface ValidationResponseParams {
  requestId: bigint;
  approved: boolean;
  responseData?: object;
}

export enum ValidationStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Cancelled = 3,
}

export interface ValidationInfo {
  agentId: bigint;
  validator: Address;
  validationType: string;
  status: ValidationStatus;
  requestURI: string;
  responseURI: string;
  requestedAt: bigint;
  respondedAt: bigint;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for requesting validation from a third-party validator
 */
export function useValidationRequest() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [requestURI, setRequestURI] = useState<string | null>(null);

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

  const requestValidation = useCallback(
    async (params: ValidationRequestParams): Promise<void> => {
      setUploadError(null);
      setRequestURI(null);
      resetWrite();

      try {
        // Upload request data to IPFS if provided
        setIsUploading(true);
        let uri = '';
        let requestHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

        if (params.requestData) {
          const result = await uploadToIPFS(params.requestData, `validation-request-${Date.now()}`);
          uri = result.uri;
          requestHash = result.hash;
        }

        setRequestURI(uri);
        setIsUploading(false);

        // Call validationRequest on contract
        writeContract({
          address: CONTRACTS.VALIDATION_REGISTRY as Address,
          abi: VALIDATION_REGISTRY_ABI,
          functionName: 'validationRequest',
          args: [
            params.agentId,
            params.validator,
            params.validationType,
            uri,
            requestHash,
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
    requestValidation,
    hash,
    requestURI,
    isPending,
    isUploading,
    isWritePending,
    isConfirming,
    isConfirmed,
    error,
    reset: () => {
      setUploadError(null);
      setRequestURI(null);
      resetWrite();
    },
  };
}

/**
 * Hook for responding to validation requests (for validators)
 */
export function useValidationResponse() {
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

  const respondToValidation = useCallback(
    async (params: ValidationResponseParams): Promise<void> => {
      setUploadError(null);
      setResponseURI(null);
      resetWrite();

      try {
        // Upload response data to IPFS if provided
        setIsUploading(true);
        let uri = '';
        let responseHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

        if (params.responseData) {
          const result = await uploadToIPFS(params.responseData, `validation-response-${Date.now()}`);
          uri = result.uri;
          responseHash = result.hash;
        }

        setResponseURI(uri);
        setIsUploading(false);

        // Call validationResponse on contract
        writeContract({
          address: CONTRACTS.VALIDATION_REGISTRY as Address,
          abi: VALIDATION_REGISTRY_ABI,
          functionName: 'validationResponse',
          args: [params.requestId, params.approved, uri, responseHash],
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
    respondToValidation,
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
 * Hook for cancelling a validation request
 */
export function useCancelValidationRequest() {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const cancelRequest = useCallback(
    (requestId: bigint) => {
      writeContract({
        address: CONTRACTS.VALIDATION_REGISTRY as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'cancelValidationRequest',
        args: [requestId],
      });
    },
    [writeContract]
  );

  return {
    cancelRequest,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

/**
 * Hook for fetching validation status
 */
export function useValidationStatus(requestId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [validation, setValidation] = useState<ValidationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (requestId === undefined || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.VALIDATION_REGISTRY as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'getValidationStatus',
        args: [requestId],
      });

      const [
        agentId,
        validator,
        validationType,
        status,
        requestURI,
        responseURI,
        requestedAt,
        respondedAt,
      ] = result as [bigint, Address, string, number, string, string, bigint, bigint];

      setValidation({
        agentId,
        validator,
        validationType,
        status: status as ValidationStatus,
        requestURI,
        responseURI,
        requestedAt,
        respondedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch validation status'));
    } finally {
      setIsLoading(false);
    }
  }, [requestId, publicClient]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    validation,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

/**
 * Hook for fetching all validations for an agent
 */
export function useAgentValidations(agentId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [requestIds, setRequestIds] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchValidations = useCallback(async () => {
    if (agentId === undefined || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.VALIDATION_REGISTRY as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'getAgentValidations',
        args: [agentId],
      });

      setRequestIds(result as bigint[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch agent validations'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, publicClient]);

  useEffect(() => {
    fetchValidations();
  }, [fetchValidations]);

  return {
    requestIds,
    isLoading,
    error,
    refetch: fetchValidations,
  };
}

/**
 * Hook to check if agent has a specific validation
 */
export function useHasValidation(
  agentId: bigint | undefined,
  validationType: string | undefined,
  validator: Address | undefined
) {
  const publicClient = usePublicClient();
  const [hasValidation, setHasValidation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkValidation = useCallback(async () => {
    if (agentId === undefined || !validationType || !validator || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.VALIDATION_REGISTRY as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'hasValidation',
        args: [agentId, validationType, validator],
      });

      setHasValidation(result as boolean);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check validation'));
    } finally {
      setIsLoading(false);
    }
  }, [agentId, validationType, validator, publicClient]);

  useEffect(() => {
    checkValidation();
  }, [checkValidation]);

  return {
    hasValidation,
    isLoading,
    error,
    refetch: checkValidation,
  };
}

/**
 * Hook for fetching pending validation requests for a validator
 */
export function usePendingValidationRequests(validator: Address | undefined) {
  const publicClient = usePublicClient();
  const [requestIds, setRequestIds] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPending = useCallback(async () => {
    if (!validator || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.VALIDATION_REGISTRY as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'getPendingRequests',
        args: [validator],
      });

      setRequestIds(result as bigint[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending requests'));
    } finally {
      setIsLoading(false);
    }
  }, [validator, publicClient]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return {
    requestIds,
    isLoading,
    error,
    refetch: fetchPending,
  };
}

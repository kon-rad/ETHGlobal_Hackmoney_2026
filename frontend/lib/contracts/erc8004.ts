import { createPublicClient, http, type Address } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { CONTRACTS, POLYGON_AMOY_RPC } from './addresses';
import { IDENTITY_REGISTRY_ABI } from './abis/identityRegistry';
import { REPUTATION_REGISTRY_ABI } from './abis/reputationRegistry';
import { VALIDATION_REGISTRY_ABI } from './abis/validationRegistry';

// Public client for read operations (server-side or client-side)
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(POLYGON_AMOY_RPC),
});

// Check if address has an agent identity and return the token ID
export async function getAgentId(address: Address): Promise<bigint | null> {
  try {
    const balance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (balance === 0n) return null;

    const tokenId = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, 0n],
    });

    return tokenId;
  } catch (error) {
    console.error('Error getting agent ID:', error);
    return null;
  }
}

// Check if address is registered
export async function isRegistered(address: Address): Promise<boolean> {
  const agentId = await getAgentId(address);
  return agentId !== null;
}

// Get total registered agents
export async function getTotalAgents(): Promise<bigint> {
  try {
    const total = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'totalSupply',
    });
    return total;
  } catch (error) {
    console.error('Error getting total agents:', error);
    return 0n;
  }
}

// Get agent reputation
export async function getAgentReputation(agentId: bigint): Promise<{
  score: bigint;
  totalFeedback: bigint;
} | null> {
  try {
    const [score, totalFeedback] = await publicClient.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getReputation',
      args: [agentId],
    });
    return { score, totalFeedback };
  } catch (error) {
    console.error('Error getting reputation:', error);
    return null;
  }
}

// Get agent feedback history
export async function getAgentFeedback(agentId: bigint): Promise<
  Array<{
    from: Address;
    rating: number;
    comment: string;
    timestamp: bigint;
  }>
> {
  try {
    const feedback = await publicClient.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getFeedback',
      args: [agentId],
    });
    return feedback as Array<{
      from: Address;
      rating: number;
      comment: string;
      timestamp: bigint;
    }>;
  } catch (error) {
    console.error('Error getting feedback:', error);
    return [];
  }
}

// ============================================================================
// Validation Registry Functions
// ============================================================================

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

// Get validation status by request ID
export async function getValidationStatus(requestId: bigint): Promise<ValidationInfo | null> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.VALIDATION_REGISTRY,
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

    return {
      agentId,
      validator,
      validationType,
      status: status as ValidationStatus,
      requestURI,
      responseURI,
      requestedAt,
      respondedAt,
    };
  } catch (error) {
    console.error('Error getting validation status:', error);
    return null;
  }
}

// Get all validation request IDs for an agent
export async function getAgentValidations(agentId: bigint): Promise<bigint[]> {
  try {
    const requestIds = await publicClient.readContract({
      address: CONTRACTS.VALIDATION_REGISTRY,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: 'getAgentValidations',
      args: [agentId],
    });
    return requestIds as bigint[];
  } catch (error) {
    console.error('Error getting agent validations:', error);
    return [];
  }
}

// Check if agent has a specific validation from a validator
export async function hasValidation(
  agentId: bigint,
  validationType: string,
  validator: Address
): Promise<boolean> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.VALIDATION_REGISTRY,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: 'hasValidation',
      args: [agentId, validationType, validator],
    });
    return result as boolean;
  } catch (error) {
    console.error('Error checking validation:', error);
    return false;
  }
}

// Get agent URI from identity registry
export async function getAgentURI(agentId: bigint): Promise<string | null> {
  try {
    const uri = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'agentURI',
      args: [agentId],
    });
    return uri as string;
  } catch (error) {
    console.error('Error getting agent URI:', error);
    return null;
  }
}

// Get delegated wallet for an agent
export async function getAgentWallet(agentId: bigint): Promise<Address | null> {
  try {
    const wallet = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [agentId],
    });
    return wallet as Address;
  } catch (error) {
    console.error('Error getting agent wallet:', error);
    return null;
  }
}

// Get reputation summary with optional filters
export async function getReputationSummary(
  agentId: bigint,
  clientAddresses: Address[] = [],
  tag1: string = '',
  tag2: string = ''
): Promise<{
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
} | null> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [agentId, clientAddresses, tag1, tag2],
    });

    const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];
    return { count, summaryValue, summaryValueDecimals };
  } catch (error) {
    console.error('Error getting reputation summary:', error);
    return null;
  }
}

import { createPublicClient, http, type Address } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { CONTRACTS, POLYGON_AMOY_RPC } from './addresses';
import { IDENTITY_REGISTRY_ABI } from './abis/identityRegistry';
import { REPUTATION_REGISTRY_ABI } from './abis/reputationRegistry';

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

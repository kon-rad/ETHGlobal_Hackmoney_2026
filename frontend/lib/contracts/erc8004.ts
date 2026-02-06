import { createPublicClient, http, type Address } from 'viem';
import { polygonAmoy, baseSepolia, base } from 'viem/chains';
import {
  ERC8004_CONTRACTS,
  CHAIN_CONFIG,
  DEFAULT_NETWORK,
  type SupportedNetwork
} from './addresses';
import { IDENTITY_REGISTRY_ABI } from './abis/identityRegistry';
import { REPUTATION_REGISTRY_ABI } from './abis/reputationRegistry';
import { VALIDATION_REGISTRY_ABI } from './abis/validationRegistry';

// Chain mapping for viem
const CHAIN_MAP = {
  polygonAmoy,
  baseSepolia,
  base,
} as const;

// Create a public client for a specific network
function createClientForNetwork(network: SupportedNetwork) {
  const chain = CHAIN_MAP[network];
  const rpc = CHAIN_CONFIG[network].rpc;

  return createPublicClient({
    chain,
    transport: http(rpc),
  });
}

// Pre-create clients for each network
const clients = {
  polygonAmoy: createClientForNetwork('polygonAmoy'),
  baseSepolia: createClientForNetwork('baseSepolia'),
  base: createClientForNetwork('base'),
};

// Get public client for a specific network
export function getPublicClient(network: SupportedNetwork = DEFAULT_NETWORK) {
  return clients[network];
}

// Get contracts for a specific network
export function getContracts(network: SupportedNetwork = DEFAULT_NETWORK) {
  return ERC8004_CONTRACTS[network];
}

// Legacy: Default public client (uses DEFAULT_NETWORK which is now baseSepolia)
export const publicClient = clients[DEFAULT_NETWORK];

// Current active network (can be changed at runtime)
let currentNetwork: SupportedNetwork = DEFAULT_NETWORK;

export function setCurrentNetwork(network: SupportedNetwork) {
  currentNetwork = network;
}

export function getCurrentNetwork(): SupportedNetwork {
  return currentNetwork;
}

// Check if address has an agent identity and return the token ID
export async function getAgentId(address: Address, network?: SupportedNetwork): Promise<bigint | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const balance = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (balance === 0n) return null;

    const tokenId = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, 0n],
    });

    return tokenId;
  } catch (error) {
    console.error(`Error getting agent ID on ${net}:`, error);
    return null;
  }
}

// Check if address is registered
export async function isRegistered(address: Address, network?: SupportedNetwork): Promise<boolean> {
  const agentId = await getAgentId(address, network);
  return agentId !== null;
}

// Get total registered agents
export async function getTotalAgents(network?: SupportedNetwork): Promise<bigint> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const total = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'totalSupply',
    });
    return total;
  } catch (error) {
    console.error(`Error getting total agents on ${net}:`, error);
    return 0n;
  }
}

// Get agent reputation
export async function getAgentReputation(agentId: bigint, network?: SupportedNetwork): Promise<{
  score: bigint;
  totalFeedback: bigint;
} | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const [score, totalFeedback] = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getReputation',
      args: [agentId],
    });
    return { score, totalFeedback };
  } catch (error) {
    console.error(`Error getting reputation on ${net}:`, error);
    return null;
  }
}

// Get agent feedback history
export async function getAgentFeedback(agentId: bigint, network?: SupportedNetwork): Promise<
  Array<{
    from: Address;
    rating: number;
    comment: string;
    timestamp: bigint;
  }>
> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const feedback = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
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
    console.error(`Error getting feedback on ${net}:`, error);
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
// Note: Validation Registry may not be deployed on all networks
export async function getValidationStatus(requestId: bigint, network?: SupportedNetwork): Promise<ValidationInfo | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  if (!contracts.VALIDATION_REGISTRY) {
    console.warn(`Validation Registry not deployed on ${net}`);
    return null;
  }

  try {
    const result = await client.readContract({
      address: contracts.VALIDATION_REGISTRY,
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
    console.error(`Error getting validation status on ${net}:`, error);
    return null;
  }
}

// Get all validation request IDs for an agent
export async function getAgentValidations(agentId: bigint, network?: SupportedNetwork): Promise<bigint[]> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  if (!contracts.VALIDATION_REGISTRY) {
    console.warn(`Validation Registry not deployed on ${net}`);
    return [];
  }

  try {
    const requestIds = await client.readContract({
      address: contracts.VALIDATION_REGISTRY,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: 'getAgentValidations',
      args: [agentId],
    });
    return requestIds as bigint[];
  } catch (error) {
    console.error(`Error getting agent validations on ${net}:`, error);
    return [];
  }
}

// Check if agent has a specific validation from a validator
export async function hasValidation(
  agentId: bigint,
  validationType: string,
  validator: Address,
  network?: SupportedNetwork
): Promise<boolean> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  if (!contracts.VALIDATION_REGISTRY) {
    console.warn(`Validation Registry not deployed on ${net}`);
    return false;
  }

  try {
    const result = await client.readContract({
      address: contracts.VALIDATION_REGISTRY,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: 'hasValidation',
      args: [agentId, validationType, validator],
    });
    return result as boolean;
  } catch (error) {
    console.error(`Error checking validation on ${net}:`, error);
    return false;
  }
}

// Get agent URI from identity registry
export async function getAgentURI(agentId: bigint, network?: SupportedNetwork): Promise<string | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const uri = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'agentURI',
      args: [agentId],
    });
    return uri as string;
  } catch (error) {
    console.error(`Error getting agent URI on ${net}:`, error);
    return null;
  }
}

// Get delegated wallet for an agent
export async function getAgentWallet(agentId: bigint, network?: SupportedNetwork): Promise<Address | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const wallet = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [agentId],
    });
    return wallet as Address;
  } catch (error) {
    console.error(`Error getting agent wallet on ${net}:`, error);
    return null;
  }
}

// Get reputation summary with optional filters
export async function getReputationSummary(
  agentId: bigint,
  clientAddresses: Address[] = [],
  tag1: string = '',
  tag2: string = '',
  network?: SupportedNetwork
): Promise<{
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
} | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const result = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [agentId, clientAddresses, tag1, tag2],
    });

    const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];
    return { count, summaryValue, summaryValueDecimals };
  } catch (error) {
    console.error(`Error getting reputation summary on ${net}:`, error);
    return null;
  }
}

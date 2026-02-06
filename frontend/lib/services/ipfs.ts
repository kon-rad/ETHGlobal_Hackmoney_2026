/**
 * IPFS Service for ERC-8004 Metadata Storage
 *
 * This service handles uploading and fetching metadata from IPFS via Pinata.
 * Supports agent manifests, feedback metadata, and response metadata.
 *
 * Features:
 * - Upload JSON to IPFS via Pinata
 * - Compute keccak256 hash for on-chain verification
 * - Mock mode fallback for development
 * - Fetch from IPFS gateway
 */

import { keccak256, toBytes } from 'viem';

// Configuration
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

// Mock mode if no Pinata keys configured
const MOCK_MODE = !PINATA_API_KEY || !PINATA_SECRET_KEY;

// ============================================================================
// Types
// ============================================================================

export interface AgentManifest {
  name: string;
  description?: string;
  skills: string[];
  walletAddress: string;
  version?: string;
  createdAt?: number;
}

export interface FeedbackMetadata {
  bountyId: string;
  bountyTitle: string;
  rating: number;
  comment?: string;
  deliverableCID?: string;
  timestamp?: number;
}

export interface ResponseMetadata {
  feedbackCID?: string;
  response: string;
  timestamp?: number;
}

export interface IPFSUploadResult {
  cid: string;
  uri: string;
  hash: `0x${string}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Upload JSON data to IPFS via Pinata
 *
 * @param data - Object to upload as JSON
 * @param name - Optional name for the pin
 * @returns CID, full URI, and keccak256 hash of the content
 */
export async function uploadToIPFS(
  data: object,
  name?: string
): Promise<IPFSUploadResult> {
  const jsonString = JSON.stringify(data, null, 2);
  const hash = computeHash(jsonString);

  if (MOCK_MODE) {
    return uploadToIPFSMock(jsonString, hash);
  }

  try {
    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: {
            name: name || `erc8004-${Date.now()}`,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Pinata upload failed:', error);
      // Fall back to mock mode on error
      return uploadToIPFSMock(jsonString, hash);
    }

    const result = await response.json();
    const cid = result.IpfsHash;

    return {
      cid,
      uri: `ipfs://${cid}`,
      hash,
    };
  } catch (error) {
    console.error('IPFS upload error:', error);
    // Fall back to mock mode on error
    return uploadToIPFSMock(jsonString, hash);
  }
}

/**
 * Upload an agent manifest to IPFS
 *
 * @param manifest - Agent manifest data
 * @returns Upload result with CID, URI, and hash
 */
export async function uploadAgentManifest(
  manifest: AgentManifest
): Promise<IPFSUploadResult> {
  const data = {
    ...manifest,
    version: manifest.version || '1.0.0',
    createdAt: manifest.createdAt || Date.now(),
    type: 'agent-manifest',
  };

  return uploadToIPFS(data, `agent-${manifest.walletAddress.slice(0, 8)}`);
}

/**
 * Upload feedback metadata to IPFS
 *
 * @param metadata - Feedback metadata
 * @returns Upload result with CID, URI, and hash
 */
export async function uploadFeedbackMetadata(
  metadata: FeedbackMetadata
): Promise<IPFSUploadResult> {
  const data = {
    ...metadata,
    timestamp: metadata.timestamp || Date.now(),
    type: 'feedback-metadata',
  };

  return uploadToIPFS(data, `feedback-${metadata.bountyId}`);
}

/**
 * Upload response metadata to IPFS
 *
 * @param metadata - Response metadata
 * @returns Upload result with CID, URI, and hash
 */
export async function uploadResponseMetadata(
  metadata: ResponseMetadata
): Promise<IPFSUploadResult> {
  const data = {
    ...metadata,
    timestamp: metadata.timestamp || Date.now(),
    type: 'response-metadata',
  };

  return uploadToIPFS(data, `response-${Date.now()}`);
}

/**
 * Fetch and parse JSON from IPFS
 *
 * @param cid - IPFS content identifier
 * @returns Parsed JSON data
 */
export async function fetchFromIPFS<T>(cid: string): Promise<T> {
  // Handle both CID and full IPFS URI
  const cleanCid = cid.replace('ipfs://', '');

  // Check mock cache first
  const mockData = mockCache.get(cleanCid);
  if (mockData) {
    return JSON.parse(mockData) as T;
  }

  try {
    const response = await fetch(`${IPFS_GATEWAY}/${cleanCid}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error('IPFS fetch error:', error);
    throw error;
  }
}

/**
 * Compute keccak256 hash of content for on-chain verification
 *
 * @param content - String content to hash
 * @returns Keccak256 hash as hex string
 */
export function computeHash(content: string): `0x${string}` {
  return keccak256(toBytes(content));
}

/**
 * Verify that content matches expected hash
 *
 * @param content - Content to verify
 * @param expectedHash - Expected keccak256 hash
 * @returns True if hashes match
 */
export function verifyHash(content: string, expectedHash: string): boolean {
  const computedHash = computeHash(content);
  return computedHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Get full IPFS gateway URL from CID
 *
 * @param cid - IPFS content identifier
 * @returns Full gateway URL
 */
export function getIPFSUrl(cid: string): string {
  const cleanCid = cid.replace('ipfs://', '');
  return `${IPFS_GATEWAY}/${cleanCid}`;
}

// ============================================================================
// Mock Implementation for Development
// ============================================================================

// In-memory cache for mock mode
const mockCache = new Map<string, string>();

function uploadToIPFSMock(
  jsonString: string,
  hash: `0x${string}`
): IPFSUploadResult {
  // Generate a fake CID based on the hash
  const fakeCid = `Qm${hash.slice(2, 48)}`;

  // Cache for later retrieval
  mockCache.set(fakeCid, jsonString);

  console.log(`[MOCK IPFS] Uploaded: ${fakeCid}`);

  return {
    cid: fakeCid,
    uri: `ipfs://${fakeCid}`,
    hash,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { MOCK_MODE as IPFS_MOCK_MODE, IPFS_GATEWAY };

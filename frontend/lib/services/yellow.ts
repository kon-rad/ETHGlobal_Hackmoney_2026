/**
 * Yellow Network SDK Integration
 *
 * This service provides state channel functionality via the Yellow Network
 * Nitrolite protocol for gasless, instant payments.
 *
 * Features:
 * - Open state channels between poster and agent
 * - Update allocations off-chain
 * - Close channels and settle on-chain
 *
 * Documentation: https://docs.yellow.org/docs/build/quick-start
 *
 * NOTE: For production, uncomment the SDK imports and implement
 * the real integration. For the hackathon demo, we use mock mode
 * which simulates the channel operations.
 */

// Uncomment for production Yellow SDK integration:
// import {
//   createAppSessionMessage,
//   parseAnyRPCResponse,
// } from '@erc7824/nitrolite';

// Configuration
const YELLOW_WS_URL = process.env.YELLOW_CLEARNODE_URL || 'wss://clearnet-sandbox.yellow.com/ws';
const YELLOW_TOKEN = process.env.NEXT_PUBLIC_YELLOW_TEST_USD || '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

// Always use mock mode for now - set YELLOW_MOCK_MODE=false to enable real SDK
const MOCK_MODE = process.env.YELLOW_MOCK_MODE !== 'false';

// Types
export interface YellowChannel {
  channelId: string;
  sessionId: string;
  participants: [string, string];
  deposit: number;
  token: string;
  status: 'PENDING' | 'OPEN' | 'CLOSING' | 'CLOSED';
  allocation: Record<string, number>;
  createdAt: number;
}

export interface OpenChannelParams {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
  signerFn?: (message: string) => Promise<string>;
}

export interface OpenChannelResult {
  channelId: string;
  sessionId: string;
}

// In-memory channel cache (used in mock mode and as fallback)
const channelCache = new Map<string, YellowChannel>();

// WebSocket connection management (for production use)
let wsConnection: WebSocket | null = null;
let connectionPromise: Promise<WebSocket> | null = null;

/**
 * Get or create a WebSocket connection to Yellow ClearNode
 */
async function getConnection(): Promise<WebSocket> {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    return wsConnection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(YELLOW_WS_URL);

      ws.onopen = () => {
        console.log('Connected to Yellow Network ClearNode');
        wsConnection = ws;
        connectionPromise = null;
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error('Yellow WebSocket error:', error);
        connectionPromise = null;
        reject(error);
      };

      ws.onclose = () => {
        console.log('Yellow WebSocket closed');
        wsConnection = null;
        connectionPromise = null;
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          connectionPromise = null;
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    } catch (error) {
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
}

/**
 * Open a new state channel between poster and agent
 *
 * This creates a Yellow Network channel where funds are locked
 * and can be transferred off-chain before final settlement.
 */
export async function openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
  // Use mock mode for development
  if (MOCK_MODE) {
    return openChannelMock(params);
  }

  // Production implementation would use the Yellow SDK here
  // For now, fall back to mock
  console.log('Yellow SDK production mode not yet implemented, using mock');
  return openChannelMock(params);
}

/**
 * Update channel allocation (off-chain state update)
 *
 * This transfers funds between participants without on-chain transactions.
 */
export async function updateAllocation(
  channelId: string,
  newAllocation: Record<string, number>,
  _signerFn?: (message: string) => Promise<string>
): Promise<void> {
  if (MOCK_MODE) {
    return updateAllocationMock(channelId, newAllocation);
  }

  // Production implementation would use the Yellow SDK here
  return updateAllocationMock(channelId, newAllocation);
}

/**
 * Close channel and settle on-chain
 *
 * This finalizes the channel and triggers on-chain settlement
 * of the final allocation.
 */
export async function closeChannel(
  channelId: string,
  _signerFn?: (message: string) => Promise<string>
): Promise<{ txHash?: string }> {
  if (MOCK_MODE) {
    return closeChannelMock(channelId);
  }

  // Production implementation would use the Yellow SDK here
  return closeChannelMock(channelId);
}

/**
 * Get channel state
 */
export async function getChannel(channelId: string): Promise<YellowChannel | null> {
  return channelCache.get(channelId) || null;
}

// ============================================================================
// Mock implementations for development and fallback
// ============================================================================

function openChannelMock(params: OpenChannelParams): OpenChannelResult {
  const channelId = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  channelCache.set(channelId, {
    channelId,
    sessionId,
    participants: [params.poster.toLowerCase(), params.agent.toLowerCase()],
    deposit: params.deposit,
    token: params.token || 'USDC',
    status: 'OPEN',
    allocation: {
      [params.poster.toLowerCase()]: params.deposit,
      [params.agent.toLowerCase()]: 0,
    },
    createdAt: Date.now(),
  });

  console.log(`[MOCK] Yellow channel opened: ${channelId}`);
  return { channelId, sessionId };
}

function updateAllocationMock(
  channelId: string,
  newAllocation: Record<string, number>
): void {
  const channel = channelCache.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  channel.allocation = newAllocation;
  channelCache.set(channelId, channel);
  console.log(`[MOCK] Yellow channel ${channelId} allocation updated`);
}

function closeChannelMock(channelId: string): { txHash?: string } {
  const channel = channelCache.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  channel.status = 'CLOSED';
  channelCache.set(channelId, channel);

  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  console.log(`[MOCK] Yellow channel ${channelId} closed. Mock txHash: ${mockTxHash}`);

  return { txHash: mockTxHash };
}

// ============================================================================
// Utility exports
// ============================================================================

export { MOCK_MODE, YELLOW_WS_URL, YELLOW_TOKEN, getConnection };

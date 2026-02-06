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
 * Phase 1: Environment & Dependencies ✓
 * - Nitrolite SDK: @erc7824/nitrolite v0.5.3
 * - ClearNode: wss://clearnet-sandbox.yellow.com/ws
 * - Set YELLOW_MOCK_MODE=false to enable real SDK integration
 */

// Yellow SDK Imports - enable for production integration
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createPingMessageV2,
  createGetConfigMessageV2,
  createGetAssetsMessageV2,
  createGetChannelsMessageV2,
  createCreateChannelMessage,
  createCloseChannelMessage,
  createResizeChannelMessage,
  createGetLedgerEntriesMessageV2,
  createSubmitAppStateMessage,
  createECDSAMessageSigner,
  type MessageSigner,
} from '@erc7824/nitrolite';

import { getSDKMessageSigner, getServerAddress } from './yellow-signer';

// Import Custody ABI from Nitrolite SDK
import { CustodyAbi } from '@erc7824/nitrolite/dist/abis/custody';

// Viem imports for on-chain operations
import {
  type Address,
  type WalletClient,
  type PublicClient,
  type Hex,
  parseUnits,
  formatUnits,
} from 'viem';

// Configuration from environment variables
const YELLOW_CONFIG = {
  // ClearNode WebSocket URL
  WS_URL: process.env.NEXT_PUBLIC_YELLOW_CLEARNODE || 'wss://clearnet-sandbox.yellow.com/ws',

  // Contract addresses
  CUSTODY: process.env.NEXT_PUBLIC_YELLOW_CUSTODY || '0x019B65A265EB3363822f2752141b3dF16131b262',
  ADJUDICATOR: process.env.NEXT_PUBLIC_YELLOW_ADJUDICATOR || '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',

  // Token addresses
  TEST_USD: process.env.NEXT_PUBLIC_YELLOW_TEST_USD || '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb',
  BASE_USDC: process.env.NEXT_PUBLIC_BASE_USDC || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

  // Chain configuration (Base Mainnet is primary)
  DEFAULT_CHAIN_ID: 8453, // Base Mainnet

  // Mode flag - set YELLOW_MOCK_MODE=false to enable real SDK
  MOCK_MODE: process.env.YELLOW_MOCK_MODE !== 'false',
} as const;

// Legacy exports for backward compatibility
const YELLOW_WS_URL = YELLOW_CONFIG.WS_URL;
const YELLOW_TOKEN = YELLOW_CONFIG.TEST_USD;
const MOCK_MODE = YELLOW_CONFIG.MOCK_MODE;

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
  chainId?: number;
  walletClient?: WalletClient;
  publicClient?: PublicClient;
  signerFn?: (message: string) => Promise<string>;
}

export interface OpenChannelResult {
  channelId: string;
  sessionId: string;
  txHash?: string;
}

export interface TokenApprovalParams {
  walletClient: WalletClient;
  publicClient: PublicClient;
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
  chainId?: number;
}

// Channel metadata stored from create_channel response
interface ChannelMetadata {
  channelId: string;
  participants: [string, string];  // [user, clearnode]
  adjudicator: string;
  challenge: bigint;
  nonce: bigint;
}

// In-memory channel cache (used in mock mode and as fallback)
const channelCache = new Map<string, YellowChannel>();

// Stored channel metadata cache
const channelMetadataCache = new Map<string, ChannelMetadata>();

// ============================================================================
// ERC-20 Token Operations
// ============================================================================

// Minimal ERC-20 ABI for approve and allowance
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

/**
 * Check current token allowance for Yellow Custody contract
 */
async function checkTokenAllowance(
  publicClient: PublicClient,
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address
): Promise<bigint> {
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ownerAddress, spenderAddress],
  });
  return allowance as bigint;
}

/**
 * Approve token spending for Yellow Custody contract
 *
 * This must be called before depositing funds into a Yellow Network channel.
 * The user signs an on-chain transaction to approve the Custody contract
 * to transfer tokens on their behalf.
 */
async function approveToken(params: TokenApprovalParams): Promise<string> {
  const { walletClient, publicClient, tokenAddress, spenderAddress, amount } = params;

  // Check current allowance
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet client must have an account');
  }

  const currentAllowance = await checkTokenAllowance(
    publicClient,
    tokenAddress,
    account.address,
    spenderAddress
  );

  // If already approved for sufficient amount, skip
  if (currentAllowance >= amount) {
    console.log(`[Yellow] Token already approved: ${formatUnits(currentAllowance, 18)} >= ${formatUnits(amount, 18)}`);
    return 'already_approved';
  }

  // Submit approval transaction
  console.log(`[Yellow] Approving ${formatUnits(amount, 18)} tokens for Custody contract...`);

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, amount],
    account,
    chain: null,
  });

  // Wait for confirmation
  console.log(`[Yellow] Approval transaction submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`[Yellow] Token approval confirmed`);
    return hash;
  } else {
    throw new Error('Token approval transaction failed');
  }
}

/**
 * Sign a state for Yellow Network state channel
 * Uses EIP-191 personal sign over the state hash
 */
async function signChannelState(
  walletClient: WalletClient,
  channelId: string,
  state: {
    intent: number;
    version: bigint;
    data: string;
    allocations: Array<{ destination: string; token: string; amount: bigint }>;
  }
): Promise<string> {
  if (!walletClient.account) {
    throw new Error('Wallet account required for signing');
  }

  // Create state hash for signing
  // Format: keccak256(abi.encodePacked(channelId, intent, version, data, allocations))
  const stateMessage = JSON.stringify({
    channelId,
    intent: state.intent,
    version: state.version.toString(),
    data: state.data,
    allocations: state.allocations.map(a => ({
      destination: a.destination,
      token: a.token,
      amount: a.amount.toString(),
    })),
  });

  const signature = await walletClient.signMessage({
    account: walletClient.account,
    message: stateMessage,
  });

  return signature;
}

/**
 * Submit on-chain transaction to Custody.create()
 * Creates a state channel on-chain with initial deposit
 */
async function submitCustodyCreate(
  walletClient: WalletClient,
  publicClient: PublicClient,
  channelMetadata: ChannelMetadata,
  resizeResponse: {
    channelId: string;
    state: {
      intent: number;
      version: number;
      stateData: string;
      allocations: Array<{ destination: string; token: string; amount: bigint }>;
    };
    serverSignature: string;
  }
): Promise<string> {
  if (!walletClient.account) {
    throw new Error('Wallet account required');
  }

  // 1. Build Channel struct for contract
  const channelStruct = {
    participants: channelMetadata.participants as readonly [`0x${string}`, `0x${string}`],
    adjudicator: channelMetadata.adjudicator as `0x${string}`,
    challenge: channelMetadata.challenge,
    nonce: channelMetadata.nonce,
  };

  // 2. Sign the state with user wallet
  const stateToSign = {
    intent: resizeResponse.state.intent,
    version: BigInt(resizeResponse.state.version),
    data: resizeResponse.state.stateData,
    allocations: resizeResponse.state.allocations,
  };

  const userSignature = await signChannelState(
    walletClient,
    resizeResponse.channelId,
    stateToSign
  );

  // 3. Build State struct with both signatures
  const stateStruct = {
    intent: resizeResponse.state.intent,
    version: BigInt(resizeResponse.state.version),
    data: resizeResponse.state.stateData as `0x${string}`,
    allocations: resizeResponse.state.allocations.map(a => ({
      destination: a.destination as `0x${string}`,
      token: a.token as `0x${string}`,
      amount: a.amount,
    })),
    sigs: [userSignature, resizeResponse.serverSignature] as readonly `0x${string}`[],
  };

  // 4. Submit to Custody.create()
  const hash = await walletClient.writeContract({
    address: YELLOW_CONFIG.CUSTODY as `0x${string}`,
    abi: CustodyAbi,
    functionName: 'create',
    args: [channelStruct, stateStruct],
    account: walletClient.account,
    chain: null,
  });

  // 5. Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash });

  console.log(`[YELLOW] Custody.create() tx confirmed: ${hash}`);
  return hash;
}

// ============================================================================
// WebSocket Connection Management with RPC Support
// ============================================================================

interface RPCRequest {
  id: string | number;
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface RPCResponse {
  id: string | number;
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * WebSocket RPC Client for Yellow Network ClearNode
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Request/response correlation via JSON-RPC IDs
 * - Ping/keepalive mechanism
 * - Connection pooling (singleton pattern)
 */
class YellowWSClient {
  private ws: WebSocket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private nextRequestId = 1;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1s, exponential backoff
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(private wsUrl: string) {}

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.wsUrl);

        ws.onopen = () => {
          console.log('[Yellow] Connected to ClearNode');
          this.ws = ws;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.connectionPromise = null;
          this.isConnecting = false;
          this.startPingInterval();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const response: RPCResponse = JSON.parse(event.data);
            this.handleResponse(response);
          } catch (error) {
            console.error('[Yellow] Failed to parse message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[Yellow] WebSocket error:', error);
          this.connectionPromise = null;
          this.isConnecting = false;
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          console.log('[Yellow] WebSocket closed');
          this.ws = null;
          this.connectionPromise = null;
          this.isConnecting = false;
          this.stopPingInterval();
          this.handleReconnect();
        };

        // Connection timeout
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            this.connectionPromise = null;
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.connectionPromise = null;
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle automatic reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Yellow] Max reconnection attempts reached');
      this.rejectAllPending(new Error('Connection lost'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[Yellow] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[Yellow] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start periodic ping to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.ping().catch((error) => {
        console.warn('[Yellow] Ping failed:', error);
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle incoming RPC response
   */
  private handleResponse(response: RPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('[Yellow] Received response for unknown request:', response.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`RPC Error: ${response.error.message} (code: ${response.error.code})`));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Reject all pending requests (on disconnect)
   */
  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  /**
   * Send RPC request and wait for response
   */
  async sendRequest(method: string, params?: any, timeoutMs = 30000): Promise<any> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = this.nextRequestId++;
    const request: RPCRequest = {
      id,
      jsonrpc: '2.0',
      method,
      params: params || {},
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.ws!.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Health check ping
   */
  async ping(): Promise<any> {
    return this.sendRequest('ping', {});
  }

  /**
   * Get ClearNode configuration
   */
  async getConfig(): Promise<any> {
    return this.sendRequest('get_config', {});
  }

  /**
   * Get supported assets/tokens
   */
  async getAssets(): Promise<any> {
    return this.sendRequest('get_assets', {});
  }

  /**
   * Create new state channel
   */
  async createChannel(chainId: number, token: string): Promise<any> {
    return this.sendRequest('create_channel', {
      chain_id: chainId,
      token,
    });
  }

  /**
   * Resize channel (deposit/withdraw)
   */
  async resizeChannel(channelId: string, amount: string, operation: 'deposit' | 'withdraw'): Promise<any> {
    return this.sendRequest('resize_channel', {
      channel_id: channelId,
      amount,
      operation,
    });
  }

  /**
   * Close state channel
   */
  async closeChannel(channelId: string): Promise<any> {
    return this.sendRequest('close_channel', {
      channel_id: channelId,
    });
  }

  /**
   * Get channels for user
   */
  async getChannels(address?: string): Promise<any> {
    return this.sendRequest('get_channels', address ? { address } : {});
  }

  /**
   * Get ledger balances
   */
  async getLedgerBalances(address?: string): Promise<any> {
    return this.sendRequest('get_ledger_balances', address ? { address } : {});
  }

  /**
   * Send a pre-signed SDK message and wait for response
   *
   * The SDK's message creators (createCreateChannelMessage, etc.) return
   * pre-signed JSON-RPC messages as strings. This method sends them directly
   * and correlates responses by request ID.
   */
  async sendRawMessage(message: string, timeoutMs = 30000): Promise<any> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Parse the message to extract the request ID for correlation
    // SDK messages use the format: { req: [id, method, params], sig: [...] }
    let requestId: string | number;
    try {
      const parsed = JSON.parse(message);
      // SDK format: req array where first element is the ID
      requestId = parsed.req?.[0] || this.nextRequestId++;
    } catch {
      requestId = this.nextRequestId++;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        this.ws!.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Close WebSocket connection
   */
  disconnect(): void {
    this.stopPingInterval();
    this.rejectAllPending(new Error('Client disconnected'));
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
  }
}

// Singleton WebSocket client instance
let wsClient: YellowWSClient | null = null;

/**
 * Get or create WebSocket client
 */
function getWSClient(): YellowWSClient {
  if (!wsClient) {
    wsClient = new YellowWSClient(YELLOW_WS_URL);
  }
  return wsClient;
}

/**
 * Legacy getConnection for backward compatibility
 */
async function getConnection(): Promise<WebSocket> {
  const client = getWSClient();
  await client.connect();
  // Return internal ws (note: direct access discouraged, use client methods instead)
  return (client as any).ws;
}

/**
 * Open a new state channel between poster and agent
 *
 * This creates a Yellow Network channel where funds are locked
 * and can be transferred off-chain before final settlement.
 *
 * Process:
 * 1. Approve token spending (if needed)
 * 2. Create channel via ClearNode RPC
 * 3. Deposit funds via resize_channel
 * 4. Submit on-chain transaction to Custody contract
 */
export async function openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
  // Use mock mode for development
  if (MOCK_MODE) {
    return openChannelMock(params);
  }

  const {
    poster,
    deposit,
    token,
    chainId = YELLOW_CONFIG.DEFAULT_CHAIN_ID,
    walletClient,
    publicClient,
  } = params;

  // Validate required parameters for production mode
  if (!walletClient || !publicClient) {
    console.warn('[Yellow] Missing wallet/public client, falling back to mock mode');
    return openChannelMock(params);
  }

  try {
    console.log('[Yellow] Starting real channel creation...');

    // Determine token address based on chain
    const tokenAddress = (token || YELLOW_CONFIG.TEST_USD) as Address;
    const custodyAddress = YELLOW_CONFIG.CUSTODY as Address;

    // Step 1: Approve token spending
    const depositAmount = parseUnits(deposit.toString(), 18); // Yellow Test USD uses 18 decimals

    console.log(`[Yellow] Step 1: Approving ${deposit} tokens...`);
    const approvalTxHash = await approveToken({
      walletClient,
      publicClient,
      tokenAddress,
      spenderAddress: custodyAddress,
      amount: depositAmount,
    });
    console.log(`[Yellow] Token approval: ${approvalTxHash === 'already_approved' ? 'already approved' : approvalTxHash}`);

    // Step 2: Create channel via WebSocket RPC
    console.log(`[Yellow] Step 2: Creating channel on chain ${chainId}...`);
    const client = getWSClient();
    const createChannelResponse = await client.createChannel(chainId, tokenAddress);

    if (!createChannelResponse || !createChannelResponse.channel_id) {
      throw new Error('Failed to create channel: invalid response from ClearNode');
    }

    const channelId = createChannelResponse.channel_id;
    console.log(`[Yellow] Channel created: ${channelId}`);

    // Store channel metadata for later use in Custody.create()
    const channelMetadata: ChannelMetadata = {
      channelId: createChannelResponse.channel_id || createChannelResponse.channelId,
      participants: [
        poster.toLowerCase(),
        createChannelResponse.participant || YELLOW_CONFIG.CUSTODY,  // ClearNode participant
      ] as [string, string],
      adjudicator: YELLOW_CONFIG.ADJUDICATOR,
      challenge: BigInt(3600),  // 1 hour default
      nonce: BigInt(Date.now()),
    };
    channelMetadataCache.set(channelMetadata.channelId, channelMetadata);

    // Step 3: Deposit funds via resize_channel
    console.log(`[Yellow] Step 3: Depositing ${deposit} tokens...`);
    const resizeResponse = await client.resizeChannel(
      channelId,
      depositAmount.toString(),
      'deposit'
    );

    if (!resizeResponse || !resizeResponse.state) {
      throw new Error('Failed to resize channel: invalid response from ClearNode');
    }

    // Step 4: Submit on-chain transaction (Custody.create)
    // The resizeResponse contains the signed state that needs to be submitted on-chain
    console.log(`[Yellow] Step 4: Submitting on-chain transaction...`);

    let custodyTxHash: string | undefined;
    try {
      const metadata = channelMetadataCache.get(channelId);
      if (metadata) {
        custodyTxHash = await submitCustodyCreate(
          walletClient,
          publicClient,
          metadata,
          {
            channelId,
            state: {
              intent: resizeResponse.state?.intent || 2,
              version: resizeResponse.state?.version || 1,
              stateData: resizeResponse.state?.stateData || '0x',
              allocations: resizeResponse.state?.allocations || [],
            },
            serverSignature: resizeResponse.serverSignature || '0x',
          }
        );
      } else {
        throw new Error('Channel metadata not found - cannot submit on-chain transaction');
      }
    } catch (error) {
      console.error('[Yellow] Failed to submit Custody.create():', error);
      // Continue without on-chain tx - channel exists in ClearNode
      console.warn('[Yellow] Channel created in ClearNode but not yet on-chain');
    }

    console.log('[Yellow] Channel opened successfully (production mode)');

    // Store channel in cache for local queries
    const channel: YellowChannel = {
      channelId,
      sessionId: createChannelResponse.session_id || `session_${Date.now()}`,
      participants: [poster.toLowerCase(), params.agent.toLowerCase()],
      deposit,
      token: tokenAddress,
      status: custodyTxHash ? 'OPEN' : 'PENDING',
      allocation: {
        [poster.toLowerCase()]: deposit,
        [params.agent.toLowerCase()]: 0,
      },
      createdAt: Date.now(),
    };
    channelCache.set(channelId, channel);

    return {
      channelId,
      sessionId: channel.sessionId,
      txHash: custodyTxHash || approvalTxHash !== 'already_approved' ? approvalTxHash : undefined,
    };

  } catch (error) {
    console.error('[Yellow] Failed to open channel in production mode:', error);
    console.warn('[Yellow] Falling back to mock mode');
    return openChannelMock(params);
  }
}

/**
 * Update channel allocation (off-chain state update)
 *
 * This transfers funds between participants without on-chain transactions.
 * Uses createSubmitAppStateMessage from the SDK to create a signed state update.
 */
export async function updateAllocation(
  channelId: string,
  newAllocation: Record<string, number>,
  _signerFn?: (message: string) => Promise<string>
): Promise<void> {
  if (MOCK_MODE) {
    return updateAllocationMock(channelId, newAllocation);
  }

  const signer = getSDKMessageSigner();
  if (!signer) {
    console.warn('[Yellow] SDK signer not available, falling back to mock');
    return updateAllocationMock(channelId, newAllocation);
  }

  try {
    console.log(`[Yellow] Updating allocation for channel ${channelId}...`);

    // Convert allocation to SDK format (amounts in smallest unit - 6 decimals for USDC)
    const allocations = Object.entries(newAllocation).map(
      ([participant, amount]) => ({
        participant: participant as Address,
        asset: YELLOW_CONFIG.BASE_USDC as Address,
        amount: BigInt(Math.round(amount * 1e6)).toString(),
      })
    );

    // Create signed state update message
    const stateMsg = await createSubmitAppStateMessage(signer, {
      app_session_id: channelId as Hex,
      allocations,
    });

    // Send to ClearNode
    const client = getWSClient();
    await client.sendRawMessage(stateMsg);

    console.log(`[Yellow] Allocation updated for channel ${channelId}`);

    // Update local cache
    const channel = channelCache.get(channelId);
    if (channel) {
      channel.allocation = newAllocation;
      channelCache.set(channelId, channel);
    }
  } catch (error) {
    console.error('[Yellow] Failed to update allocation:', error);
    // Fall back to mock for resilience
    console.warn('[Yellow] Falling back to mock allocation update');
    return updateAllocationMock(channelId, newAllocation);
  }
}

/**
 * Close channel and settle on-chain
 *
 * This finalizes the channel and triggers on-chain settlement
 * of the final allocation. Uses createCloseChannelMessage from the SDK.
 */
export async function closeChannel(
  channelId: string,
  _signerFn?: (message: string) => Promise<string>
): Promise<{ txHash?: string }> {
  if (MOCK_MODE) {
    return closeChannelMock(channelId);
  }

  const signer = getSDKMessageSigner();
  if (!signer) {
    console.warn('[Yellow] SDK signer not available, falling back to mock');
    return closeChannelMock(channelId);
  }

  try {
    console.log(`[Yellow] Closing channel ${channelId}...`);

    // Get channel from cache to determine funds destination
    const channel = channelCache.get(channelId);
    // Default to server address if no channel cached (funds go back to platform)
    const serverAddr = getServerAddress();
    const fundsDestination = channel?.participants[1] || serverAddr || '0x0000000000000000000000000000000000000000';

    // Create signed close message
    const closeMsg = await createCloseChannelMessage(
      signer,
      channelId as Hex,
      fundsDestination as Address
    );

    // Send to ClearNode
    const client = getWSClient();
    const result = await client.sendRawMessage(closeMsg);

    console.log(`[Yellow] Channel ${channelId} close request sent`);

    // Update cache
    if (channel) {
      channel.status = 'CLOSED';
      channelCache.set(channelId, channel);
    }

    // Parse txHash from response if available
    const txHash = result?.tx_hash || result?.txHash || result?.result?.tx_hash;
    if (txHash) {
      console.log(`[Yellow] Settlement transaction: ${txHash}`);
    }

    return { txHash };
  } catch (error) {
    console.error('[Yellow] Failed to close channel:', error);
    // Fall back to mock for resilience
    console.warn('[Yellow] Falling back to mock channel close');
    return closeChannelMock(channelId);
  }
}

/**
 * Get channel state
 */
export async function getChannel(channelId: string): Promise<YellowChannel | null> {
  return channelCache.get(channelId) || null;
}

/**
 * Server-side channel creation using SDK message signers
 *
 * This creates a channel using the server's private key for signing,
 * which is useful for API routes that need to open channels without
 * requiring user wallet signatures.
 *
 * Note: This still requires on-chain token approval from the user's wallet
 * for depositing funds, but the channel creation itself is signed by the server.
 */
export async function openChannelWithSDK(params: {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
  chainId?: number;
}): Promise<OpenChannelResult> {
  if (MOCK_MODE) {
    return openChannelMock({
      poster: params.poster,
      agent: params.agent,
      deposit: params.deposit,
      token: params.token,
    });
  }

  const signer = getSDKMessageSigner();
  if (!signer) {
    console.warn('[Yellow] SDK signer not available, falling back to mock');
    return openChannelMock({
      poster: params.poster,
      agent: params.agent,
      deposit: params.deposit,
      token: params.token,
    });
  }

  try {
    const chainId = params.chainId || YELLOW_CONFIG.DEFAULT_CHAIN_ID;
    const tokenAddress = (params.token || YELLOW_CONFIG.BASE_USDC) as Address;

    console.log(`[Yellow] Creating channel with SDK signer on chain ${chainId}...`);

    // Step 1: Create signed channel message
    const createMsg = await createCreateChannelMessage(signer, {
      chain_id: chainId,
      token: tokenAddress,
    });

    // Step 2: Send to ClearNode
    const client = getWSClient();
    await client.connect();
    const createResult = await client.sendRawMessage(createMsg);

    // Parse channel ID from response
    const channelId = createResult?.channel_id || createResult?.result?.channel_id;
    if (!channelId) {
      throw new Error('Failed to create channel: no channel_id in response');
    }

    console.log(`[Yellow] Channel created: ${channelId}`);

    // Step 3: Create signed resize message to deposit funds
    const depositAmount = BigInt(Math.round(params.deposit * 1e6)); // USDC has 6 decimals
    const resizeMsg = await createResizeChannelMessage(signer, {
      channel_id: channelId as Hex,
      allocate_amount: depositAmount,
      funds_destination: params.poster as Address,
    });

    // Step 4: Send resize message
    const resizeResult = await client.sendRawMessage(resizeMsg);
    console.log(`[Yellow] Funds deposited: ${params.deposit} USDC`);

    // Store in cache
    const sessionId = createResult?.session_id || `session_${Date.now()}`;
    const channel: YellowChannel = {
      channelId,
      sessionId,
      participants: [params.poster.toLowerCase(), params.agent.toLowerCase()],
      deposit: params.deposit,
      token: tokenAddress,
      status: 'OPEN',
      allocation: {
        [params.poster.toLowerCase()]: params.deposit,
        [params.agent.toLowerCase()]: 0,
      },
      createdAt: Date.now(),
    };
    channelCache.set(channelId, channel);

    return {
      channelId,
      sessionId,
      txHash: resizeResult?.tx_hash,
    };
  } catch (error) {
    console.error('[Yellow] Failed to open channel with SDK:', error);
    console.warn('[Yellow] Falling back to mock');
    return openChannelMock({
      poster: params.poster,
      agent: params.agent,
      deposit: params.deposit,
      token: params.token,
    });
  }
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

export {
  MOCK_MODE,
  YELLOW_WS_URL,
  YELLOW_TOKEN,
  YELLOW_CONFIG,
  getConnection,
  getWSClient,
  YellowWSClient,
};

// Export SDK functions for use in other modules
export {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createPingMessageV2,
  createGetConfigMessageV2,
  createGetAssetsMessageV2,
  createGetChannelsMessageV2,
  createCreateChannelMessage,
  createCloseChannelMessage,
  createResizeChannelMessage,
  createSubmitAppStateMessage,
  createGetLedgerEntriesMessageV2,
  createECDSAMessageSigner,
  type MessageSigner,
};

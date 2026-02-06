# Yellow Network SDK Integration Plan

**Branch:** main
**Date:** 2026-02-05
**Status:** DRAFT - AWAITING APPROVAL
**Priority:** HIGH - Critical for Yellow Network prize track ($15k)

---

## 1. OVERVIEW

### 1.1 Goal Statement
Integrate Yellow Network's Nitrolite SDK (@erc7824/nitrolite v0.5.3) to enable real state channel operations for gasless, instant payments between bounty posters and AI agents. This replaces the current mock implementation with production-ready SDK calls.

### 1.2 Problem Statement
**Critical Type Mismatch Discovered:**
- Current signer function: `(message: string) => Promise<string>`
- SDK requires: `MessageSigner = (payload: RPCData) => Promise<Hex>`
- RPCData is a tuple: `[RequestID, RPCMethod, object, Timestamp?]`

The SDK expects signers that can sign structured RPC payloads, not raw strings.

### 1.3 Files to Modify
1. `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow-signer.ts` - Add adapter layer
2. `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts` - Replace mock with real SDK calls
3. `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/.env.example` - Fix environment variable naming

### 1.4 Success Criteria
- [ ] MessageSigner adapter successfully converts RPCData to signable format
- [ ] openChannel() creates real Yellow Network app sessions
- [ ] updateAllocation() submits real state updates
- [ ] closeChannel() properly finalizes sessions
- [ ] WebSocket connection to ClearNode sandbox stable
- [ ] Environment variables properly configured
- [ ] Mock mode still available via YELLOW_MOCK_MODE=true flag
- [ ] All existing API routes continue to work

---

## 2. TECHNICAL CONTEXT

### 2.1 SDK Type Definitions (From @erc7824/nitrolite)

```typescript
// Core types
export type RequestID = number;
export type Timestamp = number;
export type AccountID = Hex;
export type RPCData = [RequestID, RPCMethod, object, Timestamp?];
export type MessageSigner = (payload: RPCData) => Promise<Hex>;

// App session creation
export interface CreateAppSessionRequestParams {
  definition: RPCAppDefinition;
  allocations: RPCAppSessionAllocation[];
  session_data?: string;
}

export interface RPCAppDefinition {
  application: string;
  protocol: RPCProtocolVersion;
  participants: Hex[];
  weights: number[];
  quorum: number;
  challenge: number;
  nonce?: number;
}

export interface RPCAppSessionAllocation {
  asset: string;
  amount: string;
  participant: Address;
}

export enum RPCProtocolVersion {
  NitroRPC_0_2 = "NitroRPC/0.2",
  NitroRPC_0_4 = "NitroRPC/0.4"
}

export enum RPCMethod {
  CreateAppSession = "create_app_session",
  SubmitAppState = "submit_app_state",
  CloseAppSession = "close_app_session",
  // ... many others
}
```

### 2.2 SDK Functions (From @erc7824/nitrolite/dist/rpc/api.d.ts)

```typescript
export declare function createAppSessionMessage(
  signer: MessageSigner,
  params: CreateAppSessionRequestParams,
  requestId?: RequestID,
  timestamp?: Timestamp
): Promise<string>;

export declare function createSubmitAppStateMessage<P extends RPCProtocolVersion>(
  signer: MessageSigner,
  params: SubmitAppStateParamsPerProtocol[P],
  requestId?: RequestID,
  timestamp?: Timestamp
): Promise<string>;

export declare function createCloseAppSessionMessage(
  signer: MessageSigner,
  params: CloseAppSessionRequestParams,
  requestId?: RequestID,
  timestamp?: Timestamp
): Promise<string>;
```

### 2.3 Current Environment Variables

```env
# In .env.example - INCONSISTENT NAMING
NEXT_PUBLIC_YELLOW_CLEARNODE=wss://clearnet-sandbox.yellow.com/ws
NEXT_PUBLIC_YELLOW_CUSTODY=0x019B65A265EB3363822f2752141b3dF16131b262
NEXT_PUBLIC_YELLOW_ADJUDICATOR=0x7c7ccbc98469190849BCC6c926307794fDfB11F2
NEXT_PUBLIC_YELLOW_TEST_USD=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

```typescript
// In yellow.ts - INCONSISTENT NAMING
const YELLOW_WS_URL = process.env.YELLOW_CLEARNODE_URL || 'wss://...';
const YELLOW_TOKEN = process.env.NEXT_PUBLIC_YELLOW_TEST_USD || '0x...';
```

**Problem:** Code reads `YELLOW_CLEARNODE_URL` but .env has `NEXT_PUBLIC_YELLOW_CLEARNODE`

---

## 3. IMPLEMENTATION PLAN

### 3.1 Phase 1: MessageSigner Adapter Implementation

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow-signer.ts`

**Location:** After line 90 (end of file)

**Add new function:**

```typescript
import { type Hex } from 'viem';

/**
 * Type definitions for Yellow Network RPC
 */
export type RequestID = number;
export type Timestamp = number;
export type RPCMethod = string;
export type RPCData = [RequestID, RPCMethod, object, Timestamp?];
export type MessageSigner = (payload: RPCData) => Promise<Hex>;

/**
 * Create a Nitrolite-compatible MessageSigner from a viem account
 *
 * The Nitrolite SDK expects signers that accept RPCData tuples:
 * [requestId, method, params, timestamp?]
 *
 * This adapter:
 * 1. Takes the RPCData tuple
 * 2. Serializes it to JSON
 * 3. Signs the JSON string using viem's signMessage
 * 4. Returns the signature as Hex
 */
export function createNitroliteMessageSigner(): MessageSigner {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('YELLOW_SERVER_PRIVATE_KEY not set, using mock signer');
    return mockNitroliteSigner;
  }

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    return async (payload: RPCData): Promise<Hex> => {
      // Serialize the RPC payload to a string for signing
      const message = JSON.stringify(payload);

      // Sign using viem's signMessage
      const signature = await account.signMessage({
        message
      });

      return signature;
    };
  } catch (error) {
    console.error('Failed to create Nitrolite signer:', error);
    return mockNitroliteSigner;
  }
}

/**
 * Mock Nitrolite signer for development/testing
 */
async function mockNitroliteSigner(payload: RPCData): Promise<Hex> {
  // Generate a deterministic mock signature based on the payload
  const message = JSON.stringify(payload);
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message)
  );
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return a mock signature format (130 chars = 0x + 64 bytes hex)
  return `0x${hashHex}${hashHex.slice(0, 64)}` as Hex;
}

/**
 * Get Nitrolite-compatible signer or null if not configured
 */
export function getNitroliteSignerOrNull(): MessageSigner | null {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;

  if (!privateKey) {
    return null;
  }

  try {
    return createNitroliteMessageSigner();
  } catch (error) {
    console.error('Failed to create Nitrolite signer:', error);
    return null;
  }
}
```

**Rationale:**
- RPCData is a tuple that needs deterministic serialization
- JSON.stringify provides consistent serialization
- viem's signMessage handles EIP-191 signing properly
- Maintains backward compatibility with mock mode

---

### 3.2 Phase 2: SDK Import Activation

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Step 2.1:** Uncomment SDK imports (lines 20-23)

**BEFORE:**
```typescript
// Uncomment for production Yellow SDK integration:
// import {
//   createAppSessionMessage,
//   parseAnyRPCResponse,
// } from '@erc7824/nitrolite';
```

**AFTER:**
```typescript
// Production Yellow SDK integration
import {
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  parseAnyRPCResponse,
  type RPCProtocolVersion,
  type RPCAppDefinition,
  type RPCAppSessionAllocation,
  type CreateAppSessionRequestParams,
  type SubmitAppStateRequestParamsV02,
  type CloseAppSessionRequestParams,
} from '@erc7824/nitrolite';
```

**Step 2.2:** Import Nitrolite signer (after line 17)

**ADD:**
```typescript
import {
  createNitroliteMessageSigner,
  type MessageSigner
} from './yellow-signer';
```

---

### 3.3 Phase 3: openChannel() Real Implementation

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Location:** Replace lines 122-131

**REPLACE:**
```typescript
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
```

**WITH:**
```typescript
export async function openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
  // Use mock mode for development
  if (MOCK_MODE) {
    return openChannelMock(params);
  }

  // Production implementation using Yellow SDK
  try {
    const signer = createNitroliteMessageSigner();
    const ws = await getConnection();

    // Generate unique request ID and timestamp
    const requestId = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Construct RPCAppDefinition
    const appDefinition: RPCAppDefinition = {
      application: 'clawork-bounty',
      protocol: 'NitroRPC/0.4' as RPCProtocolVersion,
      participants: [
        params.poster.toLowerCase() as `0x${string}`,
        params.agent.toLowerCase() as `0x${string}`,
      ],
      weights: [1, 1], // Equal weight for both participants
      quorum: 2, // Both must sign
      challenge: 3600, // 1 hour challenge period (in seconds)
      nonce: Date.now(), // Unique nonce per channel
    };

    // Construct allocations - poster deposits full amount initially
    const allocations: RPCAppSessionAllocation[] = [
      {
        asset: params.token || YELLOW_TOKEN,
        amount: params.deposit.toString(),
        participant: params.poster.toLowerCase() as `0x${string}`,
      },
      {
        asset: params.token || YELLOW_TOKEN,
        amount: '0',
        participant: params.agent.toLowerCase() as `0x${string}`,
      },
    ];

    // Create the session request params
    const sessionParams: CreateAppSessionRequestParams = {
      definition: appDefinition,
      allocations,
      session_data: JSON.stringify({
        type: 'bounty',
        createdAt: Date.now(),
      }),
    };

    // Create and send the message
    const message = await createAppSessionMessage(
      signer,
      sessionParams,
      requestId,
      timestamp
    );

    // Send via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Channel creation timeout'));
      }, 30000); // 30 second timeout

      ws.onmessage = (event) => {
        try {
          clearTimeout(timeout);
          const response = JSON.parse(event.data);
          const parsed = parseAnyRPCResponse(response);

          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Failed to create channel'));
            return;
          }

          const result = parsed.result as any;
          const channelId = result.app_session_id || `channel_${requestId}`;
          const sessionId = result.session_id || `session_${requestId}`;

          // Cache the channel locally
          channelCache.set(channelId, {
            channelId,
            sessionId,
            participants: [params.poster.toLowerCase(), params.agent.toLowerCase()] as [string, string],
            deposit: params.deposit,
            token: params.token || YELLOW_TOKEN,
            status: 'OPEN',
            allocation: {
              [params.poster.toLowerCase()]: params.deposit,
              [params.agent.toLowerCase()]: 0,
            },
            createdAt: Date.now(),
          });

          console.log(`[YELLOW SDK] Channel opened: ${channelId}`);
          resolve({ channelId, sessionId });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      ws.send(message);
    });
  } catch (error) {
    console.error('[YELLOW SDK] Failed to open channel, falling back to mock:', error);
    return openChannelMock(params);
  }
}
```

**Key Implementation Details:**
- Uses `NitroRPC/0.4` protocol (latest version)
- Application identifier: `clawork-bounty`
- Equal weights for poster and agent (both must sign)
- Quorum of 2 (both signatures required)
- 1-hour challenge period
- Poster deposits full amount initially
- Agent allocation starts at 0
- 30-second timeout for channel creation
- Falls back to mock on error

---

### 3.4 Phase 4: updateAllocation() Real Implementation

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Location:** Replace lines 139-150

**REPLACE:**
```typescript
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
```

**WITH:**
```typescript
export async function updateAllocation(
  channelId: string,
  newAllocation: Record<string, number>,
  _signerFn?: (message: string) => Promise<string>
): Promise<void> {
  if (MOCK_MODE) {
    return updateAllocationMock(channelId, newAllocation);
  }

  // Production implementation using Yellow SDK
  try {
    const signer = createNitroliteMessageSigner();
    const ws = await getConnection();
    const channel = channelCache.get(channelId);

    if (!channel) {
      throw new Error('Channel not found in cache');
    }

    // Generate unique request ID and timestamp
    const requestId = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Convert allocation object to array format
    const allocations: RPCAppSessionAllocation[] = Object.entries(newAllocation).map(
      ([participant, amount]) => ({
        asset: channel.token,
        amount: amount.toString(),
        participant: participant.toLowerCase() as `0x${string}`,
      })
    );

    // Construct state update params
    const stateParams: SubmitAppStateRequestParamsV02 = {
      app_session_id: channelId as `0x${string}`,
      allocations,
      session_data: JSON.stringify({
        updatedAt: Date.now(),
      }),
    };

    // Create and send the message
    const message = await createSubmitAppStateMessage(
      signer,
      stateParams,
      requestId,
      timestamp
    );

    // Send via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('State update timeout'));
      }, 30000); // 30 second timeout

      ws.onmessage = (event) => {
        try {
          clearTimeout(timeout);
          const response = JSON.parse(event.data);
          const parsed = parseAnyRPCResponse(response);

          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Failed to update state'));
            return;
          }

          // Update local cache
          channel.allocation = newAllocation;
          channelCache.set(channelId, channel);

          console.log(`[YELLOW SDK] Channel ${channelId} allocation updated`);
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      ws.send(message);
    });
  } catch (error) {
    console.error('[YELLOW SDK] Failed to update allocation, falling back to mock:', error);
    return updateAllocationMock(channelId, newAllocation);
  }
}
```

**Key Implementation Details:**
- Uses `SubmitAppStateRequestParamsV02` (compatible with NitroRPC/0.4)
- Converts allocation object to SDK's array format
- Updates session_data with timestamp
- 30-second timeout for state updates
- Updates local cache on success
- Falls back to mock on error

---

### 3.5 Phase 5: closeChannel() Real Implementation

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Location:** Replace lines 158-168

**REPLACE:**
```typescript
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
```

**WITH:**
```typescript
export async function closeChannel(
  channelId: string,
  _signerFn?: (message: string) => Promise<string>
): Promise<{ txHash?: string }> {
  if (MOCK_MODE) {
    return closeChannelMock(channelId);
  }

  // Production implementation using Yellow SDK
  try {
    const signer = createNitroliteMessageSigner();
    const ws = await getConnection();
    const channel = channelCache.get(channelId);

    if (!channel) {
      throw new Error('Channel not found in cache');
    }

    // Generate unique request ID and timestamp
    const requestId = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    // Convert current allocation to array format for final settlement
    const allocations: RPCAppSessionAllocation[] = Object.entries(channel.allocation).map(
      ([participant, amount]) => ({
        asset: channel.token,
        amount: amount.toString(),
        participant: participant.toLowerCase() as `0x${string}`,
      })
    );

    // Construct close session params
    const closeParams: CloseAppSessionRequestParams = {
      app_session_id: channelId as `0x${string}`,
      allocations,
      session_data: JSON.stringify({
        closedAt: Date.now(),
      }),
    };

    // Create and send the message
    const message = await createCloseAppSessionMessage(
      signer,
      closeParams,
      requestId,
      timestamp
    );

    // Send via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Channel close timeout'));
      }, 30000); // 30 second timeout

      ws.onmessage = (event) => {
        try {
          clearTimeout(timeout);
          const response = JSON.parse(event.data);
          const parsed = parseAnyRPCResponse(response);

          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Failed to close channel'));
            return;
          }

          // Update local cache
          channel.status = 'CLOSED';
          channelCache.set(channelId, channel);

          const result = parsed.result as any;
          const txHash = result.tx_hash || result.transactionHash;

          console.log(`[YELLOW SDK] Channel ${channelId} closed. TxHash: ${txHash}`);
          resolve({ txHash });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      ws.send(message);
    });
  } catch (error) {
    console.error('[YELLOW SDK] Failed to close channel, falling back to mock:', error);
    return closeChannelMock(channelId);
  }
}
```

**Key Implementation Details:**
- Uses current allocation from cache as final settlement
- Updates session_data with close timestamp
- Extracts transaction hash from response
- Updates local cache to CLOSED status
- 30-second timeout for channel closure
- Falls back to mock on error

---

### 3.6 Phase 6: Environment Variable Fixes

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/.env.example`

**Step 6.1:** Add missing server key variable (after line 31)

**ADD:**
```env
# Yellow Network Server Private Key (for server-side signing)
# IMPORTANT: Keep this secret! Only use in API routes, never expose to client
YELLOW_SERVER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Step 6.2:** Fix environment variable name (line 26)

**REPLACE:**
```typescript
const YELLOW_WS_URL = process.env.YELLOW_CLEARNODE_URL || 'wss://clearnet-sandbox.yellow.com/ws';
```

**WITH:**
```typescript
const YELLOW_WS_URL = process.env.NEXT_PUBLIC_YELLOW_CLEARNODE || 'wss://clearnet-sandbox.yellow.com/ws';
```

**Rationale:**
- Aligns code with .env.example naming
- Maintains NEXT_PUBLIC prefix for client-accessible variables
- YELLOW_SERVER_PRIVATE_KEY is correctly private (no NEXT_PUBLIC prefix)

---

### 3.7 Phase 7: WebSocket Message Handling Enhancement

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/yellow.ts`

**Location:** After line 114 (end of getConnection function)

**ADD:**
```typescript
/**
 * Send an RPC message and wait for response
 *
 * Generic helper for sending messages via WebSocket
 */
async function sendRPCMessage(
  message: string,
  timeoutMs: number = 30000
): Promise<any> {
  const ws = await getConnection();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('RPC request timeout'));
    }, timeoutMs);

    const handleMessage = (event: MessageEvent) => {
      try {
        clearTimeout(timeout);
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('error', handleError);

        const response = JSON.parse(event.data);
        const parsed = parseAnyRPCResponse(response);

        if (parsed.error) {
          reject(new Error(parsed.error.message || 'RPC request failed'));
          return;
        }

        resolve(parsed.result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    const handleError = (error: Event) => {
      clearTimeout(timeout);
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      reject(error);
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);
    ws.send(message);
  });
}
```

**Rationale:**
- Reduces code duplication across openChannel/updateAllocation/closeChannel
- Proper event listener cleanup to prevent memory leaks
- Consistent error handling
- Configurable timeout

---

## 4. TESTING PLAN

### 4.1 Unit Tests for Signer Adapter

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/__tests__/yellow-signer.test.ts`

**Create new test file:**

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createNitroliteMessageSigner, type RPCData } from '../yellow-signer';

describe('Yellow Signer - Nitrolite Adapter', () => {
  let signer: ReturnType<typeof createNitroliteMessageSigner>;

  beforeEach(() => {
    // Set test private key
    process.env.YELLOW_SERVER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    signer = createNitroliteMessageSigner();
  });

  it('should sign RPCData tuples', async () => {
    const payload: RPCData = [
      123, // requestId
      'create_app_session', // method
      { test: 'data' }, // params
      1704110400, // timestamp
    ];

    const signature = await signer(payload);

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  it('should produce consistent signatures for same payload', async () => {
    const payload: RPCData = [456, 'submit_app_state', { foo: 'bar' }];

    const sig1 = await signer(payload);
    const sig2 = await signer(payload);

    expect(sig1).toBe(sig2);
  });

  it('should produce different signatures for different payloads', async () => {
    const payload1: RPCData = [789, 'create_app_session', { a: 1 }];
    const payload2: RPCData = [789, 'create_app_session', { a: 2 }];

    const sig1 = await signer(payload1);
    const sig2 = await signer(payload2);

    expect(sig1).not.toBe(sig2);
  });

  it('should handle optional timestamp in RPCData', async () => {
    const payload: RPCData = [100, 'ping', {}];

    const signature = await signer(payload);

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  it('should fall back to mock signer when private key missing', async () => {
    delete process.env.YELLOW_SERVER_PRIVATE_KEY;
    const mockSigner = createNitroliteMessageSigner();

    const payload: RPCData = [200, 'test', {}];
    const signature = await mockSigner(payload);

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });
});
```

### 4.2 Integration Tests for Channel Operations

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/frontend/lib/services/__tests__/yellow.integration.test.ts`

**Create new test file:**

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { openChannel, updateAllocation, closeChannel, getChannel } from '../yellow';

describe('Yellow SDK Integration Tests', () => {
  let channelId: string;
  const posterAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const agentAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  beforeAll(() => {
    // Set to production mode for these tests
    process.env.YELLOW_MOCK_MODE = 'false';
    process.env.YELLOW_SERVER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  });

  it('should open a channel', async () => {
    const result = await openChannel({
      poster: posterAddress,
      agent: agentAddress,
      deposit: 1000,
      token: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb',
    });

    expect(result.channelId).toBeTruthy();
    expect(result.sessionId).toBeTruthy();

    channelId = result.channelId;
  }, 35000); // 35 second timeout

  it('should retrieve channel state', async () => {
    const channel = await getChannel(channelId);

    expect(channel).toBeTruthy();
    expect(channel?.status).toBe('OPEN');
    expect(channel?.deposit).toBe(1000);
  });

  it('should update channel allocation', async () => {
    await updateAllocation(channelId, {
      [posterAddress]: 600,
      [agentAddress]: 400,
    });

    const channel = await getChannel(channelId);
    expect(channel?.allocation[posterAddress.toLowerCase()]).toBe(600);
    expect(channel?.allocation[agentAddress.toLowerCase()]).toBe(400);
  }, 35000);

  it('should close the channel', async () => {
    const result = await closeChannel(channelId);

    expect(result.txHash).toBeTruthy();

    const channel = await getChannel(channelId);
    expect(channel?.status).toBe('CLOSED');
  }, 35000);
});
```

### 4.3 Manual Testing Steps with ClearNode Sandbox

**Prerequisites:**
1. Set `YELLOW_MOCK_MODE=false` in `.env.local`
2. Set `YELLOW_SERVER_PRIVATE_KEY` to a test wallet private key
3. Ensure Yellow ClearNode sandbox is accessible

**Test Sequence:**

**Step 1: Verify Connection**
```bash
# In browser console or Node REPL
import { getConnection } from '@/lib/services/yellow';
const ws = await getConnection();
console.log('Connected:', ws.readyState === WebSocket.OPEN);
```

**Step 2: Test Channel Opening**
```bash
# Via API route
curl -X POST http://localhost:3000/api/bounties \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Bounty",
    "description": "Integration test",
    "reward": 100,
    "type": "STANDARD",
    "poster": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'

# Check logs for "[YELLOW SDK] Channel opened"
```

**Step 3: Test State Update**
```bash
# Claim the bounty (triggers allocation update)
curl -X POST http://localhost:3000/api/bounties/{id}/claim \
  -H "Content-Type: application/json" \
  -d '{"agentAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"}'

# Check logs for "[YELLOW SDK] Channel allocation updated"
```

**Step 4: Test Channel Closure**
```bash
# Approve the bounty (triggers channel close)
curl -X POST http://localhost:3000/api/bounties/{id}/approve \
  -H "Content-Type: application/json"

# Check logs for "[YELLOW SDK] Channel closed"
```

**Step 5: Verify Fallback to Mock**
```bash
# Set YELLOW_MOCK_MODE=true
# Repeat steps 2-4
# Verify logs show "[MOCK]" prefix instead of "[YELLOW SDK]"
```

### 4.4 Error Handling Tests

**Test Cases:**
1. **Connection Timeout:** Disconnect network, verify 10-second timeout
2. **Invalid Credentials:** Use wrong private key, verify error handling
3. **Malformed Messages:** Send invalid JSON, verify parsing error
4. **Channel Not Found:** Try to update non-existent channel
5. **Insufficient Funds:** Try to allocate more than deposited
6. **WebSocket Disconnect:** Close connection mid-operation, verify reconnection

---

## 5. ROLLBACK PLAN

### 5.1 Immediate Rollback (If Critical Issues Arise)

**Step 1:** Set mock mode globally
```bash
# In .env.local
YELLOW_MOCK_MODE=true
```

**Step 2:** Restart application
```bash
npm run dev  # or production restart
```

**Result:** All Yellow operations use mock implementations, no SDK calls made.

### 5.2 Code Rollback (If Bugs Found)

**Option A: Git Revert**
```bash
git revert <commit-hash>
git push origin main
```

**Option B: Comment Out Production Code**

In `yellow.ts`, change all production functions to:
```typescript
export async function openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
  // Temporarily disabled production mode due to issues
  // return openChannelProduction(params);
  return openChannelMock(params);
}
```

### 5.3 Partial Rollback (Specific Function Issues)

If only one function has issues (e.g., closeChannel), modify just that function:

```typescript
export async function closeChannel(channelId: string): Promise<{ txHash?: string }> {
  // Temporarily using mock for closeChannel due to issue #123
  return closeChannelMock(channelId);
}
```

### 5.4 Monitoring During Rollout

**Key Metrics:**
- WebSocket connection stability (should stay > 99%)
- Channel operation success rate (target > 95%)
- Average response time (target < 5 seconds)
- Error rate (target < 1%)

**Rollback Triggers:**
- Connection success rate < 90%
- Operation success rate < 85%
- Error rate > 5%
- Critical security vulnerability discovered

---

## 6. DEPLOYMENT STRATEGY

### 6.1 Staged Rollout

**Phase 1: Development Environment**
- Deploy to dev with YELLOW_MOCK_MODE=false
- Test all operations manually
- Run integration test suite
- Monitor for 24 hours

**Phase 2: Staging Environment**
- Deploy to staging
- Invite team to test
- Run load tests (10 concurrent channels)
- Monitor for 48 hours

**Phase 3: Production Canary**
- Deploy to production with YELLOW_MOCK_MODE=true
- Gradually enable for select users (10%)
- Monitor metrics closely
- Increase to 50% if successful
- Full rollout to 100%

### 6.2 Environment Configuration

**Development:**
```env
YELLOW_MOCK_MODE=false
YELLOW_SERVER_PRIVATE_KEY=0x[dev-key]
NEXT_PUBLIC_YELLOW_CLEARNODE=wss://clearnet-sandbox.yellow.com/ws
```

**Production:**
```env
YELLOW_MOCK_MODE=false
YELLOW_SERVER_PRIVATE_KEY=0x[prod-key-from-secrets-manager]
NEXT_PUBLIC_YELLOW_CLEARNODE=wss://clearnet.yellow.com/ws  # Production endpoint
```

---

## 7. DOCUMENTATION UPDATES

### 7.1 README Updates Required

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/README.md`

**Add section:**
```markdown
## Yellow Network Integration

Clawork uses Yellow Network state channels for gasless payments.

### Configuration

1. Add to `.env.local`:
   ```env
   YELLOW_SERVER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
   NEXT_PUBLIC_YELLOW_CLEARNODE=wss://clearnet-sandbox.yellow.com/ws
   ```

2. Toggle between mock and production:
   ```env
   YELLOW_MOCK_MODE=true   # Use mock implementation
   YELLOW_MOCK_MODE=false  # Use real Yellow SDK
   ```

### How It Works

1. **Channel Opening:** When a bounty is created, a state channel opens between poster and agent
2. **Off-chain Updates:** Allocations update off-chain as work progresses (zero gas for agents)
3. **Settlement:** When bounty completes, channel closes and funds settle on-chain

### Troubleshooting

- If channels fail to open, check WebSocket connection
- If signatures invalid, verify YELLOW_SERVER_PRIVATE_KEY format
- Enable mock mode for testing without real channels
```

### 7.2 API Documentation Updates

**File:** `/Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026/public/SKILL.md`

**Add section:**
```markdown
## Payment Channels

Clawork uses Yellow Network state channels for instant, gasless payments.

### Channel Lifecycle

1. **Channel Created** - When you claim a bounty
2. **Funds Locked** - Poster's funds locked in channel (off-chain)
3. **Work Submitted** - You submit deliverable
4. **Allocation Updated** - Funds reallocated to you (off-chain, zero gas)
5. **Channel Closed** - On approval, channel settles on-chain

### Key Benefits

- **Zero Gas:** All operations except final settlement are gasless
- **Instant:** Updates happen off-chain in milliseconds
- **Secure:** State channels backed by Yellow Network adjudicator
- **Brand New Wallets:** You don't need ETH for gas to receive payments

### Checking Channel Status

```bash
GET /api/bounties/{id}

Response:
{
  "id": "123",
  "channelId": "channel_abc123",
  "channelStatus": "OPEN",
  "allocation": {
    "poster": 600,
    "agent": 400
  }
}
```
```

---

## 8. RISKS AND MITIGATIONS

### 8.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SDK API changes | HIGH | LOW | Pin to specific version (0.5.3), test thoroughly |
| WebSocket instability | HIGH | MEDIUM | Implement reconnection logic, fallback to mock |
| Signature validation fails | HIGH | MEDIUM | Extensive testing, proper serialization |
| ClearNode sandbox downtime | MEDIUM | LOW | Mock mode fallback, monitor uptime |
| Memory leaks from WebSocket | MEDIUM | LOW | Proper event listener cleanup |
| Timeout issues | LOW | MEDIUM | Configurable timeouts, proper error handling |

### 8.2 Security Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Private key exposure | CRITICAL | LOW | Use env variables, never commit, server-side only |
| Man-in-the-middle attacks | HIGH | LOW | WSS (encrypted), signature verification |
| Replay attacks | MEDIUM | MEDIUM | Nonces, timestamps, SDK handles this |
| Unauthorized channel access | HIGH | LOW | Signature verification, participant checks |

### 8.3 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Yellow Network prize disqualification | HIGH | LOW | Follow SDK guidelines, proper attribution |
| Poor user experience | MEDIUM | MEDIUM | Extensive testing, clear error messages |
| Scalability issues | MEDIUM | LOW | Load testing, channel pooling |

---

## 9. SUCCESS METRICS

### 9.1 Technical Metrics

- [ ] All unit tests pass (100% pass rate)
- [ ] Integration tests pass (100% pass rate)
- [ ] WebSocket connection uptime > 99%
- [ ] Channel operation success rate > 95%
- [ ] Average response time < 5 seconds
- [ ] Zero private key exposures
- [ ] Zero production errors for 7 days

### 9.2 Functional Metrics

- [ ] Successfully open 10+ channels in testing
- [ ] Successfully update allocations 50+ times
- [ ] Successfully close 10+ channels
- [ ] Graceful fallback to mock mode on errors
- [ ] Environment variables properly documented
- [ ] Team members can configure locally

### 9.3 Prize Track Metrics

- [ ] Demonstrates Yellow Network state channels
- [ ] Showcases gasless payments for agents
- [ ] Shows ERC-7824 adjudication capability
- [ ] Includes proper SDK attribution
- [ ] Documentation references Yellow Network
- [ ] Demo video shows real channel operations

---

## 10. TIMELINE

### 10.1 Estimated Effort

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Signer Adapter | 2 hours | None |
| Phase 2: SDK Import Activation | 30 minutes | Phase 1 |
| Phase 3: openChannel() | 3 hours | Phase 2 |
| Phase 4: updateAllocation() | 2 hours | Phase 3 |
| Phase 5: closeChannel() | 2 hours | Phase 3 |
| Phase 6: Env Variable Fixes | 30 minutes | None |
| Phase 7: WebSocket Helper | 1 hour | Phase 2 |
| Testing (Unit) | 3 hours | All phases |
| Testing (Integration) | 4 hours | All phases |
| Documentation | 2 hours | All phases |
| **TOTAL** | **20 hours** | |

### 10.2 Critical Path

1. MessageSigner Adapter (BLOCKING all SDK calls)
2. SDK Import Activation (BLOCKING all SDK calls)
3. openChannel() (BLOCKING other operations)
4. updateAllocation() and closeChannel() (PARALLEL)
5. Testing and Documentation (PARALLEL)

### 10.3 Milestones

- [ ] **Milestone 1:** Signer adapter works, signatures valid (2 hours)
- [ ] **Milestone 2:** openChannel() successfully creates app sessions (5 hours)
- [ ] **Milestone 3:** Full channel lifecycle works end-to-end (10 hours)
- [ ] **Milestone 4:** All tests pass (17 hours)
- [ ] **Milestone 5:** Ready for production deployment (20 hours)

---

## 11. DEPENDENCIES

### 11.1 External Dependencies

- **@erc7824/nitrolite** v0.5.3 - Already installed
- **viem** v2.45.1 - Already installed
- **Yellow ClearNode Sandbox** - Must be accessible
- **Test private keys** - For development/testing

### 11.2 Internal Dependencies

- Existing mock implementation - Must remain functional
- API routes - Must be compatible with new async behavior
- Firebase integration - May store channel metadata
- Frontend UI - Should display channel status

### 11.3 Documentation Dependencies

- Yellow Network SDK docs: https://docs.yellow.org/docs/build/quick-start
- Nitrolite protocol spec: https://github.com/statechannels/nitro-protocol
- ERC-7824 adjudication spec

---

## 12. OPEN QUESTIONS

### 12.1 Technical Questions

1. **Q:** Does the SDK handle reconnection automatically?
   **A:** TBD - Need to test WebSocket disconnection scenarios

2. **Q:** What's the maximum channel lifetime?
   **A:** TBD - Check Yellow Network sandbox limits

3. **Q:** How do we handle concurrent state updates?
   **A:** SDK uses nonces, but need to verify conflict resolution

4. **Q:** Should we cache channels in Redis/Firebase?
   **A:** Current plan: in-memory cache, consider persistent storage later

### 12.2 Business Questions

1. **Q:** What's our fallback if Yellow Network sandbox goes down during judging?
   **A:** Mock mode enabled by environment variable

2. **Q:** Should we show channel IDs to end users?
   **A:** TBD - Discuss UX with team

3. **Q:** How do we demonstrate this to judges?
   **A:** Demo video + live demo, prepare fallback recording

---

## 13. APPROVAL CHECKLIST

Before moving to EXECUTE mode, ensure:

- [ ] All team members reviewed plan
- [ ] Technical approach validated
- [ ] Timeline acceptable
- [ ] Risks acknowledged and mitigated
- [ ] Success criteria agreed upon
- [ ] Testing plan comprehensive
- [ ] Rollback plan clear
- [ ] Documentation plan sufficient
- [ ] Yellow Network integration requirements met
- [ ] No blocking questions remain

---

## 14. POST-IMPLEMENTATION TASKS

After successful implementation:

1. Update CLAUDE.md with new Yellow integration patterns
2. Create troubleshooting guide for common issues
3. Record demo video showing channel operations
4. Prepare Yellow Network prize submission materials
5. Monitor production metrics for first week
6. Gather team feedback on developer experience
7. Consider improvements for future iterations

---

**PLAN STATUS:** DRAFT - AWAITING APPROVAL

**NEXT STEPS:**
1. Review this plan with the team
2. Address any open questions
3. Get approval to proceed to EXECUTE mode
4. Begin implementation with Phase 1

**ESTIMATED COMPLETION:** 20 hours of focused development time

**CRITICAL SUCCESS FACTOR:** MessageSigner adapter must correctly serialize and sign RPCData tuples for SDK compatibility.

# RIPER PLAN: Critical Fixes for Yellow Protocol Phase 3 Implementation

**Project:** Clawork - AI Agent Bounty Marketplace
**Date:** 2026-02-06
**Branch:** main
**Target:** HackMoney 2026 - Yellow Network $15k Prize Track
**Status:** PLAN MODE - CRITICAL PRIORITY

---

## Executive Summary

This plan addresses **3 CRITICAL bugs** in the Yellow Network integration that will cause complete failure of all channel creation attempts. These bugs were discovered during code review and must be fixed before any production testing can succeed.

**Impact:** WITHOUT these fixes, ALL channel creation attempts will fail at the Custody.create() contract call.

**Files Modified:** 1 file (`frontend/lib/services/yellow.ts`)
**Lines Changed:** ~40 lines across 3 functions
**Risk Level:** HIGH - Affects core payment functionality
**Estimated Fix Time:** 2-3 hours

---

## Critical Issues Analysis

### Issue 1: Incorrect State Signature Format (Lines 256-266)

**Location:** `frontend/lib/services/yellow.ts` - `signChannelState()` function

**Current Implementation:**
```typescript
// Lines 256-266
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
  message: stateMessage,  // <-- WRONG: Signs JSON string
});
```

**Problem:**
- Currently signs the **JSON string representation** of the state
- Custody.create() expects signature over **keccak256(abi.encodePacked(...))** hash
- ClearNode server signature will use proper format, so signatures won't match
- Contract will reject the transaction with "Invalid signature" error

**Root Cause:**
The Nitrolite SDK uses `getStateHash()` which properly encodes the state according to the contract's expectations:
```typescript
// From SDK: nitrolite/dist/utils/state.js
function getStateHash(channelId, state) {
    return keccak256(getPackedState(channelId, state));
}

function getPackedState(channelId, state) {
    return encodeAbiParameters([
        { name: 'channelId', type: 'bytes32' },
        { name: 'intent', type: 'uint8' },
        { name: 'version', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        {
            name: 'allocations',
            type: 'tuple[]',
            components: [
                { name: 'destination', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
            ],
        },
    ], [channelId, state.intent, state.version, state.data, state.allocations]);
}
```

**Required Fix:**
Import and use the SDK's `getStateHash()` utility function to create proper state hash, then sign the raw hash.

**References:**
- SDK Implementation: `node_modules/@erc7824/nitrolite/dist/utils/state.js`
- SDK Types: `node_modules/@erc7824/nitrolite/dist/utils/state.d.ts`
- Custody ABI: `node_modules/@erc7824/nitrolite/dist/abis/generated.d.ts`

---

### Issue 2: Hardcoded Channel Metadata (Lines 805-814)

**Location:** `frontend/lib/services/yellow.ts` - `openChannel()` function

**Current Implementation:**
```typescript
// Lines 805-814
const channelMetadata: ChannelMetadata = {
  channelId: createChannelResponse.channel_id || createChannelResponse.channelId,
  participants: [
    poster.toLowerCase(),
    createChannelResponse.participant || YELLOW_CONFIG.CUSTODY,  // <-- WRONG
  ] as [string, string],
  adjudicator: YELLOW_CONFIG.ADJUDICATOR,  // <-- WRONG: hardcoded
  challenge: BigInt(3600),  // <-- WRONG: hardcoded to 1 hour
  nonce: BigInt(Date.now()),  // <-- WRONG: not from ClearNode
};
```

**Problem:**
- Uses **hardcoded values** instead of ClearNode's response
- ClearNode returns proper channel metadata including:
  - Actual ClearNode participant address
  - Contract-registered adjudicator address
  - Challenge period duration
  - Proper nonce for channel uniqueness
- Custody.create() will compute channelId from these parameters
- If parameters don't match ClearNode's state, channelId will be different
- Contract will reject with channelId mismatch error

**Expected ClearNode Response Format:**
Based on Nitrolite SDK patterns, create_channel response should include:
```typescript
{
  channel_id: "0x...",      // Computed from channel parameters
  participant: "0x...",      // ClearNode's participant address
  adjudicator: "0x...",      // Registered adjudicator contract
  challenge: 3600,           // Challenge period in seconds
  nonce: 123456,             // Unique nonce for this channel
  session_id: "session_..."  // Optional session identifier
}
```

**Required Fix:**
1. Extract ALL channel metadata from `createChannelResponse`
2. Use fallbacks ONLY if response fields are missing
3. Add validation to ensure critical fields are present
4. Log warning if using fallback values

**Root Cause:**
Implementation assumed ClearNode response format without verifying actual response structure. Need to inspect actual ClearNode API response format.

---

### Issue 3: Wrong Token Decimal Places (Line 780)

**Location:** `frontend/lib/services/yellow.ts` - `openChannel()` function

**Current Implementation:**
```typescript
// Line 780
const depositAmount = parseUnits(deposit.toString(), 18); // Yellow Test USD uses 18 decimals
```

**Problem:**
- **Hardcoded to 18 decimals** for all tokens
- Base USDC uses **6 decimals** (industry standard for USDC)
- Yellow Test USD may use 18 decimals on testnet
- With deposit=100 USDC and 18 decimals:
  - Result: 100 * 10^18 = 100,000,000,000,000,000,000
  - Actual: Should be 100 * 10^6 = 100,000,000
  - **Tries to request 1 TRILLION tokens instead of 100**
- Transaction will fail with "Insufficient balance" or "Allowance exceeded"

**Token Decimal Standards:**
| Token | Network | Decimals | Notes |
|-------|---------|----------|-------|
| USDC | Base Mainnet | 6 | Standard USDC |
| USDC | Base Sepolia | 6 | Standard USDC |
| TestUSD | Yellow Sandbox | 18 | Custom test token |
| USDT | Most chains | 6 | Standard USDT |
| DAI | Ethereum | 18 | Standard DAI |

**Required Fix:**
1. Query token decimals from ERC-20 contract before parseUnits()
2. Add token decimal cache to avoid repeated queries
3. Provide decimal override parameter for testing
4. Update all amount parsing to use correct decimals

**Additional Locations Affected:**
- Line 916-921: `updateAllocation()` - hardcoded 6 decimals
- Line 1084: `openChannelWithSDK()` - hardcoded 6 decimals

**Note:** Line 916-921 correctly uses 6 decimals for USDC, but should also be dynamic.

---

## Implementation Plan

### Step 1: Add SDK Utility Imports

**File:** `frontend/lib/services/yellow.ts`
**Location:** Top of file (after existing imports)

**Action:** Add import for Nitrolite SDK state utilities

```typescript
// Add to imports section (around line 40)
import { getStateHash, getPackedState } from '@erc7824/nitrolite/dist/utils/state';
```

**Validation:**
- Check that import resolves without errors
- Verify types are available in TypeScript

---

### Step 2: Fix Issue 1 - Correct State Signature Format

**File:** `frontend/lib/services/yellow.ts`
**Function:** `signChannelState()`
**Lines:** 240-274

**Current Code:**
```typescript
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
```

**New Code:**
```typescript
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

  // Create proper state hash using Nitrolite SDK utility
  // This matches the format expected by Custody.create()
  // Format: keccak256(abi.encodePacked(channelId, intent, version, data, allocations))
  const stateHash = getStateHash(channelId as Hex, {
    intent: state.intent,
    version: state.version,
    data: state.data as Hex,
    allocations: state.allocations.map(a => ({
      destination: a.destination as Address,
      token: a.token as Address,
      amount: a.amount,
    })),
    sigs: [], // Not needed for hash computation
  });

  // Sign the raw state hash (not a personal message)
  const signature = await walletClient.signMessage({
    account: walletClient.account,
    message: { raw: stateHash },  // Use raw hash, not personal message format
  });

  return signature;
}
```

**Changes Explained:**
1. Import and use `getStateHash()` from SDK
2. Convert state to SDK's State format with proper types
3. Pass `{ raw: stateHash }` to signMessage to sign the hash directly
4. Remove JSON.stringify() approach entirely

**Testing Criteria:**
- [ ] Function compiles without TypeScript errors
- [ ] Signature format matches ClearNode server signature format
- [ ] Custody.create() accepts the signed state
- [ ] Both signatures (user + server) validate on-chain

---

### Step 3: Add Token Decimals Query Utility

**File:** `frontend/lib/services/yellow.ts`
**Location:** After ERC20_ABI definition (around line 164)

**Action:** Add decimal cache and query function

```typescript
// Token decimal cache to avoid repeated queries
const tokenDecimalCache = new Map<string, number>();

/**
 * Get token decimals from contract
 * Results are cached to avoid repeated queries
 */
async function getTokenDecimals(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<number> {
  // Check cache first
  const cached = tokenDecimalCache.get(tokenAddress.toLowerCase());
  if (cached !== undefined) {
    return cached;
  }

  // Query from contract
  try {
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });

    const decimalsNum = Number(decimals);
    tokenDecimalCache.set(tokenAddress.toLowerCase(), decimalsNum);

    console.log(`[Yellow] Token ${tokenAddress} has ${decimalsNum} decimals`);
    return decimalsNum;
  } catch (error) {
    console.error(`[Yellow] Failed to query token decimals for ${tokenAddress}:`, error);
    // Default to 18 for unknown tokens (safest assumption)
    console.warn(`[Yellow] Defaulting to 18 decimals for token ${tokenAddress}`);
    return 18;
  }
}
```

**Changes Explained:**
1. Add Map cache to store token decimals
2. Create utility function to query decimals
3. Cache results to avoid repeated queries
4. Fallback to 18 decimals if query fails
5. Add logging for debugging

---

### Step 4: Fix Issue 3 - Dynamic Token Decimals (openChannel)

**File:** `frontend/lib/services/yellow.ts`
**Function:** `openChannel()`
**Lines:** 775-790

**Current Code:**
```typescript
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
```

**New Code:**
```typescript
// Determine token address based on chain
const tokenAddress = (token || YELLOW_CONFIG.TEST_USD) as Address;
const custodyAddress = YELLOW_CONFIG.CUSTODY as Address;

// Query token decimals before parsing amount
const tokenDecimals = await getTokenDecimals(publicClient, tokenAddress);
console.log(`[Yellow] Token ${tokenAddress} uses ${tokenDecimals} decimals`);

// Step 1: Approve token spending with correct decimals
const depositAmount = parseUnits(deposit.toString(), tokenDecimals);
console.log(`[Yellow] Parsed amount: ${deposit} tokens = ${depositAmount.toString()} wei`);

console.log(`[Yellow] Step 1: Approving ${deposit} tokens...`);
const approvalTxHash = await approveToken({
  walletClient,
  publicClient,
  tokenAddress,
  spenderAddress: custodyAddress,
  amount: depositAmount,
});
```

**Changes Explained:**
1. Query token decimals before parseUnits()
2. Use queried decimals instead of hardcoded 18
3. Add logging to verify correct parsing
4. Remove misleading comment about 18 decimals

---

### Step 5: Fix Issue 3 - Dynamic Token Decimals (updateAllocation)

**File:** `frontend/lib/services/yellow.ts`
**Function:** `updateAllocation()`
**Lines:** 916-921

**Current Code:**
```typescript
// Convert allocation to SDK format (amounts in smallest unit - 6 decimals for USDC)
const allocations = Object.entries(newAllocation).map(
  ([participant, amount]) => ({
    participant: participant as Address,
    asset: YELLOW_CONFIG.BASE_USDC as Address,
    amount: BigInt(Math.round(amount * 1e6)).toString(),
  })
);
```

**New Code:**
```typescript
// Note: We need publicClient to query decimals, but it's not available in this function
// For now, use 6 decimals for USDC (will be fixed in future refactor)
// TODO: Add publicClient parameter or pass decimals from caller

// Convert allocation to SDK format (amounts in smallest unit)
const tokenAddress = YELLOW_CONFIG.BASE_USDC as Address;
// Hardcoded to 6 decimals for USDC - this is correct for Base USDC
// In future, should query decimals or accept as parameter
const decimals = 6;

const allocations = Object.entries(newAllocation).map(
  ([participant, amount]) => ({
    participant: participant as Address,
    asset: tokenAddress,
    amount: BigInt(Math.round(amount * 10 ** decimals)).toString(),
  })
);
```

**Changes Explained:**
1. Document that decimals are hardcoded to 6 for USDC
2. Make it clear this is intentional for Base USDC
3. Add TODO for future improvement
4. Make decimal calculation explicit

**Note:** This function is less critical since it correctly uses 6 decimals for USDC. However, it should be made configurable in future refactors.

---

### Step 6: Fix Issue 3 - Dynamic Token Decimals (openChannelWithSDK)

**File:** `frontend/lib/services/yellow.ts`
**Function:** `openChannelWithSDK()`
**Lines:** 1083-1084

**Current Code:**
```typescript
// Step 3: Create signed resize message to deposit funds
const depositAmount = BigInt(Math.round(params.deposit * 1e6)); // USDC has 6 decimals
```

**New Code:**
```typescript
// Step 3: Create signed resize message to deposit funds
// Note: This function doesn't have publicClient access, so we use 6 decimals for USDC
// This is correct for Base USDC on mainnet (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
const tokenAddress = (params.token || YELLOW_CONFIG.BASE_USDC) as Address;
const decimals = 6; // USDC standard - should query in future if supporting other tokens
const depositAmount = BigInt(Math.round(params.deposit * 10 ** decimals));
console.log(`[Yellow] Deposit amount: ${params.deposit} USDC = ${depositAmount.toString()} wei`);
```

**Changes Explained:**
1. Document hardcoded 6 decimals for USDC
2. Add token address variable for clarity
3. Make decimal calculation explicit
4. Add logging for verification

---

### Step 7: Fix Issue 2 - Extract Channel Metadata from ClearNode Response

**File:** `frontend/lib/services/yellow.ts`
**Function:** `openChannel()`
**Lines:** 804-815

**Current Code:**
```typescript
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
```

**New Code:**
```typescript
const channelId = createChannelResponse.channel_id;
console.log(`[Yellow] Channel created: ${channelId}`);

// Extract channel metadata from ClearNode response
// ClearNode returns the canonical channel parameters that will be used on-chain
const clearnodeParticipant = createChannelResponse.participant ||
                             createChannelResponse.clearnode_address ||
                             createChannelResponse.server_address;

if (!clearnodeParticipant) {
  console.error('[Yellow] ClearNode response missing participant address:', createChannelResponse);
  throw new Error('ClearNode response missing participant address - cannot create channel');
}

const adjudicator = createChannelResponse.adjudicator || YELLOW_CONFIG.ADJUDICATOR;
const challenge = createChannelResponse.challenge !== undefined
  ? BigInt(createChannelResponse.challenge)
  : BigInt(3600);  // 1 hour default
const nonce = createChannelResponse.nonce !== undefined
  ? BigInt(createChannelResponse.nonce)
  : BigInt(Date.now());

// Log extracted metadata for debugging
console.log('[Yellow] Channel metadata extracted from ClearNode:');
console.log(`  - Participants: [${poster}, ${clearnodeParticipant}]`);
console.log(`  - Adjudicator: ${adjudicator}`);
console.log(`  - Challenge period: ${challenge.toString()}s`);
console.log(`  - Nonce: ${nonce.toString()}`);

// Warn if using fallback values
if (!createChannelResponse.adjudicator) {
  console.warn('[Yellow] Using fallback adjudicator address - may cause channelId mismatch');
}
if (createChannelResponse.challenge === undefined) {
  console.warn('[Yellow] Using fallback challenge period - may cause channelId mismatch');
}
if (createChannelResponse.nonce === undefined) {
  console.warn('[Yellow] Using fallback nonce - may cause channelId mismatch');
}

// Store channel metadata for later use in Custody.create()
const channelMetadata: ChannelMetadata = {
  channelId: channelId,
  participants: [
    poster.toLowerCase(),
    clearnodeParticipant.toLowerCase(),
  ] as [string, string],
  adjudicator: adjudicator,
  challenge: challenge,
  nonce: nonce,
};
channelMetadataCache.set(channelMetadata.channelId, channelMetadata);
```

**Changes Explained:**
1. Try multiple possible response field names for participant
2. Throw error if participant address is missing (critical field)
3. Extract adjudicator from response with fallback
4. Extract challenge period from response with fallback
5. Extract nonce from response with fallback
6. Add detailed logging of extracted metadata
7. Warn if fallback values are used (indicates response format issue)
8. Use extracted values instead of hardcoded defaults

**Testing Criteria:**
- [ ] Log actual ClearNode response format
- [ ] Verify all metadata fields are extracted correctly
- [ ] Confirm no fallback warnings in production
- [ ] Validate channelId matches between ClearNode and contract

---

### Step 8: Update Type Imports for State Utilities

**File:** `frontend/lib/services/yellow.ts`
**Location:** Import section (around line 45)

**Current Code:**
```typescript
import {
  type Address,
  type WalletClient,
  type PublicClient,
  type Hex,
  parseUnits,
  formatUnits,
} from 'viem';
```

**New Code:**
```typescript
import {
  type Address,
  type WalletClient,
  type PublicClient,
  type Hex,
  parseUnits,
  formatUnits,
  keccak256,
  encodeAbiParameters,
} from 'viem';
```

**Changes Explained:**
- Add `keccak256` import (used by state utilities)
- Add `encodeAbiParameters` import (used by state utilities)
- These are needed if we implement custom state hash (though SDK provides it)

---

## Testing Strategy

### Unit Tests to Add

**File:** `frontend/lib/services/__tests__/yellow.test.ts` (CREATE)

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { getStateHash } from '@erc7824/nitrolite/dist/utils/state';
import { keccak256, encodeAbiParameters } from 'viem';

describe('Yellow Service - Critical Fixes', () => {
  describe('State Hash Signature', () => {
    it('should create correct state hash format', () => {
      const channelId = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const state = {
        intent: 2, // RESIZE
        version: BigInt(1),
        data: '0x',
        allocations: [
          {
            destination: '0x1111111111111111111111111111111111111111',
            token: '0x2222222222222222222222222222222222222222',
            amount: BigInt(100000000), // 100 USDC (6 decimals)
          },
        ],
        sigs: [],
      };

      const hash = getStateHash(channelId, state);

      // Hash should be 32 bytes
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);

      // Hash should be deterministic
      const hash2 = getStateHash(channelId, state);
      expect(hash).toBe(hash2);
    });

    it('should match manual hash computation', () => {
      const channelId = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const state = {
        intent: 2,
        version: BigInt(1),
        data: '0x',
        allocations: [],
        sigs: [],
      };

      const sdkHash = getStateHash(channelId, state);

      // Manual computation
      const packed = encodeAbiParameters([
        { name: 'channelId', type: 'bytes32' },
        { name: 'intent', type: 'uint8' },
        { name: 'version', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        {
          name: 'allocations',
          type: 'tuple[]',
          components: [
            { name: 'destination', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
        },
      ], [channelId, state.intent, state.version, state.data, state.allocations]);

      const manualHash = keccak256(packed);

      expect(sdkHash).toBe(manualHash);
    });
  });

  describe('Token Decimals', () => {
    it('should parse USDC amount correctly with 6 decimals', () => {
      const amount = 100; // 100 USDC
      const decimals = 6;
      const parsed = BigInt(Math.round(amount * 10 ** decimals));

      expect(parsed.toString()).toBe('100000000'); // 100 * 10^6
    });

    it('should parse TestUSD amount correctly with 18 decimals', () => {
      const amount = 100; // 100 TestUSD
      const decimals = 18;
      const parsed = BigInt(Math.round(amount * 10 ** decimals));

      expect(parsed.toString()).toBe('100000000000000000000'); // 100 * 10^18
    });

    it('should NOT parse with wrong decimals', () => {
      const amount = 100; // 100 USDC
      const wrongDecimals = 18; // Should be 6 for USDC
      const parsed = BigInt(Math.round(amount * 10 ** wrongDecimals));

      // This would try to spend 1 trillion tokens!
      expect(parsed.toString()).toBe('100000000000000000000');
      expect(parsed.toString()).not.toBe('100000000');
    });
  });
});
```

---

### Integration Tests

**Test Plan Document:** `docs/YELLOW_INTEGRATION_TEST_PLAN.md` (CREATE)

```markdown
# Yellow Network Integration Test Plan

## Test Environment
- Network: Base Sepolia (testnet)
- ClearNode: wss://clearnet-sandbox.yellow.com/ws
- Token: Yellow TestUSD (18 decimals) - Address TBD
- Custody: 0x019B65A265EB3363822f2752141b3dF16131b262
- Adjudicator: 0x7c7ccbc98469190849BCC6c926307794fDfB11F2

## Pre-Test Checklist
- [ ] Wallet has Base Sepolia ETH for gas
- [ ] Wallet has TestUSD tokens (request from faucet)
- [ ] YELLOW_MOCK_MODE=false in .env.local
- [ ] All three critical fixes are applied

## Test Case 1: State Hash Signature Verification

**Objective:** Verify user signature matches expected format

**Steps:**
1. Create a test channel with small deposit (1 TestUSD)
2. Capture signed state from user wallet
3. Capture signed state from ClearNode server
4. Log both signatures
5. Submit to Custody.create()

**Expected Results:**
- [ ] User signature is 132 characters (0x + 130 hex)
- [ ] Server signature is 132 characters
- [ ] Custody.create() accepts both signatures
- [ ] Transaction confirms successfully
- [ ] No "Invalid signature" error

**Failure Indicators:**
- "Invalid signature" from Custody contract
- "Signer mismatch" from Custody contract
- Transaction reverts during signature validation

## Test Case 2: Channel Metadata Extraction

**Objective:** Verify channel metadata matches ClearNode response

**Steps:**
1. Call create_channel on ClearNode
2. Log full response JSON
3. Extract metadata fields
4. Log extracted metadata
5. Compute channelId locally
6. Compare with ClearNode's channelId

**Expected Results:**
- [ ] ClearNode response contains: participant, adjudicator, challenge, nonce
- [ ] No fallback warnings in logs
- [ ] Extracted metadata matches ClearNode response
- [ ] Computed channelId matches ClearNode channelId
- [ ] Custody.create() accepts the channel parameters

**Failure Indicators:**
- Missing fields in ClearNode response
- Fallback warnings in console
- ChannelId mismatch between local and ClearNode
- "Channel already exists" error (wrong nonce)
- "Invalid channel parameters" error

## Test Case 3: Token Decimals Query

**Objective:** Verify correct decimal parsing for different tokens

**Steps:**
1. Query TestUSD decimals from contract
2. Log decimals value
3. Parse 100 TestUSD deposit amount
4. Log parsed amount in wei
5. Approve and deposit

**Expected Results:**
- [ ] TestUSD decimals query returns 18
- [ ] Parsed amount = 100 * 10^18 = 100000000000000000000
- [ ] Approval succeeds
- [ ] Deposit succeeds
- [ ] Balance reflects correct amount

**Failure Indicators:**
- Decimals query fails or returns wrong value
- Parsed amount is incorrect (too large/small)
- "Insufficient balance" error
- "Allowance exceeded" error
- Balance is wrong after deposit

## Test Case 4: End-to-End Channel Creation

**Objective:** Complete channel creation flow with all fixes

**Steps:**
1. Set deposit amount: 50 TestUSD
2. Query token decimals
3. Approve token spending
4. Create channel via ClearNode
5. Extract metadata from response
6. Resize channel (deposit)
7. Sign state with proper hash
8. Submit Custody.create()
9. Verify channel on-chain

**Expected Results:**
- [ ] Decimals queried correctly (18 for TestUSD)
- [ ] Amount parsed correctly (50 * 10^18)
- [ ] Approval transaction succeeds
- [ ] Channel created with correct channelId
- [ ] Metadata extracted without fallbacks
- [ ] State signature accepted by contract
- [ ] Custody.create() transaction succeeds
- [ ] Channel status is ACTIVE on-chain
- [ ] Channel balance shows 50 TestUSD

**Failure Indicators:**
- Any step fails with error
- Transaction reverts
- Channel status not ACTIVE
- Balance is incorrect

## Test Case 5: Multiple Token Support

**Objective:** Verify fixes work with different token decimals

**Steps:**
1. Test with TestUSD (18 decimals)
2. Test with Base USDC (6 decimals) if available on testnet
3. Compare parsed amounts

**Expected Results:**
- [ ] TestUSD: 100 tokens = 100 * 10^18 wei
- [ ] USDC: 100 tokens = 100 * 10^6 wei
- [ ] Both channels create successfully
- [ ] Balances are correct

## Regression Tests

**Objective:** Ensure fixes don't break existing functionality

**Tests:**
- [ ] Mock mode still works (YELLOW_MOCK_MODE=true)
- [ ] Channel caching still works
- [ ] Error handling still works
- [ ] Fallback to mock on error still works
```

---

### Manual Testing Checklist

**Before Testing:**
- [ ] Code changes compiled without errors
- [ ] TypeScript types resolve correctly
- [ ] No lint errors
- [ ] All imports resolve

**Testing Sequence:**
1. [ ] Test with YELLOW_MOCK_MODE=true (should work as before)
2. [ ] Test with YELLOW_MOCK_MODE=false and small amount (1 TestUSD)
3. [ ] Check console logs for:
   - [ ] Token decimals query log
   - [ ] Parsed amount log
   - [ ] Metadata extraction logs
   - [ ] No fallback warnings
4. [ ] Verify transaction succeeds on Base Sepolia
5. [ ] Check channel state on-chain via block explorer
6. [ ] Test with larger amount (100 TestUSD)
7. [ ] Test full bounty flow (create, claim, approve)

---

## Risk Assessment

### High Risk Areas

1. **State Signature Breaking Change**
   - **Risk:** Existing mock/test code may expect old signature format
   - **Mitigation:** Test thoroughly in mock mode first
   - **Rollback:** Keep old function as `signChannelStateLegacy()` for migration

2. **ClearNode Response Format Unknown**
   - **Risk:** Actual response may differ from assumptions
   - **Mitigation:** Add extensive logging and flexible field extraction
   - **Rollback:** Use fallback values if extraction fails

3. **Token Decimal Query Failures**
   - **Risk:** Some tokens may not implement decimals() function
   - **Mitigation:** Catch errors and use safe default (18)
   - **Rollback:** Accept decimals as optional parameter

### Medium Risk Areas

1. **Performance Impact**
   - Token decimals query adds extra RPC call
   - **Mitigation:** Cache results aggressively

2. **Type Casting Issues**
   - Converting between string/bigint/number for decimals
   - **Mitigation:** Explicit type conversions with validation

### Low Risk Areas

1. **Logging Changes**
   - Additional console.log() calls
   - **Impact:** Minimal - can be removed later

2. **Comment Updates**
   - Fixing misleading comments
   - **Impact:** None - improves maintainability

---

## Success Criteria

### Critical (Must Have)
- [ ] Issue 1 Fixed: State signatures accepted by Custody.create()
- [ ] Issue 2 Fixed: Channel metadata extracted from ClearNode response
- [ ] Issue 3 Fixed: Token amounts use correct decimal places
- [ ] End-to-end channel creation succeeds on testnet
- [ ] No transaction reverts due to signature/metadata/amount errors

### Important (Should Have)
- [ ] Token decimal caching implemented
- [ ] Comprehensive error logging added
- [ ] Fallback handling for missing response fields
- [ ] Unit tests passing
- [ ] Integration tests documented

### Nice to Have (Could Have)
- [ ] Performance optimizations
- [ ] Additional token support
- [ ] Better error messages
- [ ] TypeScript type improvements

---

## Rollback Plan

If fixes cause unexpected issues:

### Immediate Rollback
```bash
git revert HEAD
git push
```

### Selective Rollback

**Revert Issue 1 Fix Only:**
```typescript
// Restore old signChannelState() function
const stateMessage = JSON.stringify({ channelId, ...state });
const signature = await walletClient.signMessage({ message: stateMessage });
```

**Revert Issue 2 Fix Only:**
```typescript
// Restore hardcoded metadata
const channelMetadata: ChannelMetadata = {
  channelId,
  participants: [poster.toLowerCase(), YELLOW_CONFIG.CUSTODY],
  adjudicator: YELLOW_CONFIG.ADJUDICATOR,
  challenge: BigInt(3600),
  nonce: BigInt(Date.now()),
};
```

**Revert Issue 3 Fix Only:**
```typescript
// Restore hardcoded decimals
const depositAmount = parseUnits(deposit.toString(), 18);
```

### Emergency Fallback
Set `YELLOW_MOCK_MODE=true` to bypass all Yellow Network integration and use mock implementations.

---

## Post-Implementation Tasks

### Documentation Updates
- [ ] Update CLAUDE.md with new implementation details
- [ ] Update Yellow integration guide
- [ ] Document ClearNode response format
- [ ] Add troubleshooting section

### Code Quality
- [ ] Add JSDoc comments to new functions
- [ ] Remove debug console.logs if excessive
- [ ] Add TypeScript strict checks
- [ ] Run linter and fix warnings

### Future Improvements
- [ ] Refactor to pass decimals as parameters (avoid repeated queries)
- [ ] Add token allowance check before every deposit
- [ ] Implement proper error types (not just Error)
- [ ] Add retry logic for failed RPC calls
- [ ] Create proper state management for channel metadata

---

## Timeline

**Estimated Implementation Time:** 2-3 hours

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | Add SDK imports | 5 min | 5 min |
| 2 | Fix state signature | 30 min | 35 min |
| 3 | Add decimal query utility | 20 min | 55 min |
| 4 | Fix decimals in openChannel | 15 min | 70 min |
| 5 | Fix decimals in updateAllocation | 10 min | 80 min |
| 6 | Fix decimals in openChannelWithSDK | 10 min | 90 min |
| 7 | Fix metadata extraction | 30 min | 120 min |
| 8 | Testing and validation | 30 min | 150 min |
| 9 | Documentation updates | 15 min | 165 min |

**Total:** 2h 45min

---

## References

### SDK Documentation
- Nitrolite SDK: https://docs.yellow.org/docs/build/quick-start
- State utilities: `node_modules/@erc7824/nitrolite/dist/utils/state.js`
- Custody ABI: `node_modules/@erc7824/nitrolite/dist/abis/generated.d.ts`

### Contract Addresses
- Custody (Base Sepolia): 0x019B65A265EB3363822f2752141b3dF16131b262
- Adjudicator (Base Sepolia): 0x7c7ccbc98469190849BCC6c926307794fDfB11F2
- TestUSD Token: 0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb

### Related Files
- Main implementation: `frontend/lib/services/yellow.ts`
- Type definitions: `frontend/lib/types/bounty.ts`
- Environment config: `frontend/.env.example`

### Previous Plans
- Bounty Yellow Integration: `.claude/memory-bank/main/plans/main-2026-02-05-bounty-yellow-integration.md`
- Yellow SDK Integration: `.claude/memory-bank/main/plans/main-2026-02-05-yellow-sdk-integration.md`

---

## Approval Checklist

Before moving to EXECUTE mode, verify:

- [ ] All three issues are clearly documented
- [ ] Root causes are explained with references
- [ ] Fix approach is technically sound
- [ ] Code changes are specified with line numbers
- [ ] Testing strategy is comprehensive
- [ ] Risk assessment is complete
- [ ] Rollback plan is documented
- [ ] Timeline is realistic

**Status:** READY FOR REVIEW

Once approved, move to EXECUTE mode to implement these critical fixes.

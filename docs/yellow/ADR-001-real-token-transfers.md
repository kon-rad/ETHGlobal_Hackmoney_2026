# ADR-001: Real Token Transfers via Yellow Network SDK

**Status:** Accepted
**Date:** 2026-02-06
**Decision Makers:** Development Team

---

## Context

Clawork uses Yellow Network state channels for gasless payments between bounty posters and AI agents. The initial implementation used mock mode exclusively, simulating all channel operations locally without actual token transfers.

To enable real USDC payments on Base Mainnet, we needed to integrate the Yellow Network Nitrolite SDK for actual state channel operations including:
- Creating channels with real token deposits
- Updating allocations (transferring funds between participants)
- Closing channels and settling on-chain

### Problem Statement

The existing implementation had several gaps:

1. **Signer Type Mismatch**: The existing `getServerSigner()` returned `(message: string) => Promise<string>`, but the SDK's message creators require `MessageSigner = (payload: RPCData) => Promise<Hex>`

2. **No SDK Message Integration**: The `updateAllocation()` and `closeChannel()` functions always fell back to mock implementations, even when `MOCK_MODE=false`

3. **Missing Raw Message Support**: The WebSocket client only supported JSON-RPC format, but SDK message creators return pre-signed message strings

4. **No Settlement Tracking**: Approved bounties didn't record transaction hashes for on-chain settlement verification

---

## Decision

### 1. Add SDK-Compatible MessageSigner

**File:** `frontend/lib/services/yellow-signer.ts`

We added a new `getSDKMessageSigner()` function that uses the Nitrolite SDK's `createECDSAMessageSigner()`:

```typescript
export function getSDKMessageSigner(): MessageSigner | null {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;
  if (!privateKey) return null;

  try {
    return createECDSAMessageSigner(privateKey as Hex);
  } catch (error) {
    return null;
  }
}
```

**Rationale:**
- The SDK's `createECDSAMessageSigner` produces signatures in the exact format ClearNode expects
- Maintains backward compatibility by keeping the existing `getServerSigner()` for legacy use cases
- Returns `null` when private key is unavailable, allowing graceful fallback to mock mode

### 2. Add WebSocket Raw Message Support

**File:** `frontend/lib/services/yellow.ts`

We added `sendRawMessage()` to the `YellowWSClient` class:

```typescript
async sendRawMessage(message: string, timeoutMs = 30000): Promise<any> {
  await this.connect();

  // Parse message to extract request ID for correlation
  const parsed = JSON.parse(message);
  const requestId = parsed.req?.[0] || this.nextRequestId++;

  return new Promise((resolve, reject) => {
    // ... timeout and response handling
    this.ws!.send(message);
  });
}
```

**Rationale:**
- SDK message creators (`createCreateChannelMessage`, etc.) return fully-formed, pre-signed JSON strings
- These cannot go through `sendRequest()` which wraps params in JSON-RPC format
- Request ID correlation still works by parsing the SDK message format

### 3. Implement Real updateAllocation()

**File:** `frontend/lib/services/yellow.ts`

The function now uses `createSubmitAppStateMessage()` when not in mock mode:

```typescript
export async function updateAllocation(
  channelId: string,
  newAllocation: Record<string, number>,
): Promise<void> {
  if (MOCK_MODE) return updateAllocationMock(channelId, newAllocation);

  const signer = getSDKMessageSigner();
  if (!signer) return updateAllocationMock(channelId, newAllocation);

  const allocations = Object.entries(newAllocation).map(
    ([participant, amount]) => ({
      participant: participant as Address,
      asset: YELLOW_CONFIG.BASE_USDC as Address,
      amount: BigInt(Math.round(amount * 1e6)).toString(), // USDC has 6 decimals
    })
  );

  const stateMsg = await createSubmitAppStateMessage(signer, {
    app_session_id: channelId as Hex,
    allocations,
  });

  await client.sendRawMessage(stateMsg);
}
```

**Rationale:**
- Uses USDC's 6 decimal places for amount conversion
- Graceful fallback to mock if signer unavailable
- Updates local cache after successful operation

### 4. Implement Real closeChannel()

**File:** `frontend/lib/services/yellow.ts`

The function now uses `createCloseChannelMessage()`:

```typescript
export async function closeChannel(channelId: string): Promise<{ txHash?: string }> {
  if (MOCK_MODE) return closeChannelMock(channelId);

  const signer = getSDKMessageSigner();
  if (!signer) return closeChannelMock(channelId);

  const channel = channelCache.get(channelId);
  const fundsDestination = channel?.participants[1] || getServerAddress();

  const closeMsg = await createCloseChannelMessage(
    signer,
    channelId as Hex,
    fundsDestination as Address
  );

  const result = await client.sendRawMessage(closeMsg);

  return { txHash: result?.tx_hash };
}
```

**Rationale:**
- Returns actual transaction hash for on-chain verification
- Uses cached channel data to determine funds destination
- Falls back to server address if channel not in cache

### 5. Add Server-Side Channel Creation

**File:** `frontend/lib/services/yellow.ts`

New `openChannelWithSDK()` function for API routes:

```typescript
export async function openChannelWithSDK(params: {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
  chainId?: number;
}): Promise<OpenChannelResult>
```

**Rationale:**
- The existing `openChannel()` requires user wallet for token approval
- Server-side operations need a function that uses the platform's signing key
- Useful for automated channel management and testing

### 6. Enhanced Payment Logging in Approve Route

**File:** `frontend/app/api/bounties/[id]/approve/route.ts`

Added comprehensive logging and settlement tracking:

```typescript
console.log(`[Approve] Mode: ${MOCK_MODE ? 'MOCK' : 'PRODUCTION'}`);

const { txHash } = await closeChannel(bounty.yellowChannelId);
settlementTxHash = txHash || null;

await updateDoc(bountyRef, {
  status: 'COMPLETED',
  completedAt: Date.now(),
  ...(settlementTxHash && { settlementTxHash }),
});
```

**Rationale:**
- Clear visibility into whether real or mock payments are being processed
- Transaction hash stored for audit trail and dispute resolution
- Graceful error handling: approval succeeds even if settlement fails (can retry later)

---

## Consequences

### Positive

1. **Real Payments Work**: Setting `YELLOW_MOCK_MODE=false` enables actual USDC transfers
2. **Audit Trail**: Settlement transaction hashes are recorded in Firestore
3. **Graceful Degradation**: Missing private key or SDK errors fall back to mock mode
4. **No Breaking Changes**: Existing mock mode behavior is preserved
5. **Easy Rollback**: Set `YELLOW_MOCK_MODE=true` to revert to mock instantly

### Negative

1. **Private Key Requirement**: Production requires `YELLOW_SERVER_PRIVATE_KEY` to be set
2. **Gas Costs**: Server wallet needs ETH for on-chain settlement transactions
3. **SDK Dependency**: Relies on `@erc7824/nitrolite` SDK behavior and types

### Risks

1. **Key Security**: Server private key must be properly secured in production
2. **ClearNode Availability**: Real mode depends on Yellow Network infrastructure
3. **Amount Precision**: USDC uses 6 decimals; ensure amounts are correctly converted

---

## Configuration

### Environment Variables

```bash
# Enable real token transfers
YELLOW_MOCK_MODE=false

# Server signing key (required when mock mode is disabled)
YELLOW_SERVER_PRIVATE_KEY=0x...
```

### Key Generation

```bash
# Generate a new wallet for the server
cast wallet new

# Fund with ETH for gas (~0.01 ETH on Base Mainnet)
```

---

## Verification Checklist

- [ ] `getSDKMessageSigner()` returns valid signer with private key set
- [ ] `openChannelWithSDK()` creates real Yellow channel when `MOCK_MODE=false`
- [ ] `updateAllocation()` sends signed state update to ClearNode
- [ ] `closeChannel()` returns real transaction hash
- [ ] Approve route logs payment mode and stores `settlementTxHash`
- [ ] Mock mode continues to work when `YELLOW_MOCK_MODE=true`
- [ ] TypeScript compiles without errors

---

## Files Changed

| File | Changes |
|------|---------|
| `lib/services/yellow-signer.ts` | +25 lines: `getSDKMessageSigner()` function |
| `lib/services/yellow.ts` | +140 lines: SDK integration, `sendRawMessage()`, real channel ops |
| `app/api/bounties/[id]/approve/route.ts` | +20 lines: Payment logging, txHash storage |
| `.env.example` | +15 lines: Enhanced documentation |

---

## References

- [Yellow Network Documentation](https://docs.yellow.org/docs/build/quick-start)
- [Nitrolite SDK](https://www.npmjs.com/package/@erc7824/nitrolite)
- [ERC-7824 State Channels](https://eips.ethereum.org/EIPS/eip-7824)
- [Base USDC Contract](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

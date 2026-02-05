# RIPER PLAN: Critical Bug Fixes for HackMoney Demo

**Project:** Clawork - AI Agent Bounty Marketplace
**Date:** 2026-02-05
**Branch:** main
**Priority:** CRITICAL - Required for Demo
**Status:** PLAN MODE

---

## Executive Summary

This plan addresses two critical issues blocking the HackMoney 2026 demo:

1. **Agent Lookup Bug** - Prevents agents from seeing submit button on claimed bounties
2. **Yellow Network SDK** - Currently mock-only, needs real integration for prize eligibility

---

## Issue #1: Agent Lookup Bug

### Problem Description

**Location:** `frontend/app/bounties/[id]/page.tsx` line 60

**Current Code:**
```typescript
async function fetchAgentId() {
  const res = await fetch(`/api/agents?wallet=${address}`);
  const data = await res.json();
  if (data.agents?.[0]) {
    setAgentId(data.agents[0].id);
  }
}
```

**Root Cause:**
- The bounty detail page queries `/api/agents?wallet=${address}`
- But the GET `/api/agents` endpoint only supports `?skill=` filter
- The `wallet` parameter is ignored, returning all agents
- The code then takes the first agent (wrong agent)

**Impact:**
- Agent cannot see "Submit Work" form on claimed bounties
- Breaks the core claim → submit → approve flow
- Demo-blocking bug

### Fix Plan

#### Step 1.1: Add Wallet Filter to Agents API

**File:** `frontend/app/api/agents/route.ts`
**Action:** MODIFY GET handler

Add wallet address filtering:

```typescript
// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const wallet = searchParams.get('wallet');  // NEW
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const agentsRef = collection(db, 'agents');
    const snapshot = await getDocs(agentsRef);

    let agents = snapshot.docs.map(doc => doc.data());

    // Filter by wallet address if provided (NEW)
    if (wallet) {
      const walletLower = wallet.toLowerCase();
      agents = agents.filter(a =>
        a.walletAddress?.toLowerCase() === walletLower
      );
    }

    // Filter by skill if provided
    if (skill) {
      const skillLower = skill.toLowerCase();
      agents = agents.filter(a =>
        a.skills?.some((s: string) => s.toLowerCase().includes(skillLower))
      );
    }

    // Apply limit
    agents = agents.slice(0, limit);

    // ... rest unchanged
  }
}
```

#### Step 1.2: Verify Bounty Detail Page Works

**File:** `frontend/app/bounties/[id]/page.tsx`
**Action:** No changes needed - existing code will work once API supports wallet filter

**Verification:**
1. Connect wallet A, register as agent
2. Connect wallet B, create bounty
3. Connect wallet A, claim bounty
4. Verify "Submit Work" form appears
5. Submit work successfully

---

## Issue #2: Yellow Network SDK Integration

### Problem Description

**Location:** `frontend/lib/services/yellow.ts`

**Current State:**
- SDK package installed (`@erc7824/nitrolite`)
- Mock mode enabled by default
- Real SDK imports commented out
- Type compatibility issues with `createAppSessionMessage`

**Impact:**
- Yellow Network prize requires real SDK integration
- State channels are simulated, not real
- No actual gasless payments

### Fix Plan

#### Step 2.1: Research SDK Type Requirements

**Action:** Examine SDK exports to understand correct type signatures

```bash
# Check what the SDK exports
cat node_modules/@erc7824/nitrolite/dist/index.d.ts | head -100
```

The SDK's `createAppSessionMessage` expects:
- `MessageSigner` type (accepts `RPCData`, not `string`)
- Different signature than our current implementation

#### Step 2.2: Create Compatible Signer Adapter

**File:** `frontend/lib/services/yellow.ts`
**Action:** MODIFY - Add type-compatible signer wrapper

```typescript
import {
  createAppSessionMessage,
  parseAnyRPCResponse,
  type MessageSigner,
  type RPCData,
} from '@erc7824/nitrolite';

// Adapter to convert our string signer to SDK's MessageSigner
function createMessageSigner(
  walletSigner: (message: string) => Promise<string>
): MessageSigner {
  return async (payload: RPCData): Promise<string> => {
    // Serialize the RPC payload to string for signing
    const message = JSON.stringify(payload);
    return walletSigner(message);
  };
}
```

#### Step 2.3: Implement Real Channel Operations

**File:** `frontend/lib/services/yellow.ts`
**Action:** MODIFY - Implement real SDK calls

```typescript
export async function openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
  const { poster, agent, deposit, token = 'USDC', signerFn } = params;

  // Check if we should use mock mode
  if (MOCK_MODE || !signerFn) {
    return openChannelMock(params);
  }

  try {
    const ws = await getConnection();
    const messageSigner = createMessageSigner(signerFn);

    const appDefinition = {
      protocol: 'clawork-bounty-v1',
      participants: [poster.toLowerCase(), agent.toLowerCase()],
      weights: [100, 0],
      quorum: 100,
      challenge: 86400,
      nonce: Date.now(),
    };

    const allocations = [
      {
        participant: poster.toLowerCase(),
        asset: token,
        amount: (deposit * 1e6).toString(),
      },
      {
        participant: agent.toLowerCase(),
        asset: token,
        amount: '0',
      },
    ];

    const sessionMessage = await createAppSessionMessage(
      messageSigner,
      [{ definition: appDefinition, allocations }]
    );

    // ... rest of implementation
  } catch (error) {
    console.error('Yellow SDK error, falling back to mock:', error);
    return openChannelMock(params);
  }
}
```

#### Step 2.4: Add Client-Side Signer Hook

**File:** `frontend/hooks/useYellowSigner.ts`
**Action:** CREATE

```typescript
'use client';

import { useAccount, useSignMessage } from 'wagmi';

export function useYellowSigner() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signerFn = async (message: string): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');
    return signMessageAsync({ message });
  };

  return {
    signerFn: address ? signerFn : undefined,
    address,
  };
}
```

#### Step 2.5: Update Bounty Creation to Use Client Signer

**File:** `frontend/app/bounties/create/page.tsx`
**Action:** MODIFY - Pass signer to API or handle client-side

For hackathon demo, we have two options:

**Option A: Server-side signing (simpler for demo)**
- Use platform custodial key in API routes
- Poster doesn't need to sign channel creation
- Less decentralized but works for demo

**Option B: Client-side signing (more correct)**
- Poster signs channel creation from browser
- Requires WebSocket connection in client
- More complex but proper implementation

**Recommendation:** Use Option A for hackathon, document Option B as future work.

#### Step 2.6: Environment Configuration

**File:** `frontend/.env.local`
**Action:** MODIFY - Add production Yellow config

```bash
# Yellow Network - Set to false for real integration
YELLOW_MOCK_MODE=false

# Server private key for signing (Option A)
YELLOW_SERVER_PRIVATE_KEY=0x...

# ClearNode endpoint
YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
```

#### Step 2.7: Test Yellow Integration

**Verification Steps:**
1. Set `YELLOW_MOCK_MODE=false`
2. Create bounty - observe WebSocket connection
3. Check ClearNode logs/response
4. Verify channel ID is real (not mock format)
5. Test allocation update on claim
6. Test settlement on approve

---

## Implementation Order

### Priority 1: Agent Lookup Bug (15 minutes)
1. Modify `app/api/agents/route.ts` - add wallet filter
2. Test bounty detail page agent lookup
3. Verify submit form appears for claimed bounties

### Priority 2: Yellow SDK (1-2 hours)
1. Research SDK type exports
2. Create signer adapter
3. Implement real channel operations
4. Add useYellowSigner hook (optional)
5. Test with sandbox ClearNode

---

## Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `app/api/agents/route.ts` | Add wallet filter | P1 |
| `lib/services/yellow.ts` | Implement real SDK | P2 |
| `hooks/useYellowSigner.ts` | Create (optional) | P2 |
| `.env.local` | Add Yellow config | P2 |

---

## Testing Checklist

### After Agent Lookup Fix
- [ ] Query `/api/agents?wallet=0x123...` returns matching agent only
- [ ] Query `/api/agents?wallet=0xnonexistent` returns empty array
- [ ] Bounty detail page shows correct agent ID
- [ ] Submit Work form appears for assigned agent
- [ ] Submit Work form hidden for non-assigned users

### After Yellow SDK Fix
- [ ] WebSocket connects to ClearNode
- [ ] Channel creation returns real channel ID
- [ ] Allocation update succeeds
- [ ] Channel close returns transaction hash
- [ ] Fallback to mock works when ClearNode unavailable

---

## Risk Mitigation

1. **Yellow SDK Issues**
   - Keep mock mode as fallback
   - Test in sandbox first
   - Document any SDK limitations

2. **Breaking Changes**
   - Agent lookup fix is backwards compatible
   - Yellow SDK falls back to mock on error

3. **Demo Safety**
   - Can always revert to mock mode for demo
   - Agent lookup fix is independent of Yellow

---

## Success Criteria

1. **Agent Lookup Fixed**
   - Agent can claim bounty → see submit form → submit work
   - Full lifecycle works end-to-end

2. **Yellow SDK Working**
   - Real channel operations with ClearNode
   - OR documented mock mode with clear path to real integration

---

*Plan created by RIPER Protocol - PLAN Mode*
*Ready for user approval before EXECUTE phase*

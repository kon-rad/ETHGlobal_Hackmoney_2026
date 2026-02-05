# RIPER PLAN: Bounty APIs, UI Pages & Yellow Network Integration

**Project:** Clawork - AI Agent Bounty Marketplace
**Date:** 2026-02-05
**Branch:** main
**Target:** HackMoney 2026 - Yellow Network $15k Prize Track
**Status:** PLAN MODE

---

## Executive Summary

This plan covers three high-priority features required for hackathon submission:
1. **Bounty APIs** - Complete CRUD and lifecycle management
2. **Bounty UI Pages** - Frontend marketplace interface
3. **Yellow Network SDK** - Real state channel integration for gasless payments

**Estimated Files to Create/Modify:** 18 files
**Dependencies to Add:** `@erc7824/nitrolite`

---

## Pre-Implementation Checklist

- [x] Existing bounty type definitions reviewed (`lib/types/bounty.ts`)
- [x] Agent API patterns analyzed (`app/api/agents/route.ts`)
- [x] Mock Yellow service reviewed (`lib/services/yellow.ts`)
- [x] Firebase integration understood (`lib/firebase.ts`)
- [x] Yellow Network SDK documentation reviewed
- [x] SKILL.md API contract reviewed

---

## PHASE 1: Bounty APIs (Priority: CRITICAL)

### 1.1 Create Bounty Types Enhancement

**File:** `frontend/lib/types/bounty.ts`
**Action:** MODIFY (add missing fields)

```typescript
// Add these fields to existing Bounty interface:
export interface Bounty {
  // ... existing fields ...

  // New fields for Yellow integration
  yellowChannelId?: string;
  yellowSessionId?: string;

  // Poster wallet for signing
  posterWalletAddress?: string;

  // Dispute fields
  disputeStatus?: 'NONE' | 'PENDING' | 'RESOLVED';
  disputeReason?: string;
  disputeTimestamp?: number;
}

// Add CreateBountyInput type
export interface CreateBountyInput {
  title: string;
  description: string;
  reward: number;
  rewardToken?: string; // default: 'USDC'
  type: BountyType;
  requiredSkills: string[];
  requirements: string;
  submitDeadlineDays?: number; // default: 3
  posterAddress: string;
}

// Add ClaimBountyInput type
export interface ClaimBountyInput {
  agentId: string;
  agentAddress: string;
}

// Add SubmitWorkInput type
export interface SubmitWorkInput {
  agentId: string;
  deliverableCID?: string;
  message: string;
}
```

### 1.2 Create Bounty List/Get API

**File:** `frontend/app/api/bounties/route.ts`
**Action:** CREATE

**Endpoints:**
- `GET /api/bounties` - List bounties with filters
- `POST /api/bounties` - Create new bounty (poster)

```typescript
// GET /api/bounties
// Query params: status, type, skills, minReward, posterAddress, limit
// Returns: { success: true, bounties: Bounty[], total: number }

// POST /api/bounties
// Body: CreateBountyInput
// Returns: { success: true, bountyId: string, bounty: Bounty }
// Side effects:
//   1. Create bounty document in Firebase 'bounties' collection
//   2. Open Yellow Network channel with poster deposit
//   3. Store channelId in bounty document
```

**Implementation Steps:**

1. Import dependencies (NextRequest, NextResponse, isAddress from viem, db from firebase, Yellow SDK)
2. Implement GET handler:
   - Parse query parameters (status, type, skills, minReward, limit)
   - Query Firebase 'bounties' collection
   - Apply filters in-memory (Firebase limitation)
   - Return paginated results
3. Implement POST handler:
   - Validate required fields (title, description, reward, posterAddress)
   - Validate posterAddress is valid Ethereum address
   - Generate bountyId: `bounty_${Date.now()}`
   - Calculate deadlines (submitDeadline = createdAt + 3 days)
   - Open Yellow channel via `openYellowChannel()`
   - Store bounty in Firebase with channelId
   - Return created bounty

### 1.3 Create Single Bounty API

**File:** `frontend/app/api/bounties/[id]/route.ts`
**Action:** CREATE

**Endpoints:**
- `GET /api/bounties/:id` - Get single bounty details

```typescript
// GET /api/bounties/:id
// Returns: { success: true, bounty: Bounty }
// Errors: BOUNTY_NOT_FOUND (404)
```

**Implementation Steps:**

1. Extract bounty ID from params
2. Query Firebase for bounty document
3. Return 404 if not found
4. Return bounty data with full details

### 1.4 Create Claim Bounty API

**File:** `frontend/app/api/bounties/[id]/claim/route.ts`
**Action:** CREATE

**Endpoint:** `POST /api/bounties/:id/claim`

```typescript
// POST /api/bounties/:id/claim
// Body: { agentId: string, agentAddress: string }
// Returns: { success: true, channelId: string, submitDeadline: string }
// Errors:
//   - BOUNTY_NOT_FOUND (404)
//   - BOUNTY_ALREADY_CLAIMED (400)
//   - BOUNTY_NOT_OPEN (400)
//   - INVALID_AGENT (400)
```

**Implementation Steps:**

1. Validate bounty exists and status is 'OPEN'
2. Validate agent exists in agents collection
3. Validate agentAddress matches agent's walletAddress
4. Update bounty document:
   - status: 'CLAIMED'
   - assignedAgentId: agentId
   - assignedAgentAddress: agentAddress
   - claimedAt: Date.now()
   - submitDeadline: Date.now() + (3 * 24 * 60 * 60 * 1000)
5. Update Yellow channel to add agent as participant
6. Return channelId and deadline

### 1.5 Create Submit Work API

**File:** `frontend/app/api/bounties/[id]/submit/route.ts`
**Action:** CREATE

**Endpoint:** `POST /api/bounties/:id/submit`

```typescript
// POST /api/bounties/:id/submit
// Body: { agentId: string, deliverableCID?: string, message: string }
// Returns: { success: true, reviewDeadline: string }
// Errors:
//   - BOUNTY_NOT_FOUND (404)
//   - BOUNTY_NOT_CLAIMED (400)
//   - NOT_ASSIGNED_AGENT (403)
//   - DEADLINE_PASSED (400)
```

**Implementation Steps:**

1. Validate bounty exists and status is 'CLAIMED'
2. Validate agentId matches assignedAgentId
3. Check submitDeadline hasn't passed
4. Update bounty document:
   - status: 'SUBMITTED'
   - submittedAt: Date.now()
   - deliverableCID: deliverableCID
   - deliverableMessage: message
   - reviewDeadline: Date.now() + (24 * 60 * 60 * 1000)
5. Return reviewDeadline

### 1.6 Create Approve Work API

**File:** `frontend/app/api/bounties/[id]/approve/route.ts`
**Action:** CREATE

**Endpoint:** `POST /api/bounties/:id/approve`

```typescript
// POST /api/bounties/:id/approve
// Body: { posterAddress: string, rating?: number }
// Returns: { success: true, message: string, txHash?: string }
// Errors:
//   - BOUNTY_NOT_FOUND (404)
//   - BOUNTY_NOT_SUBMITTED (400)
//   - NOT_POSTER (403)
```

**Implementation Steps:**

1. Validate bounty exists and status is 'SUBMITTED'
2. Validate posterAddress matches bounty.posterAddress
3. Update Yellow channel allocation (100% to agent)
4. Close Yellow channel (settle on-chain)
5. Update bounty document:
   - status: 'COMPLETED'
   - completedAt: Date.now()
6. Update agent reputation in Firebase
7. Optionally call ERC-8004 reputation registry to add feedback
8. Return success with settlement txHash

### 1.7 Create Dispute API

**File:** `frontend/app/api/bounties/[id]/dispute/route.ts`
**Action:** CREATE

**Endpoint:** `POST /api/bounties/:id/dispute`

```typescript
// POST /api/bounties/:id/dispute
// Body: { initiatorAddress: string, reason: string }
// Returns: { success: true, disputeId: string }
// Errors:
//   - BOUNTY_NOT_FOUND (404)
//   - INVALID_STATUS_FOR_DISPUTE (400)
//   - NOT_PARTICIPANT (403)
```

**Implementation Steps:**

1. Validate bounty exists
2. Validate status allows dispute (CLAIMED or SUBMITTED)
3. Validate initiator is poster or assigned agent
4. Update bounty document:
   - disputeStatus: 'PENDING'
   - disputeReason: reason
   - disputeTimestamp: Date.now()
5. Trigger Yellow adjudicator (if implemented)
6. Return disputeId

### 1.8 Create Auto-Release Cron Job (Optional but Recommended)

**File:** `frontend/app/api/cron/auto-release/route.ts`
**Action:** CREATE

**Endpoint:** `POST /api/cron/auto-release` (called by Vercel Cron)

```typescript
// Checks all SUBMITTED bounties where reviewDeadline has passed
// Auto-releases funds to agent
// Updates status to AUTO_RELEASED
```

---

## PHASE 2: Yellow Network SDK Integration (Priority: CRITICAL)

### 2.1 Install Yellow SDK

**Command:**
```bash
cd frontend && npm install @erc7824/nitrolite
```

### 2.2 Create Yellow SDK Client

**File:** `frontend/lib/services/yellow.ts`
**Action:** REPLACE (full rewrite)

```typescript
import {
  createAppSessionMessage,
  parseRPCResponse
} from '@erc7824/nitrolite';

const YELLOW_WS_URL = process.env.YELLOW_CLEARNODE_URL || 'wss://clearnet-sandbox.yellow.com/ws';
const YELLOW_TOKEN = process.env.NEXT_PUBLIC_YELLOW_TEST_USD || '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

// WebSocket connection singleton
let wsConnection: WebSocket | null = null;
let connectionPromise: Promise<WebSocket> | null = null;

interface YellowChannel {
  channelId: string;
  sessionId: string;
  participants: [string, string];
  deposit: number;
  token: string;
  status: 'PENDING' | 'OPEN' | 'CLOSING' | 'CLOSED';
  allocation: Record<string, number>;
  createdAt: number;
}

// In-memory channel cache (fallback for mock mode)
const channelCache = new Map<string, YellowChannel>();

export async function getConnection(): Promise<WebSocket> {
  // Return existing connection if available
  // Otherwise create new WebSocket connection
  // Handle reconnection logic
}

export async function openChannel(params: {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
  signerFn: (message: string) => Promise<string>;
}): Promise<{ channelId: string; sessionId: string }> {
  // 1. Connect to Yellow ClearNode
  // 2. Create app definition with participants
  // 3. Define initial allocation (100% to poster)
  // 4. Sign and send session message
  // 5. Wait for confirmation
  // 6. Return channelId and sessionId
}

export async function updateAllocation(
  channelId: string,
  newAllocation: Record<string, number>,
  signerFn: (message: string) => Promise<string>
): Promise<void> {
  // 1. Create allocation update message
  // 2. Sign with participant key
  // 3. Send to ClearNode
  // 4. Wait for confirmation
}

export async function closeChannel(
  channelId: string,
  signerFn: (message: string) => Promise<string>
): Promise<{ txHash: string }> {
  // 1. Create close channel message
  // 2. Both participants must sign (cooperative close)
  // 3. Submit to ClearNode for on-chain settlement
  // 4. Return settlement transaction hash
}

export async function getChannel(channelId: string): Promise<YellowChannel | null> {
  // Query channel state from ClearNode or cache
}

// Mock mode functions (keep for local development)
const MOCK_MODE = process.env.YELLOW_MOCK_MODE === 'true';

export async function openChannelMock(params: {...}): Promise<{...}> {
  // Existing mock implementation
}
```

### 2.3 Create Server-Side Signer Utility

**File:** `frontend/lib/services/yellow-signer.ts`
**Action:** CREATE

```typescript
import { privateKeyToAccount } from 'viem/accounts';

// For server-side signing (API routes)
// Uses a custodial key for the platform
export function getServerSigner() {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;
  if (!privateKey) throw new Error('YELLOW_SERVER_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return async (message: string): Promise<string> => {
    return await account.signMessage({ message });
  };
}
```

### 2.4 Update Environment Variables

**File:** `frontend/.env.local`
**Action:** MODIFY (add Yellow config)

```bash
# Yellow Network Configuration
YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
YELLOW_MOCK_MODE=false
YELLOW_SERVER_PRIVATE_KEY=0x... # Platform custodial key for settlements

# Public (client-side)
NEXT_PUBLIC_YELLOW_CUSTODY=0x019B65A265EB3363822f2752141b3dF16131b262
NEXT_PUBLIC_YELLOW_ADJUDICATOR=0x7c7ccbc98469190849BCC6c926307794fDfB11F2
NEXT_PUBLIC_YELLOW_TEST_USD=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

---

## PHASE 3: Bounty UI Pages (Priority: HIGH)

### 3.1 Create Bounty Card Component

**File:** `frontend/components/bounties/BountyCard.tsx`
**Action:** CREATE

```typescript
interface BountyCardProps {
  bounty: Bounty;
  onClick?: () => void;
  showActions?: boolean;
}

// Display:
// - Title, description preview
// - Reward amount with token icon
// - Status badge (color-coded)
// - Required skills tags
// - Time remaining (deadline)
// - Poster info (if available)
```

### 3.2 Create Bounty Status Badge Component

**File:** `frontend/components/bounties/BountyStatusBadge.tsx`
**Action:** CREATE

```typescript
// Status colors:
// OPEN: green
// CLAIMED: yellow
// SUBMITTED: blue
// COMPLETED: purple
// REJECTED: red
// AUTO_RELEASED: orange
```

### 3.3 Create Bounty List Page

**File:** `frontend/app/bounties/page.tsx`
**Action:** CREATE

**Features:**
- Grid layout of BountyCards
- Filter sidebar:
  - Status dropdown (OPEN, CLAIMED, etc.)
  - Type toggle (STANDARD, PROPOSAL)
  - Skills multi-select
  - Min reward slider
- Sort options (newest, highest reward, deadline)
- Pagination
- Empty state with CTA
- Loading skeleton

**Implementation:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { BountyCard } from '@/components/bounties/BountyCard';

export default function BountiesPage() {
  const [bounties, setBounties] = useState([]);
  const [filters, setFilters] = useState({
    status: 'OPEN',
    type: null,
    skills: [],
    minReward: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBounties();
  }, [filters]);

  // Fetch bounties from API with filters
  // Render grid with filter controls
}
```

### 3.4 Create Single Bounty Detail Page

**File:** `frontend/app/bounties/[id]/page.tsx`
**Action:** CREATE

**Features:**
- Full bounty details
- Requirements section
- Reward display (prominent)
- Deadline countdown timer
- Action buttons:
  - "Claim Bounty" (if OPEN, user is agent)
  - "Submit Work" (if CLAIMED by user)
  - "Approve Work" (if SUBMITTED, user is poster)
  - "Open Dispute" (if CLAIMED/SUBMITTED)
- Activity timeline (claimed, submitted, etc.)
- Poster/Agent info cards

### 3.5 Create Bounty Creation Page

**File:** `frontend/app/bounties/create/page.tsx`
**Action:** CREATE

**Features:**
- Multi-step form:
  1. Basic Info (title, description)
  2. Requirements (skills, detailed requirements)
  3. Reward (amount, token, deadline)
  4. Review & Create
- Wallet connection required
- Preview before submission
- Yellow Network channel creation on submit

**Form Fields:**
```typescript
interface CreateBountyForm {
  title: string;           // required, max 100 chars
  description: string;     // required, max 2000 chars
  requirements: string;    // required, markdown supported
  requiredSkills: string[]; // at least 1
  reward: number;          // min 1 USDC
  rewardToken: string;     // default 'USDC'
  type: 'STANDARD' | 'PROPOSAL';
  submitDeadlineDays: number; // default 3, max 30
}
```

### 3.6 Create Agent Dashboard Page

**File:** `frontend/app/dashboard/page.tsx`
**Action:** CREATE

**Features:**
- Tabs: "My Bounties" | "My Submissions" | "Completed"
- Agent profile summary (top)
- Reputation display
- Active bounties list
- Earnings summary
- Quick actions

**Sections:**
1. **Overview Stats:**
   - Total earnings
   - Active bounties
   - Completion rate
   - Reputation score

2. **Active Work Tab:**
   - Claimed bounties awaiting submission
   - Submitted work awaiting review
   - Deadlines highlighted

3. **History Tab:**
   - Completed bounties
   - Auto-released bounties
   - Disputes (if any)

### 3.7 Create Poster Dashboard Page

**File:** `frontend/app/dashboard/poster/page.tsx`
**Action:** CREATE

**Features:**
- Posted bounties list
- Pending reviews (submitted work)
- Completed bounties
- Total spent
- Create new bounty CTA

### 3.8 Update Navigation

**File:** `frontend/components/Navbar.tsx`
**Action:** MODIFY

**Add links:**
- "Browse Bounties" → `/bounties`
- "Create Bounty" → `/bounties/create` (if wallet connected)
- "Dashboard" → `/dashboard` (if wallet connected)

---

## PHASE 4: Integration & Polish

### 4.1 Create React Hooks

**File:** `frontend/hooks/useBounties.ts`
**Action:** CREATE

```typescript
export function useBounties(filters?: BountyFilters) {
  // Fetch bounties list with SWR/React Query
}

export function useBounty(id: string) {
  // Fetch single bounty
}

export function useClaimBounty() {
  // Mutation hook for claiming
}

export function useSubmitWork() {
  // Mutation hook for submission
}

export function useApproveWork() {
  // Mutation hook for approval
}
```

**File:** `frontend/hooks/useYellow.ts`
**Action:** CREATE

```typescript
export function useYellowChannel(channelId?: string) {
  // Get channel state
}

export function useYellowBalance(address: string) {
  // Get user's Yellow balance
}
```

### 4.2 Add Loading States & Error Handling

- Skeleton loaders for bounty cards
- Error boundaries for pages
- Toast notifications for actions
- Retry logic for failed requests

### 4.3 Mobile Responsiveness

- Responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Mobile-friendly filters (bottom sheet)
- Touch-friendly action buttons

---

## File Summary

### New Files to Create (14):
1. `frontend/app/api/bounties/route.ts`
2. `frontend/app/api/bounties/[id]/route.ts`
3. `frontend/app/api/bounties/[id]/claim/route.ts`
4. `frontend/app/api/bounties/[id]/submit/route.ts`
5. `frontend/app/api/bounties/[id]/approve/route.ts`
6. `frontend/app/api/bounties/[id]/dispute/route.ts`
7. `frontend/lib/services/yellow-signer.ts`
8. `frontend/components/bounties/BountyCard.tsx`
9. `frontend/components/bounties/BountyStatusBadge.tsx`
10. `frontend/app/bounties/page.tsx`
11. `frontend/app/bounties/[id]/page.tsx`
12. `frontend/app/bounties/create/page.tsx`
13. `frontend/app/dashboard/page.tsx`
14. `frontend/hooks/useBounties.ts`

### Files to Modify (4):
1. `frontend/lib/types/bounty.ts` - Add new types
2. `frontend/lib/services/yellow.ts` - Replace with real SDK
3. `frontend/components/Navbar.tsx` - Add navigation links
4. `frontend/.env.local` - Add Yellow config

---

## Environment Variables Required

```bash
# Yellow Network (Required for integration)
YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
YELLOW_MOCK_MODE=false
YELLOW_SERVER_PRIVATE_KEY=<platform-key>

# Public
NEXT_PUBLIC_YELLOW_CUSTODY=0x019B65A265EB3363822f2752141b3dF16131b262
NEXT_PUBLIC_YELLOW_ADJUDICATOR=0x7c7ccbc98469190849BCC6c926307794fDfB11F2
NEXT_PUBLIC_YELLOW_TEST_USD=0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

---

## Testing Checklist

### API Tests:
- [ ] POST /api/bounties creates bounty in Firebase
- [ ] GET /api/bounties returns filtered results
- [ ] POST /api/bounties/:id/claim updates status correctly
- [ ] POST /api/bounties/:id/submit validates agent ownership
- [ ] POST /api/bounties/:id/approve triggers Yellow settlement
- [ ] Deadline validation works correctly

### UI Tests:
- [ ] Bounty list page loads and filters work
- [ ] Bounty detail page shows all information
- [ ] Create bounty form validates and submits
- [ ] Dashboard shows correct user data
- [ ] Mobile layout is usable

### Yellow Integration Tests:
- [ ] Channel opens on bounty creation
- [ ] Allocation updates on claim
- [ ] Settlement executes on approval
- [ ] Mock mode works for local development

---

## Implementation Order

**Day 1 Priority (Core):**
1. Install `@erc7824/nitrolite`
2. Implement Bounty APIs (Phase 1.2-1.6)
3. Implement Yellow SDK client (Phase 2.2)
4. Create BountyCard component
5. Create Bounty List page
6. Create Bounty Detail page

**Day 1 Stretch (Demo-ready):**
7. Create Bounty creation page
8. Create basic Dashboard
9. Update Navbar
10. Test end-to-end flow

---

## Risk Mitigation

1. **Yellow SDK Issues:** Keep mock mode as fallback, document both paths
2. **Firebase Rate Limits:** Implement caching, limit query results
3. **Wallet Connection Issues:** Graceful degradation, clear error messages
4. **Deadline Edge Cases:** Use server timestamps, add buffer

---

## Demo Script (For Hackathon)

1. Show SKILL.md - explain agent onboarding
2. Register an agent via API
3. Create a bounty (shows Yellow channel creation)
4. Agent claims bounty (off-chain, zero gas)
5. Agent submits work
6. Poster approves (shows settlement)
7. Check agent reputation updated

**Key talking points:**
- Zero gas for workers via Yellow state channels
- Portable reputation via ERC-8004
- SKILL.md makes AI agent onboarding frictionless

---

*Plan created by RIPER Protocol - PLAN Mode*
*Ready for user approval before EXECUTE phase*

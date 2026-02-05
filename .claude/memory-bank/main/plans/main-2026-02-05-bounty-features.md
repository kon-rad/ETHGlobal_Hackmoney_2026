# Implementation Plan: Bounty Features & Agent Registration

**Branch:** main
**Date:** 2026-02-05
**Status:** PLAN (pending approval)

---

## Overview

This plan covers the implementation of:
1. Bounty API routes (hybrid approach)
2. Bounty UI components (feature-based)
3. Agent registration form (native state)
4. Yellow SDK mock service

---

## File Structure After Implementation

```
frontend/
├── app/
│   ├── api/
│   │   ├── agents/                    # Existing
│   │   └── bounties/
│   │       ├── route.ts               # GET list, POST create
│   │       └── [id]/
│   │           ├── route.ts           # GET single bounty
│   │           ├── claim/route.ts     # POST claim
│   │           ├── submit/route.ts    # POST submit work
│   │           └── approve/route.ts   # POST approve
│   ├── bounties/
│   │   ├── page.tsx                   # Bounty list page
│   │   ├── [id]/page.tsx              # Bounty detail page
│   │   └── create/page.tsx            # Create bounty page
│   └── register/
│       └── page.tsx                   # Agent registration page
├── components/
│   ├── agents/
│   │   └── AgentRegistrationForm.tsx  # NEW
│   └── bounties/
│       ├── BountyCard.tsx             # NEW
│       ├── BountyList.tsx             # NEW
│       ├── BountyDetail.tsx           # NEW
│       ├── BountyStatusBadge.tsx      # NEW
│       ├── ClaimBountyButton.tsx      # NEW
│       └── SubmitWorkForm.tsx         # NEW
└── lib/
    └── services/
        └── yellow.ts                  # NEW - Mock Yellow SDK
```

---

## Phase 1: Yellow SDK Mock Service

### Step 1.1: Create Yellow mock service

**File:** `frontend/lib/services/yellow.ts`

```typescript
// Mock Yellow Network SDK service
// Toggle MOCK_MODE via environment variable

const MOCK_MODE = process.env.YELLOW_MOCK_MODE !== 'false';

interface Channel {
  id: string;
  participants: [string, string];
  deposit: number;
  token: string;
  status: 'OPEN' | 'CLOSED';
  allocation: Record<string, number>;
  createdAt: number;
}

// In-memory store for mock channels
const mockChannels = new Map<string, Channel>();

export async function openChannel(params: {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
}): Promise<{ channelId: string }> {
  if (MOCK_MODE) {
    const channelId = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    mockChannels.set(channelId, {
      id: channelId,
      participants: [params.poster, params.agent],
      deposit: params.deposit,
      token: params.token || 'USDC',
      status: 'OPEN',
      allocation: { [params.poster]: params.deposit, [params.agent]: 0 },
      createdAt: Date.now(),
    });
    return { channelId };
  }

  // TODO: Real Yellow SDK integration
  // const nitrolite = new NitroliteClient(YELLOW_CLEARNODE);
  // return await nitrolite.openChannel(params);
  throw new Error('Real Yellow SDK not implemented');
}

export async function updateAllocation(
  channelId: string,
  allocation: Record<string, number>
): Promise<void> {
  if (MOCK_MODE) {
    const channel = mockChannels.get(channelId);
    if (!channel) throw new Error('Channel not found');
    channel.allocation = allocation;
    return;
  }
  throw new Error('Real Yellow SDK not implemented');
}

export async function closeChannel(channelId: string): Promise<void> {
  if (MOCK_MODE) {
    const channel = mockChannels.get(channelId);
    if (!channel) throw new Error('Channel not found');
    channel.status = 'CLOSED';
    return;
  }
  throw new Error('Real Yellow SDK not implemented');
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  if (MOCK_MODE) {
    return mockChannels.get(channelId) || null;
  }
  throw new Error('Real Yellow SDK not implemented');
}
```

---

## Phase 2: Bounty API Routes

### Step 2.1: Create bounty types

**File:** `frontend/lib/types/bounty.ts`

```typescript
export type BountyStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'AUTO_RELEASED';

export type BountyType = 'STANDARD' | 'PROPOSAL';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: BountyType;
  status: BountyStatus;

  posterAddress: string;
  posterName?: string;

  assignedAgentId?: string;
  assignedAgentAddress?: string;
  yellowChannelId?: string;

  createdAt: number;
  claimedAt?: number;
  submittedAt?: number;
  completedAt?: number;

  submitDeadline?: number;
  reviewDeadline?: number;

  deliverableCID?: string;
  deliverableMessage?: string;

  requiredSkills: string[];
  requirements: string;
}
```

### Step 2.2: Create main bounties route

**File:** `frontend/app/api/bounties/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

// POST /api/bounties - Create a new bounty
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, reward, posterAddress, requiredSkills, requirements } = body;

    // Validation
    if (!title || title.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TITLE', message: 'Title must be at least 5 characters' } },
        { status: 400 }
      );
    }

    if (!description || description.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DESCRIPTION', message: 'Description must be at least 20 characters' } },
        { status: 400 }
      );
    }

    if (!reward || reward < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REWARD', message: 'Reward must be at least 1 USDC' } },
        { status: 400 }
      );
    }

    if (!posterAddress || !isAddress(posterAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_POSTER', message: 'Valid poster wallet address required' } },
        { status: 400 }
      );
    }

    const bountyId = `bounty_${Date.now()}`;
    const bountyData = {
      id: bountyId,
      title: title.trim(),
      description: description.trim(),
      reward: Number(reward),
      type: 'STANDARD',
      status: 'OPEN',
      posterAddress: posterAddress.toLowerCase(),
      requiredSkills: requiredSkills?.map((s: string) => s.toLowerCase().trim()) || [],
      requirements: requirements?.trim() || '',
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'bounties', bountyId), bountyData);

    return NextResponse.json({
      success: true,
      bountyId,
      ...bountyData,
      message: 'Bounty created successfully!',
    });

  } catch (error) {
    console.error('Create bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create bounty' } },
      { status: 500 }
    );
  }
}

// GET /api/bounties - List bounties
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const skill = searchParams.get('skill');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const bountiesRef = collection(db, 'bounties');
    const snapshot = await getDocs(bountiesRef);

    let bounties = snapshot.docs.map(doc => doc.data());

    // Filter by status
    if (status) {
      bounties = bounties.filter(b => b.status === status.toUpperCase());
    }

    // Filter by skill
    if (skill) {
      const skillLower = skill.toLowerCase();
      bounties = bounties.filter(b =>
        b.requiredSkills?.some((s: string) => s.includes(skillLower))
      );
    }

    // Sort by newest first
    bounties.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    bounties = bounties.slice(0, limit);

    return NextResponse.json({
      success: true,
      bounties,
      total: bounties.length,
    });

  } catch (error) {
    console.error('List bounties error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list bounties' } },
      { status: 500 }
    );
  }
}
```

### Step 2.3: Create single bounty route

**File:** `frontend/app/api/bounties/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/bounties/:id
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const bountyDoc = await getDoc(doc(db, 'bounties', id));

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bounty: bountyDoc.data(),
    });

  } catch (error) {
    console.error('Get bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get bounty' } },
      { status: 500 }
    );
  }
}
```

### Step 2.4: Create claim route

**File:** `frontend/app/api/bounties/[id]/claim/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { openChannel } from '@/lib/services/yellow';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/claim
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId, agentAddress } = body;

    if (!agentId || !agentAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AGENT', message: 'Agent ID and address required' } },
        { status: 400 }
      );
    }

    const bountyRef = doc(db, 'bounties', id);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    const bounty = bountyDoc.data();

    if (bounty.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_OPEN', message: 'Bounty is not available for claiming' } },
        { status: 400 }
      );
    }

    // Open Yellow state channel
    const { channelId } = await openChannel({
      poster: bounty.posterAddress,
      agent: agentAddress.toLowerCase(),
      deposit: bounty.reward,
    });

    // Update bounty
    const submitDeadline = Date.now() + (3 * 24 * 60 * 60 * 1000); // 3 days
    await updateDoc(bountyRef, {
      status: 'CLAIMED',
      assignedAgentId: agentId,
      assignedAgentAddress: agentAddress.toLowerCase(),
      yellowChannelId: channelId,
      claimedAt: Date.now(),
      submitDeadline,
    });

    return NextResponse.json({
      success: true,
      channelId,
      submitDeadline,
      message: 'Bounty claimed! Complete and submit your work before the deadline.',
    });

  } catch (error) {
    console.error('Claim bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to claim bounty' } },
      { status: 500 }
    );
  }
}
```

### Step 2.5: Create submit route

**File:** `frontend/app/api/bounties/[id]/submit/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/submit
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId, deliverableCID, message } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AGENT', message: 'Agent ID required' } },
        { status: 400 }
      );
    }

    if (!deliverableCID && !message) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DELIVERABLE', message: 'Deliverable CID or message required' } },
        { status: 400 }
      );
    }

    const bountyRef = doc(db, 'bounties', id);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    const bounty = bountyDoc.data();

    if (bounty.status !== 'CLAIMED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Bounty must be claimed to submit work' } },
        { status: 400 }
      );
    }

    if (bounty.assignedAgentId !== agentId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this bounty' } },
        { status: 403 }
      );
    }

    // Check deadline
    if (bounty.submitDeadline && Date.now() > bounty.submitDeadline) {
      return NextResponse.json(
        { success: false, error: { code: 'DEADLINE_PASSED', message: 'Submit deadline has passed' } },
        { status: 400 }
      );
    }

    // Update bounty
    const reviewDeadline = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    await updateDoc(bountyRef, {
      status: 'SUBMITTED',
      deliverableCID: deliverableCID || null,
      deliverableMessage: message || null,
      submittedAt: Date.now(),
      reviewDeadline,
    });

    return NextResponse.json({
      success: true,
      reviewDeadline,
      message: 'Work submitted! Poster has 24 hours to review.',
    });

  } catch (error) {
    console.error('Submit work error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to submit work' } },
      { status: 500 }
    );
  }
}
```

### Step 2.6: Create approve route

**File:** `frontend/app/api/bounties/[id]/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { updateAllocation, closeChannel } from '@/lib/services/yellow';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/approve
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { posterAddress, approved } = body;

    if (!posterAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_POSTER', message: 'Poster address required' } },
        { status: 400 }
      );
    }

    const bountyRef = doc(db, 'bounties', id);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    const bounty = bountyDoc.data();

    if (bounty.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Bounty must be submitted to approve' } },
        { status: 400 }
      );
    }

    if (bounty.posterAddress !== posterAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_POSTER', message: 'Only the poster can approve this bounty' } },
        { status: 403 }
      );
    }

    if (approved) {
      // Transfer funds to agent via Yellow channel
      if (bounty.yellowChannelId) {
        await updateAllocation(bounty.yellowChannelId, {
          [bounty.assignedAgentAddress]: bounty.reward,
          [bounty.posterAddress]: 0,
        });
        await closeChannel(bounty.yellowChannelId);
      }

      // Update bounty status
      await updateDoc(bountyRef, {
        status: 'COMPLETED',
        completedAt: Date.now(),
      });

      // Update agent reputation
      if (bounty.assignedAgentId) {
        const agentRef = doc(db, 'agents', bounty.assignedAgentId);
        await updateDoc(agentRef, {
          'reputation.totalJobs': increment(1),
          'reputation.positive': increment(1),
          'reputation.score': increment(0.2), // Simple scoring
        });
      }

      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        message: 'Work approved! Payment released to agent.',
      });
    } else {
      // Rejected
      await updateDoc(bountyRef, {
        status: 'REJECTED',
        completedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        status: 'REJECTED',
        message: 'Work rejected. Bounty marked as rejected.',
      });
    }

  } catch (error) {
    console.error('Approve bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process approval' } },
      { status: 500 }
    );
  }
}
```

---

## Phase 3: Bounty UI Components

### Step 3.1: Create BountyStatusBadge

**File:** `frontend/components/bounties/BountyStatusBadge.tsx`

```typescript
'use client';

interface BountyStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Open' },
  CLAIMED: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'In Progress' },
  SUBMITTED: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Under Review' },
  COMPLETED: { bg: 'bg-primary/20', text: 'text-primary', label: 'Completed' },
  REJECTED: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Rejected' },
  AUTO_RELEASED: { bg: 'bg-purple-900/50', text: 'text-purple-400', label: 'Auto Released' },
};

export function BountyStatusBadge({ status, size = 'md' }: BountyStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.OPEN;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${config.bg} ${config.text} ${sizeClasses} rounded-full font-medium`}>
      {config.label}
    </span>
  );
}
```

### Step 3.2: Create BountyCard

**File:** `frontend/components/bounties/BountyCard.tsx`

```typescript
'use client';

import { BountyStatusBadge } from './BountyStatusBadge';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: string;
  requiredSkills: string[];
  posterAddress: string;
  createdAt: number;
  submitDeadline?: number;
}

interface BountyCardProps {
  bounty: Bounty;
  onClick?: () => void;
}

export function BountyCard({ bounty, onClick }: BountyCardProps) {
  const shortPoster = `${bounty.posterAddress.slice(0, 6)}...${bounty.posterAddress.slice(-4)}`;

  // Format deadline if exists
  const deadlineText = bounty.submitDeadline
    ? new Date(bounty.submitDeadline).toLocaleDateString()
    : null;

  return (
    <div
      className={`
        bg-slate-800/50 border border-slate-700 rounded-xl p-5
        hover:border-primary/50 hover:bg-slate-800/70 transition-all
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-lg truncate">{bounty.title}</h3>
          <p className="text-slate-400 text-sm font-mono">by {shortPoster}</p>
        </div>
        <BountyStatusBadge status={bounty.status} size="sm" />
      </div>

      {/* Description */}
      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
        {bounty.description}
      </p>

      {/* Reward */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">${bounty.reward}</span>
          <span className="text-slate-400 text-sm">USDC</span>
        </div>
        {deadlineText && (
          <span className="text-slate-500 text-xs">
            Due: {deadlineText}
          </span>
        )}
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-2">
        {bounty.requiredSkills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
          >
            {skill}
          </span>
        ))}
        {bounty.requiredSkills.length > 4 && (
          <span className="text-slate-500 text-xs py-1">
            +{bounty.requiredSkills.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}
```

### Step 3.3: Create BountyList

**File:** `frontend/components/bounties/BountyList.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { BountyCard } from './BountyCard';
import { useRouter } from 'next/navigation';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: string;
  requiredSkills: string[];
  posterAddress: string;
  createdAt: number;
  submitDeadline?: number;
}

export function BountyList() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetchBounties();
  }, [statusFilter]);

  async function fetchBounties() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/bounties?${params}`);
      const data = await res.json();

      if (data.success) {
        setBounties(data.bounties);
      }
    } catch (error) {
      console.error('Failed to fetch bounties:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'OPEN', 'CLAIMED', 'SUBMITTED', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary text-background-dark'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400">Loading bounties...</div>
      )}

      {/* Empty state */}
      {!loading && bounties.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No bounties found. Be the first to create one!
        </div>
      )}

      {/* Grid */}
      {!loading && bounties.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bounties.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              onClick={() => router.push(`/bounties/${bounty.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3.4: Create ClaimBountyButton

**File:** `frontend/components/bounties/ClaimBountyButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

interface ClaimBountyButtonProps {
  bountyId: string;
  onClaimed?: () => void;
}

export function ClaimBountyButton({ bountyId, onClaimed }: ClaimBountyButtonProps) {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First check if user is registered as agent
      const agentsRes = await fetch(`/api/agents?wallet=${address}`);
      const agentsData = await agentsRes.json();

      let agentId = agentsData.agents?.[0]?.id;

      if (!agentId) {
        setError('Please register as an agent first');
        setLoading(false);
        return;
      }

      // Claim the bounty
      const res = await fetch(`/api/bounties/${bountyId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentAddress: address }),
      });

      const data = await res.json();

      if (data.success) {
        onClaimed?.();
      } else {
        setError(data.error?.message || 'Failed to claim bounty');
      }
    } catch (err) {
      setError('Failed to claim bounty');
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <button
        disabled
        className="w-full bg-slate-700 text-slate-400 px-6 py-3 rounded-lg font-bold cursor-not-allowed"
      >
        Connect Wallet to Claim
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={loading}
        className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
          loading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-primary text-background-dark hover:opacity-90'
        }`}
      >
        {loading ? 'Claiming...' : 'Claim Bounty'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
```

### Step 3.5: Create SubmitWorkForm

**File:** `frontend/components/bounties/SubmitWorkForm.tsx`

```typescript
'use client';

import { useState } from 'react';

interface SubmitWorkFormProps {
  bountyId: string;
  agentId: string;
  onSubmitted?: () => void;
}

export function SubmitWorkForm({ bountyId, agentId, onSubmitted }: SubmitWorkFormProps) {
  const [deliverableCID, setDeliverableCID] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!deliverableCID && !message.trim()) {
      setError('Please provide a deliverable CID or message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bounties/${bountyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          deliverableCID: deliverableCID || null,
          message: message.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSubmitted?.();
      } else {
        setError(data.error?.message || 'Failed to submit work');
      }
    } catch (err) {
      setError('Failed to submit work');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          IPFS CID (optional)
        </label>
        <input
          type="text"
          value={deliverableCID}
          onChange={(e) => setDeliverableCID(e.target.value)}
          placeholder="Qm..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Message / Description
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your work..."
          rows={4}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
          loading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-primary text-background-dark hover:opacity-90'
        }`}
      >
        {loading ? 'Submitting...' : 'Submit Work'}
      </button>
    </form>
  );
}
```

---

## Phase 4: Agent Registration Form

### Step 4.1: Create AgentRegistrationForm

**File:** `frontend/components/agents/AgentRegistrationForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';

const COMMON_SKILLS = [
  'solidity', 'typescript', 'javascript', 'python', 'rust',
  'testing', 'auditing', 'research', 'design', 'writing',
];

export function AgentRegistrationForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [name, setName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSkill(skill: string) {
    setSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim().toLowerCase();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setCustomSkill('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    if (skills.length === 0) {
      setError('Select at least one skill');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          name: name.trim(),
          skills,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/bounties');
      } else {
        setError(data.error?.message || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Register as Agent</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">Connect your wallet to register</p>
          <ConnectButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Wallet */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wallet Address
            </label>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-400 font-mono text-sm">
              {address}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              maxLength={50}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Skills * (select at least one)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_SKILLS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    skills.includes(skill)
                      ? 'bg-primary text-background-dark'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            {/* Custom skill input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                placeholder="Add custom skill"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-600 text-sm"
              >
                Add
              </button>
            </div>
            {/* Selected skills display */}
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.filter(s => !COMMON_SKILLS.includes(s)).map(skill => (
                  <span
                    key={skill}
                    className="bg-primary/20 text-primary px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className="hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
              loading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-background-dark hover:opacity-90'
            }`}
          >
            {loading ? 'Registering...' : 'Register Agent'}
          </button>
        </form>
      )}
    </div>
  );
}
```

---

## Phase 5: Pages

### Step 5.1: Create bounties list page

**File:** `frontend/app/bounties/page.tsx`

```typescript
import { Navbar } from '@/components/Navbar';
import { BountyList } from '@/components/bounties/BountyList';
import Link from 'next/link';

export const metadata = {
  title: 'Bounties | Clawork',
  description: 'Browse and claim bounties on Clawork',
};

export default function BountiesPage() {
  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Bounties</h1>
          <Link
            href="/bounties/create"
            className="bg-primary text-background-dark px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90"
          >
            Post Bounty
          </Link>
        </div>

        <BountyList />
      </div>
    </div>
  );
}
```

### Step 5.2: Create bounty detail page

**File:** `frontend/app/bounties/[id]/page.tsx`

```typescript
'use client';

import { useState, useEffect, use } from 'react';
import { Navbar } from '@/components/Navbar';
import { BountyStatusBadge } from '@/components/bounties/BountyStatusBadge';
import { ClaimBountyButton } from '@/components/bounties/ClaimBountyButton';
import { SubmitWorkForm } from '@/components/bounties/SubmitWorkForm';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: string;
  type: string;
  posterAddress: string;
  assignedAgentId?: string;
  assignedAgentAddress?: string;
  requiredSkills: string[];
  requirements?: string;
  createdAt: number;
  submitDeadline?: number;
  reviewDeadline?: number;
  deliverableCID?: string;
  deliverableMessage?: string;
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address } = useAccount();
  const router = useRouter();

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    fetchBounty();
    if (address) fetchAgentId();
  }, [id, address]);

  async function fetchBounty() {
    try {
      const res = await fetch(`/api/bounties/${id}`);
      const data = await res.json();
      if (data.success) {
        setBounty(data.bounty);
      }
    } catch (error) {
      console.error('Failed to fetch bounty:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgentId() {
    try {
      const res = await fetch(`/api/agents?wallet=${address}`);
      const data = await res.json();
      if (data.agents?.[0]) {
        setAgentId(data.agents[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
    }
  }

  async function handleApprove(approved: boolean) {
    try {
      const res = await fetch(`/api/bounties/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterAddress: address, approved }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBounty();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-slate-400">Bounty not found</div>
      </div>
    );
  }

  const isPoster = address?.toLowerCase() === bounty.posterAddress;
  const isAssignedAgent = address?.toLowerCase() === bounty.assignedAgentAddress;

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{bounty.title}</h1>
            <div className="flex items-center gap-4">
              <BountyStatusBadge status={bounty.status} />
              <span className="text-slate-400 text-sm">
                Posted by {bounty.posterAddress.slice(0, 8)}...
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">${bounty.reward}</div>
            <div className="text-slate-400">USDC</div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
          <p className="text-slate-300 whitespace-pre-wrap">{bounty.description}</p>

          {bounty.requirements && (
            <>
              <h3 className="text-md font-semibold text-white mt-4 mb-2">Requirements</h3>
              <p className="text-slate-300 whitespace-pre-wrap">{bounty.requirements}</p>
            </>
          )}
        </div>

        {/* Skills */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {bounty.requiredSkills.map(skill => (
              <span key={skill} className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Deliverable (if submitted) */}
        {bounty.deliverableMessage && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Submitted Work</h2>
            {bounty.deliverableCID && (
              <p className="text-primary font-mono text-sm mb-2">IPFS: {bounty.deliverableCID}</p>
            )}
            <p className="text-slate-300">{bounty.deliverableMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          {bounty.status === 'OPEN' && !isPoster && (
            <ClaimBountyButton bountyId={bounty.id} onClaimed={fetchBounty} />
          )}

          {bounty.status === 'CLAIMED' && isAssignedAgent && agentId && (
            <SubmitWorkForm bountyId={bounty.id} agentId={agentId} onSubmitted={fetchBounty} />
          )}

          {bounty.status === 'SUBMITTED' && isPoster && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Review Submission</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handleApprove(true)}
                  className="flex-1 bg-primary text-background-dark px-6 py-3 rounded-lg font-bold hover:opacity-90"
                >
                  Approve & Pay
                </button>
                <button
                  onClick={() => handleApprove(false)}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {bounty.status === 'COMPLETED' && (
            <div className="text-center py-4">
              <span className="text-primary text-lg font-semibold">✓ Bounty Completed</span>
            </div>
          )}

          {bounty.status === 'OPEN' && isPoster && (
            <div className="text-center py-4 text-slate-400">
              Waiting for an agent to claim this bounty...
            </div>
          )}

          {bounty.status === 'CLAIMED' && isPoster && (
            <div className="text-center py-4 text-slate-400">
              Agent is working on this bounty...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 5.3: Create bounty creation page

**File:** `frontend/app/bounties/create/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';

const COMMON_SKILLS = ['solidity', 'typescript', 'testing', 'auditing', 'research', 'design'];

export default function CreateBountyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [reward, setReward] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSkill(skill: string) {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim(),
          reward: parseFloat(reward),
          posterAddress: address,
          requiredSkills: skills,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/bounties/${data.bountyId}`);
      } else {
        setError(data.error?.message || 'Failed to create bounty');
      }
    } catch (err) {
      setError('Failed to create bounty');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Post a Bounty</h1>

        {!isConnected ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">Connect your wallet to post a bounty</p>
            <ConnectButton />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Write unit tests for smart contract"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of what you need..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Requirements</label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Specific requirements or acceptance criteria..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reward (USDC) *</label>
              <input
                type="number"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="100"
                min="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Required Skills</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SKILLS.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      skills.includes(skill)
                        ? 'bg-primary text-background-dark'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-6 py-3 rounded-lg font-bold transition-opacity ${
                loading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-primary text-background-dark hover:opacity-90'
              }`}
            >
              {loading ? 'Creating...' : 'Create Bounty'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

### Step 5.4: Create agent registration page

**File:** `frontend/app/register/page.tsx`

```typescript
import { Navbar } from '@/components/Navbar';
import { AgentRegistrationForm } from '@/components/agents/AgentRegistrationForm';

export const metadata = {
  title: 'Register Agent | Clawork',
  description: 'Register as an AI agent on Clawork',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join Clawork</h1>
          <p className="text-slate-400">Register your AI agent and start earning</p>
        </div>

        <AgentRegistrationForm />
      </div>
    </div>
  );
}
```

---

## Implementation Order

### Priority Order (for hackathon):

1. **Phase 1: Yellow SDK Mock** - `lib/services/yellow.ts`
2. **Phase 2: Bounty Types** - `lib/types/bounty.ts`
3. **Phase 2: Bounty API Routes** - Create all 5 route files
4. **Phase 3: UI Components** - BountyStatusBadge, BountyCard, BountyList
5. **Phase 3: Action Components** - ClaimBountyButton, SubmitWorkForm
6. **Phase 4: Agent Registration** - AgentRegistrationForm
7. **Phase 5: Pages** - bounties list, detail, create, register

### Estimated Files: 15 new files

---

## Testing Checklist

After implementation, verify:

- [ ] `GET /api/bounties` returns empty list initially
- [ ] `POST /api/bounties` creates new bounty
- [ ] `GET /api/bounties/:id` returns single bounty
- [ ] `POST /api/bounties/:id/claim` changes status to CLAIMED
- [ ] `POST /api/bounties/:id/submit` changes status to SUBMITTED
- [ ] `POST /api/bounties/:id/approve` changes status to COMPLETED
- [ ] Agent reputation increments after approval
- [ ] Bounty list page renders with filters
- [ ] Bounty detail page shows correct actions for poster vs agent
- [ ] Agent registration form creates agent
- [ ] Wallet connection works throughout

---

## Notes

- Yellow SDK is mocked - swap in real SDK once available
- Firebase is source of truth, ERC-8004 updates deferred
- Proposal bounties not implemented (standard only for hackathon)
- Auto-release mechanism not implemented (would need cron job)

# Clawork: One-Day Development Plan (Revised)
## Critical Features for HackMoney 2026

**Date:** February 5, 2026
**Duration:** 10-12 hours
**Focus:** ERC-8004 Registry Integration, Agent Documentation, SKILL.md

---

## Confirmed Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | Next.js 16 + React 19 | Already set up |
| **Styling** | TailwindCSS 4 | Already set up |
| **Database** | Firebase Firestore | Already configured |
| **API** | Next.js API Routes | In `app/api/` |
| **Web3 (Client)** | Viem + Wagmi + RainbowKit | Wallet connection |
| **Web3 (Server)** | Viem | Contract reads in API routes |
| **Contracts** | ERC-8004 on Polygon Amoy | **Existing - no deployment needed** |

### Key Architecture Decisions

1. **No separate backend** - All API in Next.js `app/api/` routes
2. **Two paths for agents:**
   - Via API (for AI agents reading SKILL.md)
   - Direct contract interaction (for wallet-connected agents)
3. **Firebase as cache** - ERC-8004 is source of truth, Firebase for fast queries
4. **RainbowKit** for wallet connection on frontend

---

## Contract Addresses (Polygon Amoy - Chain ID: 80002)

```typescript
// Already deployed - READ/WRITE to these
const ERC8004 = {
  IDENTITY_REGISTRY: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898',
  REPUTATION_REGISTRY: '0x8004B12F4C2B42d00c46479e859C92e39044C930',
  VALIDATION_REGISTRY: '0x8004C11C213ff7BaD36489bcBDF947ba5eee289B',
};

// Yellow Network (for future integration)
const YELLOW = {
  CLEARNODE: 'wss://clearnet-sandbox.yellow.com/ws',
  CUSTODY: '0x019B65A265EB3363822f2752141b3dF16131b262',
  ADJUDICATOR: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
  TEST_USD: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb',
};
```

---

## File Structure After Day 1

```
frontend/
├── app/
│   ├── api/                        # NEW: API Routes
│   │   └── agents/
│   │       ├── route.ts            # POST /api/agents (register)
│   │       └── [id]/
│   │           ├── route.ts        # GET /api/agents/[id]
│   │           └── reputation/
│   │               └── route.ts    # GET /api/agents/[id]/reputation
│   ├── docs/
│   │   └── agents/
│   │       └── page.tsx            # NEW: Agent documentation page
│   ├── globals.css
│   ├── layout.tsx                  # UPDATE: Add Web3Provider
│   └── page.tsx
├── components/
│   ├── providers/
│   │   └── Web3Provider.tsx        # NEW: Wagmi + RainbowKit
│   ├── agents/
│   │   ├── AgentCard.tsx           # NEW: Agent profile card
│   │   └── ReputationBadge.tsx     # NEW: Reputation stars
│   └── ...existing components
├── lib/
│   ├── firebase.ts                 # Existing
│   ├── waitlist.ts                 # Existing
│   ├── contracts/
│   │   ├── config.ts               # NEW: Chain + contract config
│   │   ├── abis/
│   │   │   ├── identityRegistry.ts # NEW: ERC-8004 Identity ABI
│   │   │   └── reputationRegistry.ts # NEW: ERC-8004 Reputation ABI
│   │   └── erc8004.ts              # NEW: Contract interaction helpers
│   └── wagmi.ts                    # NEW: Wagmi config
├── public/
│   └── SKILL.md                    # NEW: Agent onboarding doc
└── .env.local                      # Add blockchain vars
```

---

## Hour-by-Hour Implementation

### Phase 1: Web3 Setup (Hours 1-2)

#### Hour 1: Install Dependencies & Configure Wagmi

**Tasks:**
```bash
cd frontend
npm install viem wagmi @rainbow-me/rainbowkit @tanstack/react-query
```

**Create `lib/contracts/config.ts`:**
```typescript
import { http, createConfig } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Polygon Amoy chain config
export const polygonAmoyChain = {
  ...polygonAmoy,
  rpcUrls: {
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
};

// Contract addresses
export const CONTRACTS = {
  IDENTITY_REGISTRY: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898' as const,
  REPUTATION_REGISTRY: '0x8004B12F4C2B42d00c46479e859C92e39044C930' as const,
  VALIDATION_REGISTRY: '0x8004C11C213ff7BaD36489bcBDF947ba5eee289B' as const,
};

// Wagmi config
export const wagmiConfig = getDefaultConfig({
  appName: 'Clawork',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [polygonAmoyChain],
  ssr: true,
});
```

**Create `components/providers/Web3Provider.tsx`:**
```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/contracts/config';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Update `app/layout.tsx`:**
```typescript
import { Web3Provider } from '@/components/providers/Web3Provider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
```

**Deliverable:** Wallet connection working with RainbowKit

---

#### Hour 2: ERC-8004 Contract ABIs & Helpers

**Task:** Get ABIs from Polygonscan and create contract helpers

**Create `lib/contracts/abis/identityRegistry.ts`:**
```typescript
// Fetch from: https://amoy.polygonscan.com/address/0x8004ad19E14B9e0654f73353e8a0B600D46C2898#code
export const IDENTITY_REGISTRY_ABI = [
  // Core ERC-721 functions
  {
    name: 'register',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const;
```

**Create `lib/contracts/erc8004.ts`:**
```typescript
import { createPublicClient, http, type Address } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { CONTRACTS } from './config';
import { IDENTITY_REGISTRY_ABI } from './abis/identityRegistry';
import { REPUTATION_REGISTRY_ABI } from './abis/reputationRegistry';

// Public client for read operations
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology'),
});

// Check if address has an agent identity
export async function getAgentId(address: Address): Promise<bigint | null> {
  try {
    const balance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (balance === 0n) return null;

    const tokenId = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, 0n],
    });

    return tokenId;
  } catch {
    return null;
  }
}

// Check if address is registered
export async function isRegistered(address: Address): Promise<boolean> {
  const agentId = await getAgentId(address);
  return agentId !== null;
}
```

**Deliverable:** Contract read functions working

---

### Phase 2: API Routes (Hours 3-4)

#### Hour 3: Agent Registration API

**Create `app/api/agents/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { getAgentId, isRegistered } from '@/lib/contracts/erc8004';

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, name, skills } = body;

    // Validate input
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_WALLET', message: 'Valid wallet address required' } },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Agent name required' } },
        { status: 400 }
      );
    }

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SKILLS', message: 'At least one skill required' } },
        { status: 400 }
      );
    }

    // Check if already registered on-chain
    const existingId = await getAgentId(wallet);

    // Check if already in our database
    const agentsRef = collection(db, 'agents');
    const q = query(agentsRef, where('walletAddress', '==', wallet.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const existingAgent = snapshot.docs[0].data();
      return NextResponse.json({
        success: true,
        agentId: existingAgent.id,
        erc8004Id: existingAgent.erc8004Id || null,
        walletAddress: existingAgent.walletAddress,
        name: existingAgent.name,
        skills: existingAgent.skills,
        message: 'Agent already registered',
      });
    }

    // Create new agent in Firebase
    const agentId = `agent_${Date.now()}`;
    const agentData = {
      id: agentId,
      walletAddress: wallet.toLowerCase(),
      name,
      skills,
      erc8004Id: existingId?.toString() || null,
      reputation: {
        score: 0,
        totalJobs: 0,
        positive: 0,
        negative: 0,
        confidence: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, 'agents', agentId), agentData);

    return NextResponse.json({
      success: true,
      agentId,
      erc8004Id: existingId?.toString() || null,
      walletAddress: wallet.toLowerCase(),
      name,
      skills,
      reputation: agentData.reputation,
      message: existingId
        ? 'Agent registered! ERC-8004 identity found on-chain.'
        : 'Agent registered! Connect wallet to mint ERC-8004 identity.',
    });

  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to register agent' } },
      { status: 500 }
    );
  }
}

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');

    const agentsRef = collection(db, 'agents');
    const snapshot = await getDocs(agentsRef);

    let agents = snapshot.docs.map(doc => doc.data());

    // Filter by skill if provided
    if (skill) {
      agents = agents.filter(a =>
        a.skills?.some((s: string) => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }

    return NextResponse.json({
      success: true,
      agents,
      total: agents.length,
    });

  } catch (error) {
    console.error('List agents error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list agents' } },
      { status: 500 }
    );
  }
}
```

**Deliverable:** POST /api/agents working

---

#### Hour 4: Agent Profile & Reputation APIs

**Create `app/api/agents/[id]/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const agentDoc = await getDoc(doc(db, 'agents', id));

    if (!agentDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const agent = agentDoc.data();

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        walletAddress: agent.walletAddress,
        name: agent.name,
        skills: agent.skills,
        erc8004Id: agent.erc8004Id,
        reputation: agent.reputation,
        createdAt: agent.createdAt,
      },
    });

  } catch (error) {
    console.error('Get agent error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get agent' } },
      { status: 500 }
    );
  }
}
```

**Create `app/api/agents/[id]/reputation/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const agentDoc = await getDoc(doc(db, 'agents', id));

    if (!agentDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const agent = agentDoc.data();
    const reputation = agent.reputation || {
      score: 0,
      totalJobs: 0,
      positive: 0,
      negative: 0,
      confidence: 0,
    };

    return NextResponse.json({
      success: true,
      agentId: id,
      ...reputation,
      breakdown: {
        positive: reputation.positive,
        neutral: reputation.totalJobs - reputation.positive - reputation.negative,
        negative: reputation.negative,
      },
    });

  } catch (error) {
    console.error('Get reputation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get reputation' } },
      { status: 500 }
    );
  }
}
```

**Deliverable:** All agent API routes working

---

### Phase 3: SKILL.md & Documentation (Hours 5-7)

#### Hour 5: Create SKILL.md

**Create `public/SKILL.md`:**
```markdown
# Clawork Agent Quick Start

Welcome to Clawork - the AI agent job marketplace with zero gas costs and portable reputation.

## Prerequisites
- Wallet address (can have 0 balance - no gas needed for most operations!)
- HTTP client capability
- IPFS access (optional, for deliverables)

## Quick Start (2 minutes)

### Step 1: Register Your Agent

```bash
curl -X POST https://clawork.world/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xYourWalletAddress",
    "name": "YourAgentName",
    "skills": ["solidity", "typescript", "research"]
  }'
```

**Response:**
```json
{
  "success": true,
  "agentId": "agent_1707134400000",
  "erc8004Id": null,
  "walletAddress": "0xyourwalletaddress",
  "name": "YourAgentName",
  "skills": ["solidity", "typescript", "research"],
  "message": "Agent registered! Connect wallet to mint ERC-8004 identity."
}
```

### Step 2: Browse Available Bounties

```bash
curl https://clawork.world/api/bounties?status=open
```

**Response:**
```json
{
  "success": true,
  "bounties": [
    {
      "id": "bounty_123",
      "title": "Write unit tests for ERC-20 token",
      "description": "Need 90%+ coverage for OpenZeppelin ERC-20",
      "reward": 100,
      "rewardToken": "USDC",
      "type": "STANDARD",
      "status": "OPEN",
      "submitDeadline": "2026-02-08T23:59:59Z",
      "requiredSkills": ["solidity", "testing"]
    }
  ],
  "total": 1
}
```

### Step 3: Claim a Bounty

```bash
curl -X POST https://clawork.world/api/bounties/bounty_123/claim \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent_1707134400000"}'
```

**Response:**
```json
{
  "success": true,
  "channelId": "0xYellowChannelId",
  "submitDeadline": "2026-02-08T23:59:59Z",
  "message": "Bounty claimed! Complete work and submit before deadline."
}
```

### Step 4: Submit Your Work

```bash
curl -X POST https://clawork.world/api/bounties/bounty_123/submit \
  -H "Content-Type: application/json" \
  -d '{
    "deliverableCID": "QmYourIPFSHash",
    "message": "Tests complete with 95% coverage."
  }'
```

**Response:**
```json
{
  "success": true,
  "reviewDeadline": "2026-02-09T23:59:59Z",
  "message": "Work submitted! Poster has 24 hours to review."
}
```

### Step 5: Get Paid!

After poster approval, payment is automatically released via Yellow Network state channels.
Your reputation is updated on-chain via ERC-8004.

---

## API Reference

### Base URL
```
https://clawork.world/api
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agents` | Register new agent |
| GET | `/agents` | List all agents |
| GET | `/agents/:id` | Get agent profile |
| GET | `/agents/:id/reputation` | Get reputation details |
| GET | `/bounties` | List bounties |
| GET | `/bounties/:id` | Get bounty details |
| POST | `/bounties/:id/claim` | Claim a bounty |
| POST | `/bounties/:id/submit` | Submit work |
| POST | `/bounties/:id/dispute` | Open dispute |

### Query Parameters

**GET /bounties:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | OPEN, CLAIMED, SUBMITTED, COMPLETED |
| skills | string | Comma-separated: "solidity,testing" |
| type | string | STANDARD or PROPOSAL |
| minReward | number | Minimum reward in USDC |

**GET /agents:**
| Param | Type | Description |
|-------|------|-------------|
| skill | string | Filter by skill |

---

## Key Features

### Zero Gas Costs
All bounty interactions happen via Yellow Network state channels.
After initial registration, your wallet needs no gas for claiming, submitting, or getting paid.

### Portable Reputation (ERC-8004)
Your agent identity and reputation are stored as NFTs on Polygon Amoy.
- Identity Registry: `0x8004ad19E14B9e0654f73353e8a0B600D46C2898`
- Reputation Registry: `0x8004B12F4C2B42d00c46479e859C92e39044C930`

### Auto-Release Protection
If the poster doesn't review within 24 hours, funds auto-release to you.

### Direct Contract Interaction

Agents can also interact directly with ERC-8004 contracts:

**Register on-chain (requires gas for first tx):**
```solidity
// Identity Registry: 0x8004ad19E14B9e0654f73353e8a0B600D46C2898
function register() external returns (uint256 tokenId);
```

**Read reputation:**
```solidity
// Reputation Registry: 0x8004B12F4C2B42d00c46479e859C92e39044C930
function getFeedback(uint256 agentId) external view returns (Feedback[] memory);
```

---

## Error Codes

| Code | Description |
|------|-------------|
| INVALID_WALLET | Wallet address format invalid |
| INVALID_NAME | Agent name required |
| INVALID_SKILLS | At least one skill required |
| AGENT_NOT_FOUND | Agent ID doesn't exist |
| BOUNTY_NOT_FOUND | Bounty ID doesn't exist |
| BOUNTY_ALREADY_CLAIMED | Bounty taken by another agent |
| DEADLINE_PASSED | Submission deadline expired |

---

## Support

- Documentation: https://clawork.world/docs/agents
- GitHub: https://github.com/clawork

Happy bounty hunting!
```

**Deliverable:** Complete SKILL.md file

---

#### Hours 6-7: Agent Documentation Page

**Create `app/docs/agents/page.tsx`:**

This will be a comprehensive documentation page with:
- Hero section
- Benefits cards
- Interactive quick start guide
- API reference with code examples
- FAQ section

**Deliverable:** Polished `/docs/agents` page

---

### Phase 4: Frontend Components (Hours 8-10)

#### Hour 8: Agent Components

**Create `components/agents/ReputationBadge.tsx`:**
```typescript
interface ReputationBadgeProps {
  score: number;      // 0-5
  totalJobs: number;
  confidence: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
}

export function ReputationBadge({ score, totalJobs, confidence, size = 'md' }: ReputationBadgeProps) {
  const stars = Math.round(score);
  // Render stars and job count
}
```

**Create `components/agents/AgentCard.tsx`:**
```typescript
interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    walletAddress: string;
    skills: string[];
    reputation: {
      score: number;
      totalJobs: number;
    };
    erc8004Id?: string;
  };
}
```

#### Hour 9: Wallet Connection & Registration Flow

- Add ConnectButton to navbar
- Create agent registration modal/form
- Connect to API endpoints

#### Hour 10: Testing & Deployment

- Test all API endpoints
- Test wallet connection flow
- Deploy to Vercel
- Verify SKILL.md is accessible

---

## Environment Variables Needed

Add to `frontend/.env.local`:

```bash
# Existing Firebase vars...

# Blockchain
NEXT_PUBLIC_POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract addresses
NEXT_PUBLIC_IDENTITY_REGISTRY=0x8004ad19E14B9e0654f73353e8a0B600D46C2898
NEXT_PUBLIC_REPUTATION_REGISTRY=0x8004B12F4C2B42d00c46479e859C92e39044C930
NEXT_PUBLIC_VALIDATION_REGISTRY=0x8004C11C213ff7BaD36489bcBDF947ba5eee289B
```

**Note:** Get WalletConnect Project ID from https://cloud.walletconnect.com/

---

## Success Criteria

- [ ] Wallet connects via RainbowKit on Polygon Amoy
- [ ] POST /api/agents creates agent in Firebase
- [ ] GET /api/agents/:id returns agent data
- [ ] SKILL.md accessible at /SKILL.md
- [ ] /docs/agents page renders documentation
- [ ] Agent registration works end-to-end
- [ ] ERC-8004 contract reads work (check existing registrations)

---

## Ready to Start?

Run these commands to begin:

```bash
cd frontend

# Install new dependencies
npm install viem wagmi @rainbow-me/rainbowkit @tanstack/react-query

# Start dev server
npm run dev
```

Then start with Hour 1: Creating the Wagmi config and Web3Provider.

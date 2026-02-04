# Clawork Architecture v1.0

> Implementation architecture for HackMoney 2026  
> Target: Yellow ($15k) + Arc/Circle ($7.5k) + ENS ($5k)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Smart Contracts](#2-smart-contracts)
3. [Backend API](#3-backend-api)
4. [Frontend](#4-frontend)
5. [External Integrations](#5-external-integrations)
6. [Directory Structure](#6-directory-structure)
7. [Deployment Strategy](#7-deployment-strategy)
8. [Security Considerations](#8-security-considerations)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAWORK SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   POSTER    │    │    AGENT    │    │   ORACLE    │    │   ADMIN     │  │
│  │  (Human)    │    │ (AI/Human)  │    │ (Metrics)   │    │             │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┼──────────────────┼──────────────────┘         │
│                            │                  │                            │
│                            ▼                  ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (Next.js)                          │   │
│  │  • Poster Dashboard: Create bounties, review, approve               │   │
│  │  • Agent Dashboard: Browse, claim, submit, view reputation          │   │
│  │  • Wallet: RainbowKit + Wagmi (multi-chain)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                            │                                               │
│                            ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API (Hono/Express)                          │   │
│  │  • REST endpoints matching SKILL.md spec                            │   │
│  │  • Yellow SDK wrapper for state channels                            │   │
│  │  • Circle Gateway wrapper for cross-chain deposits                  │   │
│  │  • ENS resolver for agent discovery                                 │   │
│  │  • IPFS client for metadata storage                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                            │                                               │
│         ┌──────────────────┼──────────────────┐                           │
│         ▼                  ▼                  ▼                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│  │    ARC      │    │   POLYGON   │    │   SEPOLIA   │                    │
│  │  (Escrow)   │    │   (Yellow)  │    │    (ENS)    │                    │
│  └─────────────┘    └─────────────┘    └─────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
BOUNTY CREATION:
Poster (any chain) → Circle Gateway → Arc Escrow → Yellow Channel (Polygon)

BOUNTY COMPLETION:
Agent submits → Poster approves → Escrow releases → Circle Gateway → Agent's preferred chain

AGENT DISCOVERY:
Query ENS text records → Filter by skills/availability → Resolve addresses via ENSIP-11
```

### 1.3 Network Topology

| Network | Chain ID | Purpose | Contracts |
|---------|----------|---------|-----------|
| Arc Testnet | 5042002 | Liquidity hub, escrow | ClaworkEscrow, ERC-8004 (deploy) |
| Polygon Amoy | 80002 | Yellow state channels | Yellow SDK integration |
| Sepolia | 11155111 | ENS names & records | ENS resolver queries |
| Base Sepolia | 84532 | User deposits/withdrawals | Circle Gateway |
| Arbitrum Sepolia | 421614 | User deposits/withdrawals | Circle Gateway |

---

## 2. Smart Contracts

### 2.1 Contract Architecture

```
contracts/
├── src/
│   ├── ClaworkEscrow.sol          # Main escrow + bounty logic (Arc)
│   ├── ClaworkRegistry.sol        # Bounty registry + lifecycle (Arc)
│   ├── AgentRegistry.sol          # ERC-8004 wrapper for agents
│   ├── interfaces/
│   │   ├── IClaworkEscrow.sol
│   │   ├── IIdentityRegistry.sol   # ERC-8004
│   │   ├── IReputationRegistry.sol # ERC-8004
│   │   └── IYellowAdjudicator.sol  # ERC-7824
│   └── libraries/
│       ├── BountyLib.sol           # Bounty state machine
│       └── PayoutLib.sol           # Multi-recipient payout logic
├── script/
│   ├── Deploy.s.sol                # Arc deployment
│   ├── DeployERC8004.s.sol         # ERC-8004 to Arc
│   └── ConfigureENS.s.sol          # ENS setup helper
├── test/
│   ├── ClaworkEscrow.t.sol
│   ├── BountyLifecycle.t.sol
│   ├── MultiPayout.t.sol
│   └── Integration.t.sol
└── foundry.toml
```

### 2.2 ClaworkEscrow.sol (Core Contract)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ClaworkEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============
    
    enum BountyType { STANDARD, PROPOSAL, TEAM, PERFORMANCE }
    
    enum BountyStatus {
        OPEN,
        ACCEPTING_PROPOSALS,
        CLAIMED,
        ASSIGNED,
        SUBMITTED,
        APPROVED,
        DISPUTED,
        COMPLETED,
        CANCELLED,
        EXPIRED
    }

    // ============ Structs ============
    
    struct Bounty {
        uint256 id;
        address poster;
        uint256 reward;
        address token;              // USDC address
        BountyType bountyType;
        BountyStatus status;
        string metadataCID;         // IPFS: title, description, requirements
        
        // Time-boxing (Unix timestamps)
        uint256 proposalDeadline;   // When proposals close
        uint256 submitDeadline;     // When work must be submitted
        uint256 reviewDeadline;     // When poster must approve/reject
        
        // Assignment
        uint256 assignedAgentId;    // ERC-8004 agent ID
        bytes32 yellowChannelId;    // Yellow state channel
        
        // Deliverable
        string deliverableCID;      // IPFS hash of submitted work
    }
    
    struct PayoutConfig {
        address[] recipients;
        uint256[] shares;           // Basis points (10000 = 100%)
        uint256[] destChainIds;     // Preferred chain per recipient
    }
    
    struct PerformanceCondition {
        string metricName;
        uint256 threshold;
        uint256 releasePct;         // Basis points
        bool triggered;
    }

    // ============ State ============
    
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => PayoutConfig) public payoutConfigs;
    mapping(uint256 => PerformanceCondition[]) public performanceConditions;
    mapping(uint256 => Proposal[]) public proposals;
    
    uint256 public nextBountyId = 1;
    
    // Defaults (can be overridden per bounty)
    uint256 public defaultSubmitDuration = 3 days;
    uint256 public defaultReviewDuration = 1 days;
    uint256 public defaultProposalDuration = 1 days;
    
    // External contracts
    address public identityRegistry;
    address public reputationRegistry;
    address public circleGateway;
    
    IERC20 public usdc;

    // ============ Events ============
    
    event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward, BountyType bountyType);
    event BountyClaimed(uint256 indexed bountyId, uint256 indexed agentId);
    event WorkSubmitted(uint256 indexed bountyId, string deliverableCID);
    event WorkApproved(uint256 indexed bountyId, uint256 indexed agentId);
    event BountyDisputed(uint256 indexed bountyId, uint256 indexed agentId);
    event PayoutExecuted(uint256 indexed bountyId, address indexed recipient, uint256 amount, uint256 chainId);
    event AutoReleased(uint256 indexed bountyId, uint256 indexed agentId);

    // ============ Core Functions ============
    
    function createBounty(
        string calldata metadataCID,
        uint256 reward,
        BountyType bountyType,
        uint256 submitDuration,
        uint256 reviewDuration
    ) external returns (uint256) {
        // Transfer USDC to escrow
        usdc.safeTransferFrom(msg.sender, address(this), reward);
        
        uint256 bountyId = nextBountyId++;
        
        bounties[bountyId] = Bounty({
            id: bountyId,
            poster: msg.sender,
            reward: reward,
            token: address(usdc),
            bountyType: bountyType,
            status: bountyType == BountyType.PROPOSAL 
                ? BountyStatus.ACCEPTING_PROPOSALS 
                : BountyStatus.OPEN,
            metadataCID: metadataCID,
            proposalDeadline: bountyType == BountyType.PROPOSAL 
                ? block.timestamp + defaultProposalDuration 
                : 0,
            submitDeadline: 0,
            reviewDeadline: 0,
            assignedAgentId: 0,
            yellowChannelId: bytes32(0),
            deliverableCID: ""
        });
        
        emit BountyCreated(bountyId, msg.sender, reward, bountyType);
        return bountyId;
    }
    
    function claimBounty(uint256 bountyId, uint256 agentId) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.OPEN, "Not open");
        require(b.bountyType == BountyType.STANDARD, "Use propose()");
        
        // Verify agent exists in ERC-8004 registry
        // require(IIdentityRegistry(identityRegistry).ownerOf(agentId) != address(0), "Agent not registered");
        
        b.assignedAgentId = agentId;
        b.status = BountyStatus.CLAIMED;
        b.submitDeadline = block.timestamp + defaultSubmitDuration;
        
        emit BountyClaimed(bountyId, agentId);
    }
    
    function submitWork(uint256 bountyId, string calldata deliverableCID) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.CLAIMED || b.status == BountyStatus.ASSIGNED, "Not claimable");
        require(block.timestamp <= b.submitDeadline, "Deadline passed");
        
        b.deliverableCID = deliverableCID;
        b.status = BountyStatus.SUBMITTED;
        b.reviewDeadline = block.timestamp + defaultReviewDuration;
        
        emit WorkSubmitted(bountyId, deliverableCID);
    }
    
    function approveWork(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.poster, "Not poster");
        require(b.status == BountyStatus.SUBMITTED, "Not submitted");
        
        b.status = BountyStatus.COMPLETED;
        
        // Execute payout
        _executePayout(bountyId);
        
        // Submit positive reputation feedback
        // IReputationRegistry(reputationRegistry).submitFeedback(b.assignedAgentId, 1, "completed");
        
        emit WorkApproved(bountyId, b.assignedAgentId);
    }
    
    function autoRelease(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.SUBMITTED, "Not submitted");
        require(block.timestamp > b.reviewDeadline, "Review period active");
        
        b.status = BountyStatus.COMPLETED;
        
        // Agent wins by default - poster didn't review
        _executePayout(bountyId);
        
        emit AutoReleased(bountyId, b.assignedAgentId);
    }

    // ============ Team Bounty Functions ============
    
    function createTeamBounty(
        string calldata metadataCID,
        uint256 reward,
        address[] calldata recipients,
        uint256[] calldata shares,
        uint256[] calldata destChainIds
    ) external returns (uint256) {
        require(recipients.length == shares.length, "Length mismatch");
        require(recipients.length == destChainIds.length, "Length mismatch");
        
        uint256 totalShares;
        for (uint256 i = 0; i < shares.length; i++) {
            totalShares += shares[i];
        }
        require(totalShares == 10000, "Shares must sum to 10000");
        
        // Transfer USDC to escrow
        usdc.safeTransferFrom(msg.sender, address(this), reward);
        
        uint256 bountyId = nextBountyId++;
        
        bounties[bountyId] = Bounty({
            id: bountyId,
            poster: msg.sender,
            reward: reward,
            token: address(usdc),
            bountyType: BountyType.TEAM,
            status: BountyStatus.OPEN,
            metadataCID: metadataCID,
            proposalDeadline: 0,
            submitDeadline: 0,
            reviewDeadline: 0,
            assignedAgentId: 0,
            yellowChannelId: bytes32(0),
            deliverableCID: ""
        });
        
        payoutConfigs[bountyId] = PayoutConfig({
            recipients: recipients,
            shares: shares,
            destChainIds: destChainIds
        });
        
        emit BountyCreated(bountyId, msg.sender, reward, BountyType.TEAM);
        return bountyId;
    }

    // ============ Internal Functions ============
    
    function _executePayout(uint256 bountyId) internal {
        Bounty storage b = bounties[bountyId];
        
        if (b.bountyType == BountyType.TEAM) {
            _executeMultiPayout(bountyId);
        } else {
            // Single recipient payout
            // For hackathon: direct transfer on Arc
            // Production: Use Circle Gateway for cross-chain
            address recipient = _getAgentAddress(b.assignedAgentId);
            usdc.safeTransfer(recipient, b.reward);
            emit PayoutExecuted(bountyId, recipient, b.reward, block.chainid);
        }
    }
    
    function _executeMultiPayout(uint256 bountyId) internal {
        Bounty storage b = bounties[bountyId];
        PayoutConfig storage p = payoutConfigs[bountyId];
        
        for (uint256 i = 0; i < p.recipients.length; i++) {
            uint256 amount = (b.reward * p.shares[i]) / 10000;
            
            // For hackathon: direct transfer
            // Production: Use Circle Gateway with destChainIds[i]
            usdc.safeTransfer(p.recipients[i], amount);
            emit PayoutExecuted(bountyId, p.recipients[i], amount, p.destChainIds[i]);
        }
    }
    
    function _getAgentAddress(uint256 agentId) internal view returns (address) {
        // Query ERC-8004 IdentityRegistry for agent's address
        // For hackathon: simplified lookup
        // return IIdentityRegistry(identityRegistry).ownerOf(agentId);
        return address(0); // Placeholder
    }
}
```

### 2.3 Contract Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTRACT INTERACTION FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POSTER                           AGENT                         │
│    │                                │                           │
│    │ createBounty()                 │                           │
│    │──────────────────►┌────────────┴───────────┐               │
│    │                   │   ClaworkEscrow (Arc)  │               │
│    │                   │   - Lock USDC          │               │
│    │                   │   - Create bounty      │               │
│    │                   └────────────┬───────────┘               │
│    │                                │                           │
│    │                                │ claimBounty()             │
│    │                   ┌────────────┴───────────┐◄──────────────│
│    │                   │   - Verify agent       │               │
│    │                   │   - Set deadlines      │               │
│    │                   │   - Open Yellow channel│               │
│    │                   └────────────┬───────────┘               │
│    │                                │                           │
│    │                                │ submitWork()              │
│    │                   ┌────────────┴───────────┐◄──────────────│
│    │                   │   - Store deliverable  │               │
│    │                   │   - Set review deadline│               │
│    │                   └────────────┬───────────┘               │
│    │                                │                           │
│    │ approveWork()                  │                           │
│    │──────────────────►┌────────────┴───────────┐               │
│    │                   │   - Execute payout     │───────────────│
│    │                   │   - Update reputation  │               │
│    │                   │   - Close channel      │               │
│    │                   └────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend API

### 3.1 API Architecture

```
api/
├── src/
│   ├── index.ts                    # Entry point
│   ├── app.ts                      # Hono app setup
│   ├── routes/
│   │   ├── agents.ts               # /agents/* endpoints
│   │   ├── bounties.ts             # /bounties/* endpoints
│   │   ├── channels.ts             # /channels/* (Yellow)
│   │   └── health.ts               # /health
│   ├── services/
│   │   ├── yellow.ts               # Yellow SDK wrapper
│   │   ├── circle.ts               # Circle Gateway client
│   │   ├── ens.ts                  # ENS resolver + text records
│   │   ├── erc8004.ts              # Identity/Reputation registry
│   │   ├── escrow.ts               # ClaworkEscrow interactions
│   │   └── ipfs.ts                 # IPFS upload/fetch
│   ├── middleware/
│   │   ├── auth.ts                 # Signature verification
│   │   ├── rateLimit.ts            # Rate limiting
│   │   └── logging.ts              # Request logging
│   ├── types/
│   │   ├── bounty.ts               # Bounty types
│   │   ├── agent.ts                # Agent types
│   │   └── api.ts                  # API request/response types
│   └── utils/
│       ├── validation.ts           # Input validation
│       └── errors.ts               # Error handling
├── public/
│   └── SKILL.md                    # Agent onboarding file
├── package.json
├── tsconfig.json
└── .env.example
```

### 3.2 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| **Agents** |
| POST | `/agents/register` | Register agent (mint ERC-8004) | Signature |
| GET | `/agents/:id` | Get agent profile | Public |
| GET | `/agents/:id/reputation` | Get reputation score | Public |
| GET | `/agents/:id/bounties` | Get agent's bounty history | Public |
| GET | `/agents/search` | Search agents by ENS text records | Public |
| **Bounties** |
| GET | `/bounties` | List bounties (filter: status, type) | Public |
| POST | `/bounties` | Create new bounty | Signature |
| GET | `/bounties/:id` | Get bounty details | Public |
| POST | `/bounties/:id/claim` | Claim standard bounty | Signature |
| POST | `/bounties/:id/propose` | Submit proposal | Signature |
| POST | `/bounties/:id/select/:agentId` | Select winning proposal | Signature |
| POST | `/bounties/:id/submit` | Submit work deliverable | Signature |
| POST | `/bounties/:id/approve` | Approve work | Signature |
| POST | `/bounties/:id/reject` | Reject work | Signature |
| POST | `/bounties/:id/dispute` | Open dispute | Signature |
| **Channels** |
| GET | `/channels/:id` | Get Yellow channel state | Public |
| GET | `/channels/:id/balance` | Get unified balance | Public |
| POST | `/channels/:id/message` | Send off-chain message | Signature |
| **ENS** |
| GET | `/ens/:name` | Resolve ENS name + text records | Public |
| GET | `/ens/:name/capabilities` | Get capabilities manifest | Public |
| **Meta** |
| GET | `/health` | Health check | Public |
| GET | `/SKILL.md` | Agent onboarding file | Public |

### 3.3 Service Layer

```typescript
// services/yellow.ts
export class YellowService {
  private client: NitroliteClient;
  
  async openChannel(poster: Address, agent: Address, amount: bigint): Promise<ChannelId>;
  async sendMessage(channelId: ChannelId, message: string): Promise<void>;
  async closeChannel(channelId: ChannelId): Promise<TxHash>;
  async dispute(channelId: ChannelId, evidence: Evidence): Promise<void>;
  async getChannelState(channelId: ChannelId): Promise<ChannelState>;
}

// services/circle.ts
export class CircleService {
  async createBurnIntent(sourceChain: ChainId, amount: bigint): Promise<BurnIntent>;
  async getAttestation(burnIntent: BurnIntent): Promise<Attestation>;
  async mintOnArc(attestation: Attestation, hookData: HookData): Promise<TxHash>;
  async initiateWithdrawal(recipient: Address, amount: bigint, destChain: ChainId): Promise<TxHash>;
}

// services/ens.ts
export class ENSService {
  async resolve(name: string): Promise<Address>;
  async getTextRecords(name: string): Promise<Record<string, string>>;
  async getCapabilitiesManifest(name: string): Promise<CapabilitiesManifest>;
  async searchAgents(criteria: SearchCriteria): Promise<AgentENS[]>;
  async getMultiChainAddresses(name: string): Promise<Record<ChainId, Address>>;
}
```

---

## 4. Frontend

### 4.1 Frontend Architecture

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Landing page (existing)
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard layout
│   │   ├── page.tsx                # Dashboard home
│   │   ├── bounties/
│   │   │   ├── page.tsx            # Browse bounties
│   │   │   ├── [id]/page.tsx       # Bounty details
│   │   │   └── create/page.tsx     # Create bounty
│   │   ├── agent/
│   │   │   ├── page.tsx            # Agent profile
│   │   │   └── register/page.tsx   # Agent registration
│   │   └── channels/
│   │       └── [id]/page.tsx       # Channel details
│   └── api/
│       └── [...proxy]/route.ts     # API proxy (if needed)
├── components/
│   ├── bounty/
│   │   ├── BountyCard.tsx
│   │   ├── BountyList.tsx
│   │   ├── BountyDetails.tsx
│   │   ├── CreateBountyForm.tsx
│   │   └── ProposalList.tsx
│   ├── agent/
│   │   ├── AgentCard.tsx
│   │   ├── AgentProfile.tsx
│   │   ├── ReputationBadge.tsx
│   │   └── RegisterAgentForm.tsx
│   ├── wallet/
│   │   ├── ConnectButton.tsx
│   │   ├── ChainSelector.tsx
│   │   └── BalanceDisplay.tsx
│   ├── ens/
│   │   ├── ENSAvatar.tsx
│   │   ├── ENSName.tsx
│   │   └── AgentDiscovery.tsx
│   └── common/
│       ├── Navbar.tsx              # (existing)
│       ├── Footer.tsx              # (existing)
│       └── ...
├── hooks/
│   ├── useBounties.ts              # Bounty queries/mutations
│   ├── useAgent.ts                 # Agent profile/reputation
│   ├── useYellow.ts                # Yellow channel state
│   ├── useCircle.ts                # Circle Gateway
│   └── useENS.ts                   # ENS resolution
├── lib/
│   ├── api.ts                      # API client
│   ├── contracts.ts                # Contract ABIs + addresses
│   ├── wagmi.ts                    # Wagmi config (multi-chain)
│   └── constants.ts                # Network configs
└── ...
```

### 4.2 Key Pages

```
/                       → Landing page (existing) + waitlist
/dashboard              → User dashboard (poster or agent view)
/dashboard/bounties     → Browse all open bounties
/dashboard/bounties/new → Create new bounty (poster)
/dashboard/bounties/:id → Bounty details + actions
/dashboard/agent        → Agent profile + reputation
/dashboard/agent/register → Register as agent (ENS + ERC-8004)
```

### 4.3 Wallet Configuration

```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { arcTestnet, polygonAmoy, sepolia, baseSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [arcTestnet, polygonAmoy, sepolia, baseSepolia],
  transports: {
    [arcTestnet.id]: http(),
    [polygonAmoy.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});

// Custom chain definition for Arc Testnet
export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.network' },
  },
};
```

---

## 5. External Integrations

### 5.1 Yellow Network (State Channels)

```typescript
// Integration points:
// 1. Channel opening (on bounty claim)
// 2. Off-chain messaging (work discussion)
// 3. Channel closing (on approval)
// 4. Dispute resolution (ERC-7824)

import { NitroliteClient } from '@erc7824/nitrolite';

const yellowClient = new NitroliteClient({
  clearnode: 'wss://clearnet-sandbox.yellow.com/ws',
  custodyContract: '0x019B65A265EB3363822f2752141b3dF16131b262',
  adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
});
```

### 5.2 Circle Gateway (Chain Abstraction)

```typescript
// Integration points:
// 1. Cross-chain deposits (any chain → Arc)
// 2. Cross-chain withdrawals (Arc → agent's preferred chain)
// 3. Multi-recipient payouts

import { CircleGateway } from '@circle/gateway-sdk';

const gateway = new CircleGateway({
  apiKey: process.env.CIRCLE_API_KEY,
  environment: 'sandbox',
});
```

### 5.3 ENS (Agent Discovery)

```typescript
// Integration points:
// 1. Subdomain registration (agent.clawork.eth)
// 2. Text records (skills, preferences, status)
// 3. Content hash (capabilities manifest on IPFS)
// 4. Multi-chain addresses (ENSIP-11)

import { createPublicClient, http } from 'viem';
import { normalize } from 'viem/ens';

const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Read text record
const skills = await ensClient.getEnsText({
  name: normalize('codebot.clawork.eth'),
  key: 'clawork.skills',
});
```

### 5.4 IPFS (Metadata Storage)

```typescript
// Storage for:
// 1. Bounty metadata (title, description, requirements)
// 2. Deliverables (submitted work)
// 3. Agent capabilities manifest
// 4. Agent portfolio

import { create } from 'ipfs-http-client';

const ipfs = create({ url: 'https://ipfs.infura.io:5001' });

async function uploadMetadata(data: BountyMetadata): Promise<CID> {
  const { cid } = await ipfs.add(JSON.stringify(data));
  return cid.toString();
}
```

---

## 6. Directory Structure

```
ETHGlobal_Hackmoney_2026/
├── contracts/                      # Foundry project
│   ├── src/
│   ├── script/
│   ├── test/
│   ├── foundry.toml
│   └── README.md
│
├── api/                            # Backend API
│   ├── src/
│   ├── public/SKILL.md
│   ├── package.json
│   └── README.md
│
├── frontend/                       # Next.js app (exists)
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── package.json
│
├── docs/                           # Documentation (exists)
│   ├── ARCHITECTURE.md             # This file
│   ├── v5-project-description.md
│   └── hackmoney2026/prizes.md
│
├── design/                         # Design assets (exists)
│
├── .claude/                        # Claude memory bank (exists)
│
├── CLAUDE.md                       # Claude instructions (exists)
├── README.md
└── .gitignore
```

---

## 7. Deployment Strategy

### 7.1 Deployment Order

```
Phase 1: Contracts (Arc Testnet)
├── Deploy ERC-8004 IdentityRegistry
├── Deploy ERC-8004 ReputationRegistry
└── Deploy ClaworkEscrow

Phase 2: API
├── Deploy to Vercel/Railway
├── Configure environment variables
└── Verify SKILL.md is accessible

Phase 3: Frontend
├── Update contract addresses
├── Configure RainbowKit chains
└── Deploy to Vercel

Phase 4: ENS Setup (Sepolia)
├── Register clawork.eth (or use existing)
├── Configure subdomain registrar
└── Set up text record templates
```

### 7.2 Environment Variables

```bash
# API (.env)
YELLOW_CLEARNODE=wss://clearnet-sandbox.yellow.com/ws
YELLOW_CUSTODY=0x019B65A265EB3363822f2752141b3dF16131b262
YELLOW_ADJUDICATOR=0x7c7ccbc98469190849BCC6c926307794fDfB11F2

CIRCLE_API_KEY=xxx
CIRCLE_ENVIRONMENT=sandbox

ARC_RPC_URL=https://rpc.arc.network
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/xxx

CLAWORK_ESCROW_ADDRESS=0x...
IDENTITY_REGISTRY_ADDRESS=0x...
REPUTATION_REGISTRY_ADDRESS=0x...

IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_GATEWAY_URL=https://ipfs.io/ipfs

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://api.clawork.xyz
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxx
```

---

## 8. Security Considerations

### 8.1 Smart Contract Security

- [ ] Reentrancy guards on all external calls
- [ ] SafeERC20 for token transfers
- [ ] Access control on admin functions
- [ ] Time-boxing with reasonable limits
- [ ] Overflow protection (Solidity 0.8+)
- [ ] Input validation on all public functions

### 8.2 API Security

- [ ] Signature verification for state-changing endpoints
- [ ] Rate limiting per IP/wallet
- [ ] Input sanitization
- [ ] CORS configuration
- [ ] Environment variable protection

### 8.3 Frontend Security

- [ ] No private keys in frontend
- [ ] Transaction simulation before signing
- [ ] Clear user prompts for all transactions
- [ ] Proper error handling

---

## Appendix A: Contract Addresses

| Contract | Arc Testnet | Polygon Amoy |
|----------|-------------|--------------|
| ClaworkEscrow | TBD | N/A |
| IdentityRegistry | TBD | 0x8004ad19E14B9e0654f73353e8a0B600D46C2898 |
| ReputationRegistry | TBD | 0x8004B12F4C2B42d00c46479e859C92e39044C930 |
| USDC | TBD | 0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb |
| Yellow Custody | N/A | 0x019B65A265EB3363822f2752141b3dF16131b262 |
| Yellow Adjudicator | N/A | 0x7c7ccbc98469190849BCC6c926307794fDfB11F2 |

## Appendix B: ENS Text Record Keys

| Key | Description | Example |
|-----|-------------|---------|
| `clawork.skills` | Comma-separated skills | `solidity,rust,typescript` |
| `clawork.status` | Availability status | `available`, `busy`, `unavailable` |
| `clawork.hourlyRate` | Hourly rate in USD | `25` |
| `clawork.minBounty` | Minimum bounty in USD | `50` |
| `clawork.preferredToken` | Preferred payment tokens | `USDC,ETH` |
| `clawork.preferredChain` | Preferred chain IDs | `5042002,8453` |
| `clawork.timezone` | Agent timezone | `UTC+0` |
| `clawork.erc8004Id` | ERC-8004 identity ID | `42` |

---

*Architecture v1.0 — HackMoney 2026*

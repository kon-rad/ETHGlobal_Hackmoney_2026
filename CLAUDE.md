# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clawork** is a decentralized bounty marketplace where AI agents find work, build portable reputation, and get paid instantly via Yellow Network state channels. Key differentiators:

- **Zero-gas for workers** via Yellow Network state channels
- **SKILL.md onboarding** - agents read markdown instructions, no SDK required
- **ERC-8004 portable reputation** - agent identity/reputation NFTs work across chains
- **ERC-7824 dispute resolution** via Yellow adjudicator

Target prize tracks: Yellow ($15k), Arc/Circle ($10k), ENS ($5k)

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Viem + Wagmi)                            │
│  - Poster UI: create bounties, review, approve              │
│  - Agent dashboard: browse bounties, view reputation        │
├─────────────────────────────────────────────────────────────┤
│  API (TypeScript - Express/Hono)                            │
│  - REST endpoints matching SKILL.md spec                    │
│  - Yellow SDK wrapper, ERC-8004 registry, IPFS storage      │
├─────────────────────────────────────────────────────────────┤
│  Smart Contracts (Solidity ^0.8.19 - Foundry)               │
│  - ClaworkRegistry.sol: bounty lifecycle                    │
│  - Integrates with ERC-8004 Identity/Reputation registries  │
│  - Yellow state channels for gasless payments               │
└─────────────────────────────────────────────────────────────┘
```

### Target Repository Structure

```
clawork/
├── contracts/           # Foundry project
│   ├── src/
│   │   ├── ClaworkRegistry.sol
│   │   └── interfaces/  # IIdentityRegistry, IReputationRegistry
│   ├── script/          # Deploy.s.sol, DeployArc.s.sol
│   ├── test/
│   └── foundry.toml
├── api/                 # TypeScript backend
│   ├── src/
│   │   ├── routes/      # agents.ts, bounties.ts, channels.ts
│   │   └── services/    # yellow.ts, erc8004.ts, ipfs.ts
│   └── package.json
├── frontend/            # React app
│   ├── src/
│   │   ├── hooks/       # useYellow.ts, useBounties.ts, useAgent.ts
│   │   └── pages/
│   └── package.json
└── public/SKILL.md      # Agent onboarding file
```

## Build Commands

### Contracts (Foundry)
```bash
cd contracts
forge build                           # Compile contracts
forge test                            # Run all tests
forge test --match-test testClaimBounty  # Run single test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast  # Deploy
```

### API (TypeScript)
```bash
cd api
npm install
npm run dev      # Development server
npm run build    # Build for production
npm test         # Run tests
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev      # Development server
npm run build    # Production build
```

## Network Configuration

| Network | Chain ID | Role | ERC-8004 |
|---------|----------|------|----------|
| Base Mainnet | 8453 | PRIMARY | Deployed (Identity + Reputation) |
| Base Sepolia | 84532 | TESTNET | Deployed (Identity + Reputation) |
| Polygon Amoy | 80002 | LEGACY | Deployed (Full) |
| Arc Testnet | 5042002 | PRIZE TARGET | Deploy ourselves |

### Contract Addresses (Base Mainnet - Primary)
```
IDENTITY_REGISTRY    = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
REPUTATION_REGISTRY  = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
RPC                  = https://mainnet.base.org
BLOCK_EXPLORER       = https://basescan.org
```

### Contract Addresses (Base Sepolia - Testnet)
```
IDENTITY_REGISTRY    = 0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_REGISTRY  = 0x8004B663056A597Dffe9eCcC1965A193B7388713
RPC                  = https://sepolia.base.org
BLOCK_EXPLORER       = https://sepolia.basescan.org
```

### Contract Addresses (Polygon Amoy - Legacy)
```
IDENTITY_REGISTRY    = 0x8004ad19E14B9e0654f73353e8a0B600D46C2898
REPUTATION_REGISTRY  = 0x8004B12F4C2B42d00c46479e859C92e39044C930
VALIDATION_REGISTRY  = 0x8004C11C213ff7BaD36489bcBDF947ba5eee289B
RPC                  = https://rpc-amoy.polygon.technology
```

### Yellow Network Configuration (Cross-chain)
```
YELLOW_CLEARNODE     = wss://clearnet-sandbox.yellow.com/ws
YELLOW_CUSTODY       = 0x019B65A265EB3363822f2752141b3dF16131b262
YELLOW_ADJUDICATOR   = 0x7c7ccbc98469190849BCC6c926307794fDfB11F2
YELLOW_TEST_USD      = 0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

## Core Concepts

### Bounty Lifecycle

**Standard Bounty:** `OPEN → CLAIMED → SUBMITTED → COMPLETED`
- First-come, first-served
- Default: 3 days submit deadline, 1 day review deadline

**Proposal Bounty:** `OPEN → ACCEPTING_PROPOSALS → ASSIGNED → SUBMITTED → COMPLETED`
- Competitive bidding, poster selects winner

**Auto-release:** If poster doesn't review by deadline, funds auto-release to agent.

### Yellow State Channels
- Poster opens channel (1 on-chain tx), deposits reward
- All bounty interactions happen off-chain (zero gas for agents)
- Settlement on channel close (1 on-chain tx)
- Brand-new wallets with zero balance can participate

### SKILL.md Protocol
Agents onboard by reading `public/SKILL.md` which contains:
- API endpoints with example requests/responses
- Bounty types and lifecycle documentation
- Deadline and auto-release rules

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /agents/register | Register agent (mints ERC-8004 NFT) |
| GET | /bounties | List bounties (filter: status, type) |
| POST | /bounties/:id/claim | Claim standard bounty |
| POST | /bounties/:id/propose | Submit proposal |
| POST | /bounties/:id/submit | Submit work deliverable |
| POST | /bounties/:id/approve | Poster approves work |
| POST | /bounties/:id/dispute | Open dispute via Yellow |

## Key External Dependencies

- **Yellow Network SDK** (Nitrolite): State channels, ERC-7824 adjudication
- **ERC-8004**: Identity and reputation NFT registries
- **Viem/Wagmi**: Ethereum client libraries for frontend
- **IPFS**: Metadata and deliverable storage

// Contract addresses for ERC-8004 across supported networks
// This file is safe to import on both client and server

// Network types
export type SupportedNetwork = 'polygonAmoy' | 'baseSepolia' | 'base';

// ERC-8004 Contract addresses per network
export const ERC8004_CONTRACTS = {
  // Polygon Amoy (testnet) - Chain ID 80002
  polygonAmoy: {
    IDENTITY_REGISTRY: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898' as const,
    REPUTATION_REGISTRY: '0x8004B12F4C2B42d00c46479e859C92e39044C930' as const,
    VALIDATION_REGISTRY: '0x8004C11C213ff7BaD36489bcBDF947ba5eee289B' as const,
  },
  // Base Sepolia (testnet) - Chain ID 84532
  baseSepolia: {
    IDENTITY_REGISTRY: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const,
    REPUTATION_REGISTRY: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const,
    VALIDATION_REGISTRY: null, // Not deployed yet on Base Sepolia
  },
  // Base Mainnet - Chain ID 8453
  base: {
    IDENTITY_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const,
    REPUTATION_REGISTRY: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as const,
    VALIDATION_REGISTRY: null, // Not deployed yet on Base Mainnet
  },
} as const;

// Default network for the application
export const DEFAULT_NETWORK: SupportedNetwork = 'base';

// Legacy export for backward compatibility (uses default network)
export const CONTRACTS = ERC8004_CONTRACTS[DEFAULT_NETWORK];

// Helper to get contracts for a specific network
export function getContractsForNetwork(network: SupportedNetwork) {
  return ERC8004_CONTRACTS[network];
}

// Yellow Network addresses
export const YELLOW = {
  // ClearNode WebSocket endpoints
  CLEARNODE_SANDBOX: 'wss://clearnet-sandbox.yellow.com/ws',
  CLEARNODE_PRODUCTION: 'wss://clearnet.yellow.com/ws',
  // Use environment variable or default to sandbox
  CLEARNODE: process.env.NEXT_PUBLIC_YELLOW_CLEARNODE || 'wss://clearnet-sandbox.yellow.com/ws',

  // Yellow Network Contracts (cross-chain)
  CUSTODY: '0x019B65A265EB3363822f2752141b3dF16131b262' as const,
  ADJUDICATOR: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as const,

  // Test token (sandbox only)
  TEST_USD: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const,
};

// Stablecoin addresses per network (for Yellow Network payments)
export const STABLECOINS = {
  // Base Mainnet - Circle's official USDC
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  },
  // Base Sepolia - Yellow Test USD for sandbox
  baseSepolia: {
    USDC: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const, // Yellow Test USD
  },
  // Polygon Amoy - Yellow Test USD for sandbox
  polygonAmoy: {
    USDC: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const, // Yellow Test USD
  },
} as const;

// Helper to get payment token for a network
export function getPaymentToken(network: SupportedNetwork): `0x${string}` {
  return STABLECOINS[network].USDC;
}

// Chain configurations
export const CHAIN_CONFIG = {
  polygonAmoy: {
    chainId: 80002,
    rpc: 'https://rpc-amoy.polygon.technology',
    name: 'Polygon Amoy',
    blockExplorer: 'https://amoy.polygonscan.com',
  },
  baseSepolia: {
    chainId: 84532,
    rpc: 'https://sepolia.base.org',
    name: 'Base Sepolia',
    blockExplorer: 'https://sepolia.basescan.org',
  },
  base: {
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    name: 'Base',
    blockExplorer: 'https://basescan.org',
  },
} as const;

// Legacy exports for backward compatibility
export const POLYGON_AMOY_CHAIN_ID = CHAIN_CONFIG.polygonAmoy.chainId;
export const POLYGON_AMOY_RPC = CHAIN_CONFIG.polygonAmoy.rpc;
export const BASE_SEPOLIA_CHAIN_ID = CHAIN_CONFIG.baseSepolia.chainId;
export const BASE_SEPOLIA_RPC = CHAIN_CONFIG.baseSepolia.rpc;
export const BASE_CHAIN_ID = CHAIN_CONFIG.base.chainId;
export const BASE_RPC = CHAIN_CONFIG.base.rpc;

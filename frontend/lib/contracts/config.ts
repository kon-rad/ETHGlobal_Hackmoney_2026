'use client';

import { http } from 'wagmi';
import { sepolia, polygonAmoy, baseSepolia, base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Re-export addresses for convenience
export { CONTRACTS, YELLOW, ERC8004_CONTRACTS, CHAIN_CONFIG, DEFAULT_NETWORK, getContractsForNetwork } from './addresses';
export type { SupportedNetwork } from './addresses';

// RPC URLs from environment or defaults
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/WddzdzI2o9S3COdT73d5w6AIogbKq4X-';
const POLYGON_AMOY_RPC = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology';
const BASE_SEPOLIA_RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';

// Wagmi config with RainbowKit (client-only)
// Base Mainnet is primary for ERC-8004, with fallbacks to other networks
export const wagmiConfig = getDefaultConfig({
  appName: 'Clawork',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [base, baseSepolia, sepolia, polygonAmoy],
  ssr: true,
  transports: {
    [base.id]: http(BASE_RPC),
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC),
    [sepolia.id]: http(SEPOLIA_RPC),
    [polygonAmoy.id]: http(POLYGON_AMOY_RPC),
  },
});

// Export chain objects for convenience
export const chains = {
  baseSepolia,
  base,
  sepolia,
  polygonAmoy,
} as const;

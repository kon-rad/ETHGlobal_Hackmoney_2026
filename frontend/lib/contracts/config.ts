'use client';

import { http } from 'wagmi';
import { sepolia, polygonAmoy } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Re-export addresses for convenience
export { CONTRACTS, YELLOW } from './addresses';

// RPC URLs
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/WddzdzI2o9S3COdT73d5w6AIogbKq4X-';
const POLYGON_AMOY_RPC = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology';

// Wagmi config with RainbowKit (client-only)
// Sepolia is primary, Polygon Amoy as secondary
export const wagmiConfig = getDefaultConfig({
  appName: 'Clawork',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [sepolia, polygonAmoy],
  ssr: true,
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
    [polygonAmoy.id]: http(POLYGON_AMOY_RPC),
  },
});

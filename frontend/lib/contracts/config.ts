'use client';

import { http } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Re-export addresses for convenience
export { CONTRACTS, YELLOW } from './addresses';

// Wagmi config with RainbowKit (client-only)
export const wagmiConfig = getDefaultConfig({
  appName: 'Clawork',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [polygonAmoy],
  ssr: true,
  transports: {
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology'),
  },
});

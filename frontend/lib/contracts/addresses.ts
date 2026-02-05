// Contract addresses (ERC-8004 on Polygon Amoy)
// This file is safe to import on both client and server

export const CONTRACTS = {
  IDENTITY_REGISTRY: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898' as const,
  REPUTATION_REGISTRY: '0x8004B12F4C2B42d00c46479e859C92e39044C930' as const,
  VALIDATION_REGISTRY: '0x8004C11C213ff7BaD36489bcBDF947ba5eee289B' as const,
};

// Yellow Network addresses (for future integration)
export const YELLOW = {
  CLEARNODE: 'wss://clearnet-sandbox.yellow.com/ws',
  CUSTODY: '0x019B65A265EB3363822f2752141b3dF16131b262' as const,
  ADJUDICATOR: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as const,
  TEST_USD: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const,
};

// Chain config
export const POLYGON_AMOY_CHAIN_ID = 80002;
export const POLYGON_AMOY_RPC = 'https://rpc-amoy.polygon.technology';

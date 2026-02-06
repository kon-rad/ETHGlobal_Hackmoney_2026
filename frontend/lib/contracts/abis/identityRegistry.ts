// ERC-8004 Identity Registry ABI
// Address: 0x8004ad19E14B9e0654f73353e8a0B600D46C2898 (Polygon Amoy)
export const IDENTITY_REGISTRY_ABI = [
  // Registration with agentURI (ERC-8004 spec compliant)
  {
    name: 'register',
    type: 'function',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Set agent URI (update metadata)
  {
    name: 'setAgentURI',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Set agent wallet with EIP-712 signature (wallet delegation)
  {
    name: 'setAgentWallet',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newWallet', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Get agent wallet (delegated wallet for agent)
  {
    name: 'getAgentWallet',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'wallet', type: 'address' }],
    stateMutability: 'view',
  },
  // Get agent URI
  {
    name: 'agentURI',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  // Set metadata key-value
  {
    name: 'setMetadata',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Get metadata by key
  {
    name: 'getMetadata',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: 'value', type: 'bytes' }],
    stateMutability: 'view',
  },
  // ERC-721 balance check
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Get token by owner index
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
  // Get owner of token
  {
    name: 'ownerOf',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // Get token URI (alias for agentURI for ERC-721 compatibility)
  {
    name: 'tokenURI',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  // Total supply
  {
    name: 'totalSupply',
    type: 'function',
    inputs: [],
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
  {
    name: 'Registered',
    type: 'event',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
    ],
  },
  {
    name: 'AgentURIUpdated',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'newURI', type: 'string', indexed: false },
    ],
  },
  {
    name: 'AgentWalletUpdated',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'newWallet', type: 'address', indexed: true },
    ],
  },
  {
    name: 'MetadataUpdated',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'key', type: 'string', indexed: false },
    ],
  },
] as const;

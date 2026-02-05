// ERC-8004 Reputation Registry ABI
// Address: 0x8004B12F4C2B42d00c46479e859C92e39044C930 (Polygon Amoy)
export const REPUTATION_REGISTRY_ABI = [
  // Get feedback for an agent
  {
    name: 'getFeedback',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'rating', type: 'uint8' },
          { name: 'comment', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Add feedback
  {
    name: 'addFeedback',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'rating', type: 'uint8' },
      { name: 'comment', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Get aggregate reputation score
  {
    name: 'getReputation',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'score', type: 'uint256' },
      { name: 'totalFeedback', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  // Check if address can provide feedback
  {
    name: 'canProvideFeedback',
    type: 'function',
    inputs: [
      { name: 'provider', type: 'address' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'FeedbackAdded',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'rating', type: 'uint8', indexed: false },
    ],
  },
] as const;

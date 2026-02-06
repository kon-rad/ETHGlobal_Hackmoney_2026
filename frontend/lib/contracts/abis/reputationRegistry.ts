// ERC-8004 Reputation Registry ABI
// Address: 0x8004B12F4C2B42d00c46479e859C92e39044C930 (Polygon Amoy)
export const REPUTATION_REGISTRY_ABI = [
  // ============================================================================
  // ERC-8004 Spec-Compliant Write Functions
  // ============================================================================

  // Give feedback - full ERC-8004 spec
  {
    name: 'giveFeedback',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Append response to feedback (agent responds to client feedback)
  {
    name: 'appendResponse',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============================================================================
  // ERC-8004 Spec-Compliant Read Functions
  // ============================================================================

  // Get summary with optional filtering
  {
    name: 'getSummary',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  // Get clients who have provided feedback
  {
    name: 'getClients',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'clients', type: 'address[]' }],
    stateMutability: 'view',
  },
  // Get last feedback index for a specific client
  {
    name: 'getLastIndex',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
    ],
    outputs: [{ name: 'lastIndex', type: 'uint64' }],
    stateMutability: 'view',
  },
  // Read specific feedback entry
  {
    name: 'readFeedback',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'index', type: 'uint64' },
    ],
    outputs: [
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },

  // ============================================================================
  // Legacy/Convenience Functions (backwards compatibility)
  // ============================================================================

  // Get feedback for an agent (legacy format)
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
  // Legacy add feedback (simpler interface)
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

  // ============================================================================
  // Events
  // ============================================================================

  // ERC-8004 spec event
  {
    name: 'FeedbackGiven',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
      { name: 'value', type: 'int128', indexed: false },
      { name: 'valueDecimals', type: 'uint8', indexed: false },
      { name: 'tag1', type: 'string', indexed: false },
      { name: 'tag2', type: 'string', indexed: false },
    ],
  },
  {
    name: 'ResponseAppended',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
    ],
  },
  // Legacy event
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

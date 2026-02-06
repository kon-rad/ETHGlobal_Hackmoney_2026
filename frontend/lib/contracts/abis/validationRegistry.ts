// ERC-8004 Validation Registry ABI
// Address: 0x8004C11C213ff7BaD36489bcBDF947ba5eee289B (Polygon Amoy)
export const VALIDATION_REGISTRY_ABI = [
  // ============================================================================
  // Write Functions
  // ============================================================================

  // Request validation from a third-party validator
  {
    name: 'validationRequest',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validator', type: 'address' },
      { name: 'validationType', type: 'string' },
      { name: 'requestURI', type: 'string' },
      { name: 'requestHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Validator responds to a validation request
  {
    name: 'validationResponse',
    type: 'function',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'approved', type: 'bool' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Cancel a pending validation request
  {
    name: 'cancelValidationRequest',
    type: 'function',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============================================================================
  // Read Functions
  // ============================================================================

  // Get validation status for a request
  {
    name: 'getValidationStatus',
    type: 'function',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validator', type: 'address' },
      { name: 'validationType', type: 'string' },
      { name: 'status', type: 'uint8' }, // 0=Pending, 1=Approved, 2=Rejected, 3=Cancelled
      { name: 'requestURI', type: 'string' },
      { name: 'responseURI', type: 'string' },
      { name: 'requestedAt', type: 'uint256' },
      { name: 'respondedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  // Get all validations for an agent
  {
    name: 'getAgentValidations',
    type: 'function',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // Get validations by type for an agent
  {
    name: 'getAgentValidationsByType',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validationType', type: 'string' },
    ],
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // Check if agent has approved validation of a specific type
  {
    name: 'hasValidation',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validationType', type: 'string' },
      { name: 'validator', type: 'address' },
    ],
    outputs: [{ name: 'validated', type: 'bool' }],
    stateMutability: 'view',
  },
  // Get pending validation requests for a validator
  {
    name: 'getPendingRequests',
    type: 'function',
    inputs: [{ name: 'validator', type: 'address' }],
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
    stateMutability: 'view',
  },

  // ============================================================================
  // Events
  // ============================================================================

  {
    name: 'ValidationRequested',
    type: 'event',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'validator', type: 'address', indexed: true },
      { name: 'validationType', type: 'string', indexed: false },
    ],
  },
  {
    name: 'ValidationResponded',
    type: 'event',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'approved', type: 'bool', indexed: false },
    ],
  },
  {
    name: 'ValidationCancelled',
    type: 'event',
    inputs: [{ name: 'requestId', type: 'uint256', indexed: true }],
  },
] as const;

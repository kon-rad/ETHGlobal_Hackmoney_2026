export type BountyStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'AUTO_RELEASED';

export type BountyType = 'STANDARD' | 'PROPOSAL';

export type DisputeStatus = 'NONE' | 'PENDING' | 'RESOLVED';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardToken: string;
  type: BountyType;
  status: BountyStatus;

  posterAddress: string;
  posterName?: string;

  assignedAgentId?: string;
  assignedAgentAddress?: string;

  // Yellow Network integration
  yellowChannelId?: string;
  yellowSessionId?: string;

  createdAt: number;
  claimedAt?: number;
  submittedAt?: number;
  completedAt?: number;

  submitDeadline?: number;
  reviewDeadline?: number;

  deliverableCID?: string;
  deliverableMessage?: string;

  requiredSkills: string[];
  requirements: string;

  // Dispute fields
  disputeStatus?: DisputeStatus;
  disputeReason?: string;
  disputeTimestamp?: number;
}

// Input type for creating a bounty
export interface CreateBountyInput {
  title: string;
  description: string;
  reward: number;
  rewardToken?: string; // default: 'USDC'
  type: BountyType;
  requiredSkills: string[];
  requirements: string;
  submitDeadlineDays?: number; // default: 3
  posterAddress: string;
}

// Input type for claiming a bounty
export interface ClaimBountyInput {
  agentId: string;
  agentAddress: string;
}

// Input type for submitting work
export interface SubmitWorkInput {
  agentId: string;
  deliverableCID?: string;
  message: string;
}

// Input type for approving work
export interface ApproveWorkInput {
  posterAddress: string;
  rating?: number; // 1-5
}

// Input type for opening a dispute
export interface DisputeInput {
  initiatorAddress: string;
  reason: string;
}

// Filters for listing bounties
export interface BountyFilters {
  status?: BountyStatus;
  type?: BountyType;
  skills?: string[];
  minReward?: number;
  posterAddress?: string;
  agentAddress?: string;
  limit?: number;
}

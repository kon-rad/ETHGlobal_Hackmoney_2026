export type BountyStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'AUTO_RELEASED';

export type BountyType = 'STANDARD' | 'PROPOSAL';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: BountyType;
  status: BountyStatus;

  posterAddress: string;
  posterName?: string;

  assignedAgentId?: string;
  assignedAgentAddress?: string;
  yellowChannelId?: string;

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
}

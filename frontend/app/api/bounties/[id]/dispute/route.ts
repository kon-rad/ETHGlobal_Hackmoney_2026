import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Bounty, DisputeInput } from '@/lib/types/bounty';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/dispute - Open a dispute
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body: DisputeInput = await request.json();
    const { initiatorAddress, reason } = body;

    // Validate input
    if (!initiatorAddress || !isAddress(initiatorAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ADDRESS', message: 'Valid initiator address required' } },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REASON', message: 'Dispute reason required' } },
        { status: 400 }
      );
    }

    // Get bounty
    const bountyRef = doc(db, 'bounties', id);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    const bounty = bountyDoc.data() as Bounty;

    // Check status allows dispute
    const disputeAllowedStatuses = ['CLAIMED', 'SUBMITTED'];
    if (!disputeAllowedStatuses.includes(bounty.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS_FOR_DISPUTE', message: `Cannot dispute bounty with status: ${bounty.status}` } },
        { status: 400 }
      );
    }

    // Verify initiator is a participant
    const initiatorLower = initiatorAddress.toLowerCase();
    const isPoster = bounty.posterAddress === initiatorLower;
    const isAgent = bounty.assignedAgentAddress === initiatorLower;

    if (!isPoster && !isAgent) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_PARTICIPANT', message: 'Only the poster or assigned agent can open a dispute' } },
        { status: 403 }
      );
    }

    // Check if already disputed
    if (bounty.disputeStatus === 'PENDING') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_DISPUTED', message: 'A dispute is already pending for this bounty' } },
        { status: 400 }
      );
    }

    const now = Date.now();
    const disputeId = `dispute_${id}_${now}`;

    // Update bounty with dispute info
    await updateDoc(bountyRef, {
      disputeStatus: 'PENDING',
      disputeReason: reason.trim(),
      disputeTimestamp: now,
      disputeInitiator: initiatorLower,
      disputeId,
    });

    // In a real implementation, this would trigger the Yellow adjudicator
    // via the ERC-7824 dispute resolution protocol

    return NextResponse.json({
      success: true,
      disputeId,
      message: 'Dispute opened. This will be reviewed by the Yellow Network adjudicator.',
    });

  } catch (error) {
    console.error('Open dispute error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to open dispute' } },
      { status: 500 }
    );
  }
}

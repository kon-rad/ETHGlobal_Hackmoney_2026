import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/submit
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId, deliverableCID, message } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AGENT', message: 'Agent ID required' } },
        { status: 400 }
      );
    }

    if (!deliverableCID && !message) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DELIVERABLE', message: 'Deliverable CID or message required' } },
        { status: 400 }
      );
    }

    const bountyRef = doc(db, 'bounties', id);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    const bounty = bountyDoc.data();

    if (bounty.status !== 'CLAIMED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Bounty must be claimed to submit work' } },
        { status: 400 }
      );
    }

    if (bounty.assignedAgentId !== agentId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this bounty' } },
        { status: 403 }
      );
    }

    // Check deadline
    if (bounty.submitDeadline && Date.now() > bounty.submitDeadline) {
      return NextResponse.json(
        { success: false, error: { code: 'DEADLINE_PASSED', message: 'Submit deadline has passed' } },
        { status: 400 }
      );
    }

    // Update bounty
    const reviewDeadline = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    await updateDoc(bountyRef, {
      status: 'SUBMITTED',
      deliverableCID: deliverableCID || null,
      deliverableMessage: message || null,
      submittedAt: Date.now(),
      reviewDeadline,
    });

    return NextResponse.json({
      success: true,
      reviewDeadline,
      message: 'Work submitted! Poster has 24 hours to review.',
    });

  } catch (error) {
    console.error('Submit work error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to submit work' } },
      { status: 500 }
    );
  }
}

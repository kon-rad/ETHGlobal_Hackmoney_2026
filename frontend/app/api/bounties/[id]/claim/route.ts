import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { openChannel } from '@/lib/services/yellow';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/claim
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId, agentAddress } = body;

    if (!agentId || !agentAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AGENT', message: 'Agent ID and address required' } },
        { status: 400 }
      );
    }

    const bountyRef = doc(db, 'bounties', id);
    const submitDeadline = Date.now() + (3 * 24 * 60 * 60 * 1000); // 3 days

    // Use Firestore transaction to prevent race conditions
    const result = await runTransaction(db, async (transaction) => {
      const bountyDoc = await transaction.get(bountyRef);

      if (!bountyDoc.exists()) {
        throw new Error('BOUNTY_NOT_FOUND');
      }

      const bounty = bountyDoc.data();

      if (bounty.status !== 'OPEN') {
        throw new Error('BOUNTY_ALREADY_CLAIMED');
      }

      // Open Yellow state channel
      const { channelId } = await openChannel({
        poster: bounty.posterAddress,
        agent: agentAddress.toLowerCase(),
        deposit: bounty.reward,
      });

      // Update bounty atomically
      transaction.update(bountyRef, {
        status: 'CLAIMED',
        assignedAgentId: agentId,
        assignedAgentAddress: agentAddress.toLowerCase(),
        yellowChannelId: channelId,
        claimedAt: Date.now(),
        submitDeadline,
      });

      return { channelId };
    });

    return NextResponse.json({
      success: true,
      channelId: result.channelId,
      submitDeadline,
      message: 'Bounty claimed! Complete and submit your work before the deadline.',
    });

  } catch (error) {
    console.error('Claim bounty error:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'BOUNTY_NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
          { status: 404 }
        );
      }
      if (error.message === 'BOUNTY_ALREADY_CLAIMED') {
        return NextResponse.json(
          { success: false, error: { code: 'BOUNTY_ALREADY_CLAIMED', message: 'Bounty has already been claimed' } },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to claim bounty' } },
      { status: 500 }
    );
  }
}

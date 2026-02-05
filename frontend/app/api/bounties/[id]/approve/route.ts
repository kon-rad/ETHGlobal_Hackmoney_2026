import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { updateAllocation, closeChannel } from '@/lib/services/yellow';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/bounties/:id/approve
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { posterAddress, approved } = body;

    if (!posterAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_POSTER', message: 'Poster address required' } },
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

    if (bounty.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Bounty must be submitted to approve' } },
        { status: 400 }
      );
    }

    if (bounty.posterAddress !== posterAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_POSTER', message: 'Only the poster can approve this bounty' } },
        { status: 403 }
      );
    }

    if (approved) {
      // Transfer funds to agent via Yellow channel
      if (bounty.yellowChannelId) {
        await updateAllocation(bounty.yellowChannelId, {
          [bounty.assignedAgentAddress]: bounty.reward,
          [bounty.posterAddress]: 0,
        });
        await closeChannel(bounty.yellowChannelId);
      }

      // Update bounty status
      await updateDoc(bountyRef, {
        status: 'COMPLETED',
        completedAt: Date.now(),
      });

      // Update agent reputation
      if (bounty.assignedAgentId) {
        const agentRef = doc(db, 'agents', bounty.assignedAgentId);
        await updateDoc(agentRef, {
          'reputation.totalJobs': increment(1),
          'reputation.positive': increment(1),
          'reputation.score': increment(0.2), // Simple scoring
        });
      }

      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        message: 'Work approved! Payment released to agent.',
      });
    } else {
      // Rejected
      await updateDoc(bountyRef, {
        status: 'REJECTED',
        completedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        status: 'REJECTED',
        message: 'Work rejected. Bounty marked as rejected.',
      });
    }

  } catch (error) {
    console.error('Approve bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process approval' } },
      { status: 500 }
    );
  }
}

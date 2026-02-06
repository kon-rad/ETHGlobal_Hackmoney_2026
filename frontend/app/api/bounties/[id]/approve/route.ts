import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { updateAllocation, closeChannel, MOCK_MODE } from '@/lib/services/yellow';

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
    const { posterAddress, approved, rating, comment } = body;

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
      let settlementTxHash: string | null = null;

      if (bounty.yellowChannelId) {
        try {
          console.log(`[Approve] Processing payment for bounty ${id} via Yellow channel ${bounty.yellowChannelId}`);
          console.log(`[Approve] Mode: ${MOCK_MODE ? 'MOCK' : 'PRODUCTION'}`);

          // Update allocation: transfer full reward to agent
          await updateAllocation(bounty.yellowChannelId, {
            [bounty.assignedAgentAddress]: bounty.reward,
            [bounty.posterAddress]: 0,
          });

          // Close channel and settle on-chain
          const { txHash } = await closeChannel(bounty.yellowChannelId);
          settlementTxHash = txHash || null;

          console.log(`[Approve] Payment settled for bounty ${id}. TxHash: ${txHash || 'none (mock mode)'}`);
        } catch (paymentError) {
          // Log error but don't fail the approval - funds can be settled manually later
          console.error(`[Approve] Payment settlement failed for bounty ${id}:`, paymentError);
          console.warn(`[Approve] Bounty ${id} will be marked complete but settlement may need manual intervention`);
        }
      } else {
        console.log(`[Approve] No Yellow channel for bounty ${id}, skipping payment settlement`);
      }

      // Update bounty status with settlement info
      await updateDoc(bountyRef, {
        status: 'COMPLETED',
        completedAt: Date.now(),
        ...(settlementTxHash && { settlementTxHash }),
      });

      // Update agent reputation
      if (bounty.assignedAgentId) {
        const agentRef = doc(db, 'agents', bounty.assignedAgentId);

        // Calculate score increment based on rating (default to 5 if not provided)
        const ratingValue = rating || 5;
        const scoreIncrement = (ratingValue - 3) * 0.1; // -0.2 to +0.2

        await updateDoc(agentRef, {
          'reputation.totalJobs': increment(1),
          'reputation.positive': increment(ratingValue >= 3 ? 1 : 0),
          'reputation.negative': increment(ratingValue < 3 ? 1 : 0),
          'reputation.score': increment(scoreIncrement),
          'feedbackHistory': arrayUnion({
            bountyId: id,
            bountyTitle: bounty.title,
            rating: ratingValue,
            comment: comment || '',
            posterAddress: posterAddress.toLowerCase(),
            timestamp: Date.now(),
          }),
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

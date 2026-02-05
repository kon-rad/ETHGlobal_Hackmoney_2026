import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAgentReputation, getAgentFeedback } from '@/lib/contracts/erc8004';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/agents/:id/reputation - Get agent reputation
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const agentDoc = await getDoc(doc(db, 'agents', id));

    if (!agentDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const agent = agentDoc.data();

    // Try to get on-chain reputation if agent has ERC-8004 ID
    let onChainReputation = null;
    let onChainFeedback: Array<{
      from: string;
      rating: number;
      comment: string;
      timestamp: string;
    }> = [];

    if (agent.erc8004Id) {
      try {
        const rep = await getAgentReputation(BigInt(agent.erc8004Id));
        if (rep) {
          onChainReputation = {
            score: Number(rep.score),
            totalFeedback: Number(rep.totalFeedback),
          };
        }

        const feedback = await getAgentFeedback(BigInt(agent.erc8004Id));
        onChainFeedback = feedback.map(f => ({
          from: f.from,
          rating: f.rating,
          comment: f.comment,
          timestamp: f.timestamp.toString(),
        }));
      } catch (err) {
        console.warn('Could not fetch on-chain reputation:', err);
      }
    }

    // Firebase reputation (cached/aggregate)
    const reputation = agent.reputation || {
      score: 0,
      totalJobs: 0,
      positive: 0,
      negative: 0,
      confidence: 0,
    };

    return NextResponse.json({
      success: true,
      agentId: id,
      erc8004Id: agent.erc8004Id,
      // Cached reputation from Firebase
      reputation: {
        score: reputation.score,
        totalJobs: reputation.totalJobs,
        confidence: reputation.confidence,
        breakdown: {
          positive: reputation.positive,
          neutral: reputation.totalJobs - reputation.positive - reputation.negative,
          negative: reputation.negative,
        },
      },
      // On-chain data (ERC-8004)
      onChain: onChainReputation ? {
        score: onChainReputation.score,
        totalFeedback: onChainReputation.totalFeedback,
        feedback: onChainFeedback,
      } : null,
    });

  } catch (error) {
    console.error('Get reputation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get reputation' } },
      { status: 500 }
    );
  }
}

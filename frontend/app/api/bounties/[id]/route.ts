import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/bounties/:id
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const bountyDoc = await getDoc(doc(db, 'bounties', id));

    if (!bountyDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'BOUNTY_NOT_FOUND', message: 'Bounty not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bounty: bountyDoc.data(),
    });

  } catch (error) {
    console.error('Get bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get bounty' } },
      { status: 500 }
    );
  }
}

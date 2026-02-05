import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/agents/:id - Get single agent
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

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        walletAddress: agent.walletAddress,
        name: agent.name,
        skills: agent.skills,
        erc8004Id: agent.erc8004Id,
        reputation: agent.reputation,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    });

  } catch (error) {
    console.error('Get agent error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to get agent' } },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/:id - Update agent
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, skills } = body;

    const agentRef = doc(db, 'agents', id);
    const agentDoc = await getDoc(agentRef);

    if (!agentDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (name && typeof name === 'string') {
      updates.name = name.trim();
    }

    if (skills && Array.isArray(skills) && skills.length > 0) {
      updates.skills = skills.map((s: string) => s.toLowerCase().trim());
    }

    await updateDoc(agentRef, updates);

    const updatedDoc = await getDoc(agentRef);
    const agent = updatedDoc.data();

    return NextResponse.json({
      success: true,
      agent: {
        id: agent?.id,
        walletAddress: agent?.walletAddress,
        name: agent?.name,
        skills: agent?.skills,
        erc8004Id: agent?.erc8004Id,
        reputation: agent?.reputation,
        updatedAt: agent?.updatedAt,
      },
      message: 'Agent updated successfully',
    });

  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update agent' } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

// POST /api/bounties - Create a new bounty
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, reward, posterAddress, requiredSkills, requirements } = body;

    // Validation
    if (!title || title.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TITLE', message: 'Title must be at least 5 characters' } },
        { status: 400 }
      );
    }

    if (!description || description.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DESCRIPTION', message: 'Description must be at least 20 characters' } },
        { status: 400 }
      );
    }

    if (!reward || reward < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REWARD', message: 'Reward must be at least 1 USDC' } },
        { status: 400 }
      );
    }

    if (!posterAddress || !isAddress(posterAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_POSTER', message: 'Valid poster wallet address required' } },
        { status: 400 }
      );
    }

    const bountyId = `bounty_${Date.now()}`;
    const bountyData = {
      id: bountyId,
      title: title.trim(),
      description: description.trim(),
      reward: Number(reward),
      type: 'STANDARD',
      status: 'OPEN',
      posterAddress: posterAddress.toLowerCase(),
      requiredSkills: requiredSkills?.map((s: string) => s.toLowerCase().trim()) || [],
      requirements: requirements?.trim() || '',
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'bounties', bountyId), bountyData);

    return NextResponse.json({
      success: true,
      bountyId,
      ...bountyData,
      message: 'Bounty created successfully!',
    });

  } catch (error) {
    console.error('Create bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create bounty' } },
      { status: 500 }
    );
  }
}

// GET /api/bounties - List bounties
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const skill = searchParams.get('skill');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const bountiesRef = collection(db, 'bounties');
    const snapshot = await getDocs(bountiesRef);

    let bounties = snapshot.docs.map(doc => doc.data());

    // Filter by status
    if (status) {
      bounties = bounties.filter(b => b.status === status.toUpperCase());
    }

    // Filter by skill
    if (skill) {
      const skillLower = skill.toLowerCase();
      bounties = bounties.filter(b =>
        b.requiredSkills?.some((s: string) => s.includes(skillLower))
      );
    }

    // Sort by newest first
    bounties.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    bounties = bounties.slice(0, limit);

    return NextResponse.json({
      success: true,
      bounties,
      total: bounties.length,
    });

  } catch (error) {
    console.error('List bounties error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list bounties' } },
      { status: 500 }
    );
  }
}

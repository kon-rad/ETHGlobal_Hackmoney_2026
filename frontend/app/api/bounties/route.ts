import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { openChannel } from '@/lib/services/yellow';
import type { Bounty, CreateBountyInput, BountyStatus, BountyType } from '@/lib/types/bounty';

// Default deadline: 3 days for submission
const DEFAULT_SUBMIT_DEADLINE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// POST /api/bounties - Create a new bounty
export async function POST(request: NextRequest) {
  try {
    const body: CreateBountyInput = await request.json();
    const {
      title,
      description,
      reward,
      rewardToken = 'USDC',
      type = 'STANDARD',
      requiredSkills,
      requirements,
      submitDeadlineDays = DEFAULT_SUBMIT_DEADLINE_DAYS,
      posterAddress,
    } = body;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TITLE', message: 'Bounty title required' } },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TITLE', message: 'Title must be 100 characters or less' } },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DESCRIPTION', message: 'Bounty description required' } },
        { status: 400 }
      );
    }

    if (!reward || typeof reward !== 'number' || reward < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REWARD', message: 'Reward must be at least 1 USDC' } },
        { status: 400 }
      );
    }

    if (!posterAddress || !isAddress(posterAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_POSTER_ADDRESS', message: 'Valid poster wallet address required' } },
        { status: 400 }
      );
    }

    if (!requiredSkills || !Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SKILLS', message: 'At least one required skill needed' } },
        { status: 400 }
      );
    }

    if (!requirements || typeof requirements !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUIREMENTS', message: 'Requirements description required' } },
        { status: 400 }
      );
    }

    if (type && !['STANDARD', 'PROPOSAL'].includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TYPE', message: 'Type must be STANDARD or PROPOSAL' } },
        { status: 400 }
      );
    }

    const now = Date.now();
    const bountyId = `bounty_${now}`;

    // Open Yellow Network channel for the bounty
    let yellowChannelId: string | undefined;
    let yellowSessionId: string | undefined;

    try {
      // For now, we'll use mock mode or skip if no signer available
      // In production, this would require the poster to sign
      const channelResult = await openChannel({
        poster: posterAddress,
        agent: '0x0000000000000000000000000000000000000000', // Placeholder until claimed
        deposit: reward,
        token: rewardToken,
      });
      yellowChannelId = channelResult.channelId;
      yellowSessionId = channelResult.sessionId;
    } catch (err) {
      console.warn('Yellow channel creation skipped (mock mode or error):', err);
      // Continue without channel - will be created on claim
    }

    const bounty: Bounty = {
      id: bountyId,
      title: title.trim(),
      description: description.trim(),
      reward,
      rewardToken,
      type: type as BountyType,
      status: 'OPEN',
      posterAddress: posterAddress.toLowerCase(),
      requiredSkills: requiredSkills.map((s: string) => s.toLowerCase().trim()),
      requirements: requirements.trim(),
      yellowChannelId,
      yellowSessionId,
      createdAt: now,
      submitDeadline: now + (submitDeadlineDays * DAY_MS),
    };

    // Store in Firebase
    await setDoc(doc(db, 'bounties', bountyId), bounty);

    return NextResponse.json({
      success: true,
      bountyId,
      bounty,
      message: yellowChannelId
        ? 'Bounty created with Yellow Network channel!'
        : 'Bounty created! Yellow channel will be opened when an agent claims.',
    });

  } catch (error) {
    console.error('Create bounty error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create bounty' } },
      { status: 500 }
    );
  }
}

// GET /api/bounties - List bounties with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as BountyStatus | null;
    const type = searchParams.get('type') as BountyType | null;
    const skills = searchParams.get('skills'); // comma-separated
    const minReward = searchParams.get('minReward');
    const posterAddress = searchParams.get('posterAddress');
    const agentAddress = searchParams.get('agentAddress');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const bountiesRef = collection(db, 'bounties');
    const snapshot = await getDocs(bountiesRef);

    let bounties = snapshot.docs.map(doc => doc.data() as Bounty);

    // Apply filters
    if (status) {
      bounties = bounties.filter(b => b.status === status);
    }

    if (type) {
      bounties = bounties.filter(b => b.type === type);
    }

    if (skills) {
      const skillList = skills.toLowerCase().split(',').map(s => s.trim());
      bounties = bounties.filter(b =>
        skillList.some(skill =>
          b.requiredSkills.some(rs => rs.includes(skill))
        )
      );
    }

    if (minReward) {
      const minRewardNum = parseFloat(minReward);
      bounties = bounties.filter(b => b.reward >= minRewardNum);
    }

    if (posterAddress) {
      bounties = bounties.filter(b => b.posterAddress.toLowerCase() === posterAddress.toLowerCase());
    }

    if (agentAddress) {
      bounties = bounties.filter(b =>
        b.assignedAgentAddress?.toLowerCase() === agentAddress.toLowerCase()
      );
    }

    // Sort by createdAt descending (newest first)
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

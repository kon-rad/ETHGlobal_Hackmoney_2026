import { NextRequest, NextResponse } from 'next/server';
import { isAddress, type Address } from 'viem';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { getAgentId, publicClient } from '@/lib/contracts/erc8004';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { IDENTITY_REGISTRY_ABI } from '@/lib/contracts/abis/identityRegistry';

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, name, skills } = body;

    // Validate input
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_WALLET', message: 'Valid wallet address required' } },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Agent name required' } },
        { status: 400 }
      );
    }

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SKILLS', message: 'At least one skill required' } },
        { status: 400 }
      );
    }

    const walletLower = wallet.toLowerCase();

    // Check if already registered on-chain (ERC-8004)
    let existingId: bigint | null = null;
    try {
      existingId = await getAgentId(wallet as `0x${string}`);
    } catch (err) {
      console.warn('Could not check on-chain registration:', err);
    }

    // Check if already in our database
    const agentsRef = collection(db, 'agents');
    const q = query(agentsRef, where('walletAddress', '==', walletLower));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const existingAgent = snapshot.docs[0].data();
      return NextResponse.json({
        success: true,
        agentId: existingAgent.id,
        erc8004Id: existingAgent.erc8004Id || null,
        walletAddress: existingAgent.walletAddress,
        name: existingAgent.name,
        skills: existingAgent.skills,
        reputation: existingAgent.reputation,
        message: 'Agent already registered',
      });
    }

    // Create new agent in Firebase
    const agentId = `agent_${Date.now()}`;
    const agentData = {
      id: agentId,
      walletAddress: walletLower,
      name: name.trim(),
      skills: skills.map((s: string) => s.toLowerCase().trim()),
      erc8004Id: existingId?.toString() || null,
      reputation: {
        score: 0,
        totalJobs: 0,
        positive: 0,
        negative: 0,
        confidence: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, 'agents', agentId), agentData);

    return NextResponse.json({
      success: true,
      agentId,
      erc8004Id: existingId?.toString() || null,
      walletAddress: walletLower,
      name: agentData.name,
      skills: agentData.skills,
      reputation: agentData.reputation,
      message: existingId
        ? 'Agent registered! ERC-8004 identity found on-chain.'
        : 'Agent registered! Connect wallet to mint ERC-8004 identity.',
    });

  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to register agent' } },
      { status: 500 }
    );
  }
}

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const agentsRef = collection(db, 'agents');
    const snapshot = await getDocs(agentsRef);

    let agents = snapshot.docs.map(doc => doc.data());

    // Filter by wallet address if provided
    if (wallet) {
      const walletLower = wallet.toLowerCase();
      agents = agents.filter(a =>
        a.walletAddress?.toLowerCase() === walletLower
      );
    }

    // Filter by skill if provided
    if (skill) {
      const skillLower = skill.toLowerCase();
      agents = agents.filter(a =>
        a.skills?.some((s: string) => s.toLowerCase().includes(skillLower))
      );
    }

    // Apply limit
    agents = agents.slice(0, limit);

    return NextResponse.json({
      success: true,
      agents: agents.map(a => ({
        id: a.id,
        walletAddress: a.walletAddress,
        name: a.name,
        skills: a.skills,
        erc8004Id: a.erc8004Id,
        reputation: a.reputation,
        createdAt: a.createdAt,
      })),
      total: agents.length,
    });

  } catch (error) {
    console.error('List agents error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list agents' } },
      { status: 500 }
    );
  }
}

// PATCH /api/agents - Update agent with ERC-8004 ID after minting
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, erc8004Id, wallet } = body;

    // Validate input
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AGENT_ID', message: 'Agent ID required' } },
        { status: 400 }
      );
    }

    if (!erc8004Id || typeof erc8004Id !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ERC8004_ID', message: 'ERC-8004 ID required' } },
        { status: 400 }
      );
    }

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_WALLET', message: 'Valid wallet address required' } },
        { status: 400 }
      );
    }

    // Verify the wallet owns this NFT on-chain
    try {
      const owner = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'ownerOf',
        args: [BigInt(erc8004Id)],
      });

      if ((owner as string).toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_OWNER', message: 'Wallet does not own this NFT' } },
          { status: 403 }
        );
      }
    } catch (err) {
      console.warn('Could not verify NFT ownership:', err);
      // Continue anyway for mock mode / testnet issues
    }

    // Get the agent document
    const agentRef = doc(db, 'agents', agentId);
    const agentDoc = await getDoc(agentRef);

    if (!agentDoc.exists()) {
      return NextResponse.json(
        { success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const agentData = agentDoc.data();

    // Verify the wallet matches
    if (agentData.walletAddress !== wallet.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: { code: 'WALLET_MISMATCH', message: 'Wallet does not match agent' } },
        { status: 403 }
      );
    }

    // Update with ERC-8004 ID
    await updateDoc(agentRef, {
      erc8004Id,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      agentId,
      erc8004Id,
      message: 'Agent updated with ERC-8004 identity',
    });

  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update agent' } },
      { status: 500 }
    );
  }
}

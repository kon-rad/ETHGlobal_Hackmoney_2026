// Mock Yellow Network SDK service
// Toggle MOCK_MODE via environment variable

const MOCK_MODE = process.env.YELLOW_MOCK_MODE !== 'false';

interface Channel {
  id: string;
  participants: [string, string];
  deposit: number;
  token: string;
  status: 'OPEN' | 'CLOSED';
  allocation: Record<string, number>;
  createdAt: number;
}

// In-memory store for mock channels
const mockChannels = new Map<string, Channel>();

export async function openChannel(params: {
  poster: string;
  agent: string;
  deposit: number;
  token?: string;
}): Promise<{ channelId: string }> {
  if (MOCK_MODE) {
    const channelId = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    mockChannels.set(channelId, {
      id: channelId,
      participants: [params.poster, params.agent],
      deposit: params.deposit,
      token: params.token || 'USDC',
      status: 'OPEN',
      allocation: { [params.poster]: params.deposit, [params.agent]: 0 },
      createdAt: Date.now(),
    });
    return { channelId };
  }

  // TODO: Real Yellow SDK integration
  // const nitrolite = new NitroliteClient(YELLOW_CLEARNODE);
  // return await nitrolite.openChannel(params);
  throw new Error('Real Yellow SDK not implemented');
}

export async function updateAllocation(
  channelId: string,
  allocation: Record<string, number>
): Promise<void> {
  if (MOCK_MODE) {
    const channel = mockChannels.get(channelId);
    if (!channel) throw new Error('Channel not found');
    channel.allocation = allocation;
    return;
  }
  throw new Error('Real Yellow SDK not implemented');
}

export async function closeChannel(channelId: string): Promise<void> {
  if (MOCK_MODE) {
    const channel = mockChannels.get(channelId);
    if (!channel) throw new Error('Channel not found');
    channel.status = 'CLOSED';
    return;
  }
  throw new Error('Real Yellow SDK not implemented');
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  if (MOCK_MODE) {
    return mockChannels.get(channelId) || null;
  }
  throw new Error('Real Yellow SDK not implemented');
}

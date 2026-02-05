/**
 * Yellow Network Server-Side Signer
 *
 * This utility provides server-side message signing for Yellow Network
 * operations. It uses a custodial key stored in environment variables.
 *
 * SECURITY NOTE: The private key should only be used in server-side code
 * (API routes). Never expose it to the client.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { type Account } from 'viem';

/**
 * Get a server-side signer function for Yellow Network operations
 *
 * This is used for platform-level operations where the server needs
 * to co-sign channel updates (e.g., dispute resolution, auto-release).
 */
export function getServerSigner(): (message: string) => Promise<string> {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('YELLOW_SERVER_PRIVATE_KEY not set, using mock signer');
    return mockSigner;
  }

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    return async (message: string): Promise<string> => {
      const signature = await account.signMessage({ message });
      return signature;
    };
  } catch (error) {
    console.error('Failed to create server signer:', error);
    return mockSigner;
  }
}

/**
 * Get the server wallet account
 *
 * Useful for retrieving the server's address for verification.
 */
export function getServerAccount(): Account | null {
  const privateKey = process.env.YELLOW_SERVER_PRIVATE_KEY;

  if (!privateKey) {
    return null;
  }

  try {
    return privateKeyToAccount(privateKey as `0x${string}`);
  } catch (error) {
    console.error('Failed to get server account:', error);
    return null;
  }
}

/**
 * Get the server wallet address
 */
export function getServerAddress(): string | null {
  const account = getServerAccount();
  return account?.address || null;
}

/**
 * Mock signer for development/testing
 */
async function mockSigner(message: string): Promise<string> {
  // Generate a deterministic mock signature based on the message
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message)
  );
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return a mock signature format
  return `0x${hashHex}${hashHex.slice(0, 64)}` as `0x${string}`;
}

/**
 * Verify if the server signer is properly configured
 */
export function isServerSignerConfigured(): boolean {
  return !!process.env.YELLOW_SERVER_PRIVATE_KEY;
}

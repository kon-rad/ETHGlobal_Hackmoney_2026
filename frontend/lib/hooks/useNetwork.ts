'use client';

/**
 * useNetwork Hook
 *
 * React context and hook for managing ERC-8004 network selection.
 * Provides functions for:
 * - Switching between supported networks (Base Sepolia, Base Mainnet, Polygon Amoy)
 * - Getting current network contracts and configuration
 * - Syncing with wallet network via wagmi
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import {
  ERC8004_CONTRACTS,
  CHAIN_CONFIG,
  DEFAULT_NETWORK,
  type SupportedNetwork,
} from '@/lib/contracts/addresses';
import { setCurrentNetwork as setErc8004Network } from '@/lib/contracts/erc8004';

// Chain ID to network mapping
const CHAIN_ID_TO_NETWORK: Record<number, SupportedNetwork> = {
  80002: 'polygonAmoy',
  84532: 'baseSepolia',
  8453: 'base',
};

const NETWORK_TO_CHAIN_ID: Record<SupportedNetwork, number> = {
  polygonAmoy: 80002,
  baseSepolia: 84532,
  base: 8453,
};

// ============================================================================
// Context
// ============================================================================

interface NetworkContextValue {
  // Current network state
  currentNetwork: SupportedNetwork;
  chainId: number;

  // Network info
  networkName: string;
  blockExplorer: string;
  rpcUrl: string;

  // Contracts for current network
  contracts: typeof ERC8004_CONTRACTS[SupportedNetwork];

  // Check if validation registry is available
  hasValidationRegistry: boolean;

  // Actions
  switchNetwork: (network: SupportedNetwork) => Promise<void>;
  isSwitching: boolean;
  switchError: Error | null;

  // Wallet sync status
  isWalletSynced: boolean;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface NetworkProviderProps {
  children: React.ReactNode;
  defaultNetwork?: SupportedNetwork;
}

export function NetworkProvider({
  children,
  defaultNetwork = DEFAULT_NETWORK,
}: NetworkProviderProps) {
  const [currentNetwork, setCurrentNetwork] = useState<SupportedNetwork>(defaultNetwork);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<Error | null>(null);

  // Wagmi hooks for wallet chain switching
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: isChainSwitching } = useSwitchChain();

  // Derived state
  const chainId = NETWORK_TO_CHAIN_ID[currentNetwork];
  const config = CHAIN_CONFIG[currentNetwork];
  const contracts = ERC8004_CONTRACTS[currentNetwork];
  const hasValidationRegistry = contracts.VALIDATION_REGISTRY !== null;
  const isWalletSynced = walletChainId === chainId;

  // Sync erc8004.ts module state when network changes
  useEffect(() => {
    setErc8004Network(currentNetwork);
  }, [currentNetwork]);

  // Switch network function
  const switchNetwork = useCallback(
    async (network: SupportedNetwork) => {
      if (network === currentNetwork) return;

      setIsSwitching(true);
      setSwitchError(null);

      try {
        // Update local state first
        setCurrentNetwork(network);

        // Try to switch wallet chain if available
        const targetChainId = NETWORK_TO_CHAIN_ID[network];
        if (switchChainAsync && walletChainId !== targetChainId) {
          await switchChainAsync({ chainId: targetChainId });
        }
      } catch (error) {
        // Don't revert - keep the network selection even if wallet switch fails
        // User can manually switch wallet later
        console.warn('Failed to switch wallet chain:', error);
        setSwitchError(error instanceof Error ? error : new Error('Failed to switch network'));
      } finally {
        setIsSwitching(false);
      }
    },
    [currentNetwork, switchChainAsync, walletChainId]
  );

  // Auto-sync when wallet chain changes to a supported network
  useEffect(() => {
    const network = CHAIN_ID_TO_NETWORK[walletChainId];
    if (network && network !== currentNetwork) {
      setCurrentNetwork(network);
    }
  }, [walletChainId, currentNetwork]);

  const value = useMemo(
    () => ({
      currentNetwork,
      chainId,
      networkName: config.name,
      blockExplorer: config.blockExplorer,
      rpcUrl: config.rpc,
      contracts,
      hasValidationRegistry,
      switchNetwork,
      isSwitching: isSwitching || isChainSwitching,
      switchError,
      isWalletSynced,
    }),
    [
      currentNetwork,
      chainId,
      config,
      contracts,
      hasValidationRegistry,
      switchNetwork,
      isSwitching,
      isChainSwitching,
      switchError,
      isWalletSynced,
    ]
  );

  return React.createElement(NetworkContext.Provider, { value }, children);
}

// ============================================================================
// Hook
// ============================================================================

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }

  return context;
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Get all supported networks with their info
 */
export function useSupportedNetworks() {
  return useMemo(
    () =>
      (Object.keys(CHAIN_CONFIG) as SupportedNetwork[]).map((network) => ({
        network,
        ...CHAIN_CONFIG[network],
        contracts: ERC8004_CONTRACTS[network],
        hasValidationRegistry: ERC8004_CONTRACTS[network].VALIDATION_REGISTRY !== null,
      })),
    []
  );
}

/**
 * Check if a specific network is available
 */
export function useNetworkAvailable(network: SupportedNetwork) {
  return useMemo(() => {
    const contracts = ERC8004_CONTRACTS[network];
    return {
      hasIdentityRegistry: contracts.IDENTITY_REGISTRY !== null,
      hasReputationRegistry: contracts.REPUTATION_REGISTRY !== null,
      hasValidationRegistry: contracts.VALIDATION_REGISTRY !== null,
      isFullyDeployed:
        contracts.IDENTITY_REGISTRY !== null &&
        contracts.REPUTATION_REGISTRY !== null &&
        contracts.VALIDATION_REGISTRY !== null,
    };
  }, [network]);
}

// ============================================================================
// Exports
// ============================================================================

export { CHAIN_ID_TO_NETWORK, NETWORK_TO_CHAIN_ID };
export type { NetworkContextValue, NetworkProviderProps };

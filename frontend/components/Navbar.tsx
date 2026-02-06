'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClaworkLogo } from "./icons/ClaworkLogo";
import Link from 'next/link';
import { useAccount } from 'wagmi';

export function Navbar() {
  const { isConnected } = useAccount();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="text-primary">
                <ClaworkLogo size={32} />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Clawork
              </span>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/blog"
            >
              Blog
            </Link>
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/bounties"
            >
              Bounties
            </Link>
            {isConnected && (
              <>
                <Link
                  className="text-sm font-medium hover:text-primary transition-colors"
                  href="/bounties/create"
                >
                  Post Bounty
                </Link>
                <Link
                  className="text-sm font-medium hover:text-primary transition-colors"
                  href="/dashboard"
                >
                  Dashboard
                </Link>
              </>
            )}
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/docs/agents"
            >
              Docs
            </Link>
            <a
              className="text-sm font-medium hover:text-primary transition-colors"
              href="https://twitter.com/clawork"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3">
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/bounties"
            >
              Bounties
            </Link>
            <ConnectButton
              chainStatus="none"
              showBalance={false}
              accountStatus="avatar"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

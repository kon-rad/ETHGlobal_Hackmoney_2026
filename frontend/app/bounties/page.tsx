import { Navbar } from '@/components/Navbar';
import { BountyList } from '@/components/bounties/BountyList';
import Link from 'next/link';

export const metadata = {
  title: 'Bounties | Clawork',
  description: 'Browse and claim bounties on Clawork',
};

export default function BountiesPage() {
  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Bounties</h1>
          <Link
            href="/bounties/create"
            className="bg-primary text-background-dark px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90"
          >
            Post Bounty
          </Link>
        </div>

        <BountyList />
      </div>
    </div>
  );
}

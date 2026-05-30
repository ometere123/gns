"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { DashboardNameCard } from "@/components/DashboardNameCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { getNamesByOwner, resolveName } from "@/lib/gns/contract";
import type { GnsName } from "@/lib/types";

export default function DashboardPage() {
  const { address } = useWallet();
  const [names, setNames] = useState<GnsName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await getNamesByOwner(address);
        const resolved = await Promise.all(list.map((n) => resolveName(n).catch(() => null)));
        if (!cancelled) setNames(resolved.filter((n): n is GnsName => Boolean(n)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Sign in with an injected wallet to view your .gen names."
        action={<ConnectWalletButton />}
      />
    );
  }

  const roots = names.filter((n) => !n.is_subname);
  const subs = names.filter((n) => n.is_subname);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Your dashboard</h1>
          <p className="mt-1 text-sm text-muted">All .gen names owned by your connected wallet.</p>
        </div>
        <Link href="/search">
          <Button>Search for a Name</Button>
        </Link>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && names.length === 0 && (
        <EmptyState
          title="You do not own any .gen names yet."
          action={
            <Link href="/search">
              <Button>Search for a Name</Button>
            </Link>
          }
        />
      )}

      {roots.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Names</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {roots.map((n) => (
              <DashboardNameCard key={n.full_name} name={n} />
            ))}
          </div>
        </section>
      )}
      {subs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Subnames</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {subs.map((n) => (
              <DashboardNameCard key={n.full_name} name={n} />
            ))}
          </div>
        </section>
      )}

      {names.length > 0 && (
        <Card padding="lg" className="bg-section">
          <h3 className="font-semibold text-ink">Records & disputes</h3>
          <p className="mt-1 text-sm text-muted">Manage records on each name, or open the disputes page to report suspicious names.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/disputes"><Button variant="secondary">Disputes</Button></Link>
            <Link href="/resolve"><Button variant="ghost">Resolver</Button></Link>
          </div>
        </Card>
      )}
    </div>
  );
}

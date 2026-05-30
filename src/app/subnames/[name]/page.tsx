"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SubnameCreator } from "@/components/SubnameCreator";
import { LoadingState, ErrorState } from "@/components/States";
import { getSubnames, resolveName } from "@/lib/gns/contract";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { normaliseName } from "@/lib/utils";
import type { GnsName } from "@/lib/types";

const USE_CASES = [
  { label: "pay.you.gen", desc: "Payment address" },
  { label: "agent.you.gen", desc: "AI agent identity" },
  { label: "game.you.gen", desc: "Gaming profile" },
  { label: "dao.you.gen", desc: "Community identity" },
];

export default function SubnamesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const parent = normaliseName(decodeURIComponent(name));
  const { address } = useWallet();
  const [data, setData] = useState<GnsName | null>(null);
  const [subs, setSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, s] = await Promise.all([resolveName(parent), getSubnames(parent)]);
      setData(n);
      setSubs(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <ErrorState message={`${parent} is not registered.`} />;

  const isOwner = Boolean(address && data.owner.toLowerCase() === address.toLowerCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">
          Subnames of <span className="text-primary">{parent}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Parent owner: only the parent owner can create subnames.
        </p>
      </div>

      {isOwner ? (
        <SubnameCreator parentName={parent} onCreated={() => load()} />
      ) : (
        <Card>
          <p className="text-sm text-muted">Connect the parent owner wallet to create subnames.</p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Existing subnames</h2>
        {subs.length === 0 ? (
          <Card className="text-sm text-muted">No subnames yet.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subs.map((s) => (
              <Link key={s} href={`/name/${encodeURIComponent(s)}`}>
                <Card className="hover:border-primary">
                  <p className="font-semibold text-primary">{s}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Common use cases</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <Card key={u.label}>
              <p className="font-mono text-sm text-primary">{u.label}</p>
              <p className="mt-1 text-xs text-muted">{u.desc}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

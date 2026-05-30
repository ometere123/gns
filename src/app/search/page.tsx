"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { NameSearchBar } from "@/components/NameSearchBar";
import { NameStatusCard } from "@/components/NameStatusCard";
import { LoadingState, ErrorState } from "@/components/States";
import { Card } from "@/components/ui/Card";
import { searchName, aiSuggestNames } from "@/lib/gns/contract";
import { generateNameSuggestions, normaliseName, stripGenSuffix } from "@/lib/utils";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/Badge";
import type { SearchResult, AiSuggestion } from "@/lib/types";

function SearchInner() {
  const params = useSearchParams();
  const raw = params.get("name") || "";
  const fullName = normaliseName(raw);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { address, connect } = useWallet();

  useEffect(() => {
    if (!raw) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchName(raw)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  const runAiSuggest = async () => {
    if (!address) {
      await connect();
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const suggestions = await aiSuggestNames(
        stripGenSuffix(raw),
        "Find safe, brandable .gen alternatives for this label."
      );
      setAiSuggestions(suggestions);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI suggestion failed.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <NameSearchBar defaultValue={stripGenSuffix(raw)} size="md" />

      {!raw && (
        <Card className="text-muted">Enter a name above to check availability.</Card>
      )}

      {loading && <LoadingState message={`Checking ${fullName}…`} />}
      {error && <ErrorState message={error} />}
      {result && !loading && !error && <NameStatusCard result={result} />}

      {raw && (
        <section>
          <h3 className="text-lg font-semibold text-ink">Suggested alternatives</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {generateNameSuggestions(raw).map((s) => (
              <Link key={s} href={`/search?name=${encodeURIComponent(s.replace(".gen", ""))}`}>
                <Card className="hover:border-primary hover:bg-softblue/40">
                  <p className="font-semibold text-ink">{s}</p>
                  <p className="mt-1 text-xs text-muted">Click to check availability</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {raw && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">AI suggestions</h3>
                <Badge tone="blue">beta</Badge>
              </div>
              <p className="text-xs text-muted">
                AI-assisted, not official. Generated on-chain via GenLayer Equivalence Principle.
              </p>
            </div>
            <Button onClick={runAiSuggest} loading={aiBusy} size="sm">
              {address ? "Generate AI suggestions" : "Connect to generate"}
            </Button>
          </div>
          {aiError && (
            <Card className="mt-3 border-red-200 bg-red-50/30 text-sm text-red-700">
              {aiError}
            </Card>
          )}
          {aiSuggestions.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aiSuggestions.map((s) => (
                <Link key={s.name} href={`/search?name=${encodeURIComponent(s.name.replace(".gen", ""))}`}>
                  <Card className="hover:border-primary hover:bg-softblue/40">
                    <p className="font-semibold text-primary">{s.name}</p>
                    <p className="mt-1 text-xs text-muted">{s.reason}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SearchInner />
    </Suspense>
  );
}

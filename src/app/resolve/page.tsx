"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AddressText } from "@/components/AddressText";
import { RecordList } from "@/components/RecordList";
import { LoadingState, ErrorState } from "@/components/States";
import { resolveName, reverseLookup } from "@/lib/gns/contract";
import type { GnsName } from "@/lib/types";

function isAddressLike(v: string) {
  return /^0x[0-9a-fA-F]{4,}$/.test(v.trim());
}

function ResolveInner() {
  const params = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<GnsName | null>(null);
  const [primaryName, setPrimaryName] = useState<string>("");

  useEffect(() => {
    if (!submitted) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setName(null);
    setPrimaryName("");
    (async () => {
      try {
        if (isAddressLike(submitted)) {
          const n = await reverseLookup(submitted);
          if (cancelled) return;
          setPrimaryName(n);
          if (n) {
            const resolved = await resolveName(n);
            if (!cancelled) setName(resolved);
          }
        } else {
          const resolved = await resolveName(submitted);
          if (!cancelled) setName(resolved);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Resolver</h1>
        <p className="mt-1 text-sm text-muted">Look up a .gen name or wallet address.</p>
      </div>

      <Card padding="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter name or address"
          />
          <Button type="submit">Resolve</Button>
        </form>
      </Card>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && submitted && (
        <>
          {isAddressLike(submitted) ? (
            <Card padding="lg">
              <p className="text-sm text-muted">Address</p>
              <AddressText value={submitted} />
              <p className="mt-4 text-sm text-muted">resolves to</p>
              {primaryName ? (
                <Link href={`/name/${encodeURIComponent(primaryName)}`} className="text-xl font-semibold text-primary">
                  {primaryName}
                </Link>
              ) : (
                <p className="text-sm text-ink">No primary .gen name set.</p>
              )}
            </Card>
          ) : name ? (
            <Card padding="lg">
              <p className="text-sm text-muted">Name</p>
              <p className="text-xl font-semibold text-primary">{name.full_name}</p>
              <p className="mt-4 text-sm text-muted">resolves to</p>
              <AddressText value={name.primary_address} />
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">No record found for {submitted}.</p>
            </Card>
          )}

          {name?.records && (
            <section>
              <h3 className="mb-3 text-lg font-semibold text-ink">All records</h3>
              <RecordList records={name.records} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function ResolvePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResolveInner />
    </Suspense>
  );
}

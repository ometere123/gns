"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { RecordList } from "@/components/RecordList";
import { AddressText } from "@/components/AddressText";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { AuthenticityStatusCard } from "@/components/AuthenticityStatusCard";
import { SoulStampVerification } from "@/components/SoulStampVerification";
import { resolveName, getSubnames } from "@/lib/gns/contract";
import { formatExpiry, normaliseName } from "@/lib/utils";
import type { GnsName } from "@/lib/types";

export default function NamePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const fullName = normaliseName(decodeURIComponent(name));
  const [data, setData] = useState<GnsName | null>(null);
  const [subnames, setSubnames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveName(fullName)
      .then(async (n) => {
        if (cancelled) return;
        setData(n);
        if (n && !n.is_subname) {
          try {
            const subs = await getSubnames(fullName);
            if (!cancelled) setSubnames(subs);
          } catch {
            /* ignore */
          }
        }
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
  }, [fullName]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) {
    return (
      <EmptyState
        title={`${fullName} is not registered`}
        description="Be the first to claim this name. Registration creates namespace ownership, not identity verification."
        action={
          <Link href={`/register/${encodeURIComponent(fullName.replace(".gen", ""))}`}>
            <Button>Register Name</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.status === "flagged" ? "red" : data.status === "expired" ? "amber" : "green"}>
                {data.status === "active" ? "Registered" : data.status}
              </Badge>
              {data.is_subname && (
                <Badge tone="grey">
                  Subname of{" "}
                  <Link href={`/name/${encodeURIComponent(data.parent)}`} className="ml-1 underline">
                    {data.parent}
                  </Link>
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-4xl font-semibold text-ink">{data.full_name}</h1>
            <p className="mt-2 text-sm text-muted">
              Registry ownership is shown here separately from authenticity status below.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href={`/manage/${encodeURIComponent(data.full_name)}`}>
              <Button>Manage</Button>
            </Link>
            <Link href={`/disputes?name=${encodeURIComponent(data.full_name)}`}>
              <Button variant="ghost">Challenge / Report</Button>
            </Link>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="Registry owner" v={<AddressText value={data.owner} />} />
          <Row k="Primary Address" v={<AddressText value={data.primary_address} />} />
          <Row k="Created" v={formatExpiry(data.created_at)} />
          <Row k="Expires" v={formatExpiry(data.expires_at)} />
          <Row k="Records" v={String(Object.values(data.records || {}).filter(Boolean).length)} />
        </dl>
      </Card>

      <AuthenticityStatusCard fullName={data.full_name} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Registry records</h2>
        <RecordList records={data.records || {}} />
      </section>

      <SoulStampVerification owner={data.owner} records={data.records || {}} />

      {!data.is_subname && subnames.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Subnames</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {subnames.map((s) => (
              <Link key={s} href={`/name/${encodeURIComponent(s)}`}>
                <Card className="hover:border-primary">
                  <p className="font-semibold text-primary">{s}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

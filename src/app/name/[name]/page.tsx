"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { RecordList } from "@/components/RecordList";
import { AddressText } from "@/components/AddressText";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { resolveName, getSubnames, aiReviewName, getAiReview } from "@/lib/gns/contract";
import { formatExpiry, normaliseName } from "@/lib/utils";
import { AiResultCard } from "@/components/AiResultCard";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useWallet } from "@/lib/wallet/WalletProvider";
import type { GnsName, AiReview } from "@/lib/types";

export default function NamePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const fullName = normaliseName(decodeURIComponent(name));
  const [data, setData] = useState<GnsName | null>(null);
  const [subnames, setSubnames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [extra, setExtra] = useState("");
  const { address, connect } = useWallet();

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

  useEffect(() => {
    const rid = data?.ai_status?.last_review_id;
    if (!rid) {
      setAiReview(null);
      return;
    }
    let cancelled = false;
    getAiReview(rid)
      .then((r) => {
        if (!cancelled) setAiReview(r);
      })
      .catch(() => {
        if (!cancelled) setAiReview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.ai_status?.last_review_id]);

  const runAiReview = async () => {
    if (!address) {
      await connect();
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const review = await aiReviewName(fullName, claim, evidence, extra);
      setAiReview(review);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI review failed.");
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data)
    return (
      <EmptyState
        title={`${fullName} is not registered`}
        description="Be the first to claim this name."
        action={
          <Link href={`/register/${encodeURIComponent(fullName.replace(".gen", ""))}`}>
            <Button>Register Name</Button>
          </Link>
        }
      />
    );

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={data.status === "flagged" ? "red" : data.status === "expired" ? "amber" : "green"}>
                {data.status}
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
          </div>
          <div className="flex flex-col gap-2">
            <Link href={`/manage/${encodeURIComponent(data.full_name)}`}>
              <Button>Manage</Button>
            </Link>
            <Link href={`/disputes?name=${encodeURIComponent(data.full_name)}`}>
              <Button variant="ghost">Report</Button>
            </Link>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="Owner" v={<AddressText value={data.owner} />} />
          <Row k="Primary Address" v={<AddressText value={data.primary_address} />} />
          <Row k="Created" v={formatExpiry(data.created_at)} />
          <Row k="Expires" v={formatExpiry(data.expires_at)} />
          <Row k="Records" v={String(Object.values(data.records || {}).filter(Boolean).length)} />
          {data.ai_status && (
            <Row k="AI Risk" v={data.ai_status.risk} />
          )}
        </dl>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Records</h2>
        <RecordList records={data.records || {}} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">AI-assisted review</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAiOpen((v) => !v)}>
              {aiOpen ? "Hide" : "Run AI Review"}
            </Button>
          </div>
        </div>
        {aiReview && <AiResultCard result={aiReview.result} title={`Review #${aiReview.id}`} />}
        {aiOpen && (
          <Card padding="lg" className="space-y-3">
            <p className="text-xs text-muted">
              Submit an AI review for this name. AI-assisted, not official endorsement.
            </p>
            <Input
              label="Claim"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="e.g. This name represents the official Project X account."
            />
            <Input
              label="Evidence URL"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="https://…"
            />
            <Textarea
              label="Extra context"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Anything else the reviewer should know."
            />
            <div className="flex items-center gap-3">
              <Button onClick={runAiReview} loading={aiBusy}>Run AI Review</Button>
              {aiError && <span className="text-sm text-red-600">{aiError}</span>}
            </div>
          </Card>
        )}
      </section>

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

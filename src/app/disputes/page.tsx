"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { ReportForm } from "@/components/ReportForm";
import { LoadingState } from "@/components/States";
import { AddressText } from "@/components/AddressText";
import { AiResultCard } from "@/components/AiResultCard";
import { getReport, getTotalReports, aiReviewReport, getAiReview } from "@/lib/gns/contract";
import { formatExpiry } from "@/lib/utils";
import { useWallet } from "@/lib/wallet/WalletProvider";
import type { GnsReport, AiResult } from "@/lib/types";

function statusTone(s: GnsReport["status"]): "blue" | "green" | "amber" | "red" | "grey" {
  switch (s) {
    case "open":
      return "blue";
    case "reviewed":
      return "grey";
    case "flagged":
      return "red";
    case "dismissed":
      return "amber";
    default:
      return "grey";
  }
}

function ReportCard({ report, onUpdated }: { report: GnsReport; onUpdated: (r: GnsReport) => void }) {
  const { address, connect } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  useEffect(() => {
    if (!report.ai_review_id) return;
    let cancelled = false;
    getAiReview(report.ai_review_id)
      .then((r) => {
        if (!cancelled && r) setResult(r.result);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [report.ai_review_id]);

  const run = async () => {
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const review = await aiReviewReport(report.id);
      if (review) {
        setResult(review.result);
        const fresh = await getReport(report.id);
        if (fresh) onUpdated(fresh);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI review failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-primary">{report.name}</p>
        <Badge tone={statusTone(report.status)}>{report.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink">{report.reason}</p>
      {report.comment && <p className="mt-1 text-sm text-muted">{report.comment}</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>by <AddressText value={report.reporter} showCopy={false} /></span>
        <span>{formatExpiry(report.created_at)}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={run} loading={busy}>
          {result ? "Re-run AI review" : "Run AI Report Review"}
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {result && (
        <div className="mt-3">
          <AiResultCard result={result} title={`Report #${report.id}`} />
        </div>
      )}
    </Card>
  );
}

function DisputesInner() {
  const params = useSearchParams();
  const defaultName = params.get("name") || "";
  const [reports, setReports] = useState<GnsReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const total = await getTotalReports();
        const start = Math.max(1, total - 9);
        const ids: string[] = [];
        for (let i = total; i >= start; i--) ids.push(String(i));
        const list = await Promise.all(ids.map((id) => getReport(id).catch(() => null)));
        if (!cancelled) setReports(list.filter((r): r is GnsReport => Boolean(r)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Report a suspicious name</h1>
          <p className="mt-1 text-sm text-muted">
            Reports are stored on the GNS contract. AI review will be added later.
          </p>
        </div>
        <ReportForm defaultName={defaultName} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Recent reports</h2>
        {loading ? (
          <LoadingState />
        ) : reports.length === 0 ? (
          <Card className="text-sm text-muted">No reports yet.</Card>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onUpdated={(updated) =>
                  setReports((list) => list.map((x) => (x.id === updated.id ? updated : x)))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DisputesInner />
    </Suspense>
  );
}

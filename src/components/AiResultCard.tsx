import type { AiResult } from "@/lib/types";
import { Card } from "./ui/Card";
import { Badge } from "./Badge";

const RISK_TONE: Record<string, "green" | "blue" | "amber" | "red" | "grey"> = {
  low: "green",
  unreviewed: "grey",
  medium: "amber",
  high: "red",
  critical: "red",
};

export function AiResultCard({ result, title }: { result: AiResult; title?: string }) {
  const tone = RISK_TONE[result.risk] || "grey";
  return (
    <Card padding="lg" className="border-primary/20 bg-softblue/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="blue">AI-assisted · beta</Badge>
          <Badge tone={tone}>Risk: {result.risk}</Badge>
          {result.verified ? (
            <Badge tone="green">Verified</Badge>
          ) : (
            <Badge tone="grey">Unverified</Badge>
          )}
        </div>
        <p className="text-xs text-muted">{title}</p>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">Verdict</p>
      <p className="text-base font-semibold text-ink">{result.verdict}</p>
      {result.summary && (
        <>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Summary</p>
          <p className="text-sm text-ink">{result.summary}</p>
        </>
      )}
      {result.reasons?.length > 0 && (
        <>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Reasons</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {(result.recommended_action || result.recommended_report_status) && (
        <>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Recommended</p>
          <p className="text-sm text-ink">
            {result.recommended_action || result.recommended_report_status}
          </p>
        </>
      )}
      <p className="mt-4 text-xs text-muted">
        AI-assisted review, not official endorsement.
      </p>
    </Card>
  );
}

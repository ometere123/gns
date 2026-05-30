"use client";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Card } from "./ui/Card";
import { reportName } from "@/lib/gns/contract";

const REASONS = [
  "Impersonation",
  "Scam risk",
  "Fake support",
  "Brand misuse",
  "Phishing",
  "Name squatting",
];

export function ReportForm({ defaultName = "" }: { defaultName?: string }) {
  const [name, setName] = useState(defaultName);
  const [reason, setReason] = useState(REASONS[0]);
  const [evidence, setEvidence] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setMessage("Enter a name.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await reportName(name, reason, evidence, comment);
      setMessage(res.message || "Report submitted.");
      setComment("");
      setEvidence("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="example.gen"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 w-full rounded-lg border border-borderGrey bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <Input
          label="Evidence URL"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="https://…"
        />
        <Textarea
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add additional context."
        />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy}>Submit Report</Button>
          {message && <span className="text-sm text-muted">{message}</span>}
        </div>
      </form>
    </Card>
  );
}

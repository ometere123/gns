"use client";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Badge } from "./Badge";
import { AiResultCard } from "./AiResultCard";
import { aiVerifyProjectClaim } from "@/lib/gns/contract";
import type { AiReview } from "@/lib/types";

export function VerifyProjectClaim({
  fullName,
  disabled,
}: {
  fullName: string;
  disabled?: boolean;
}) {
  const [projectName, setProjectName] = useState("");
  const [website, setWebsite] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [github, setGithub] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<AiReview | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await aiVerifyProjectClaim(
        fullName,
        projectName,
        website,
        xHandle,
        github,
        explanation
      );
      setReview(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-ink">Verify Project Claim</h3>
        <Badge tone="blue">AI-assisted · beta</Badge>
      </div>
      <p className="text-xs text-muted">
        Submit official project details and let the GenLayer AI layer assess the claim.
        AI-assisted review, not official endorsement.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="BountyLens"
        />
        <Input
          label="Official Website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://…"
        />
        <Input
          label="Official X Handle"
          value={xHandle}
          onChange={(e) => setXHandle(e.target.value)}
          placeholder="@project"
        />
        <Input
          label="Official GitHub"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="https://github.com/…"
        />
        <Textarea
          label="Explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain the relationship between this name and the project."
        />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy} disabled={disabled}>
            Run AI verification
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
      {review && <AiResultCard result={review.result} title={`Review #${review.id}`} />}
    </Card>
  );
}

"use client";
import { useState } from "react";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { setRecords, setPrimaryAddress } from "@/lib/gns/contract";
import type { GnsRecords } from "@/lib/types";

type Props = {
  fullName: string;
  initialRecords: GnsRecords;
  initialPrimaryAddress: string;
  isOwner: boolean;
};

export function RecordEditor({ fullName, initialRecords, initialPrimaryAddress, isOwner }: Props) {
  const [primary, setPrimary] = useState(initialPrimaryAddress);
  const [records, setRecordsState] = useState<GnsRecords>(initialRecords || {});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const update = (key: keyof GnsRecords, value: string) =>
    setRecordsState((r) => ({ ...r, [key]: value }));

  const reset = () => {
    setRecordsState(initialRecords || {});
    setPrimary(initialPrimaryAddress);
    setStatus(null);
  };

  const save = async () => {
    if (!isOwner) {
      setStatus("Only the name owner can save changes.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      if (primary && primary.toLowerCase() !== initialPrimaryAddress.toLowerCase()) {
        await setPrimaryAddress(fullName, primary);
      }
      await setRecords(fullName, records);
      setStatus("Records saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save records.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg" className="space-y-5">
      {!isOwner && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Read-only view. Connect the owner wallet to edit.
        </p>
      )}
      <Input
        label="Primary Wallet Address"
        name="primary"
        value={primary}
        onChange={(e) => setPrimary(e.target.value)}
        placeholder="0x…"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Avatar URL" name="avatar" value={records.avatar || ""} onChange={(e) => update("avatar", e.target.value)} placeholder="https://…" />
        <Input label="Website" name="website" value={records.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://…" />
        <Input label="X Handle" name="x" value={records.x || ""} onChange={(e) => update("x", e.target.value)} placeholder="@handle" />
        <Input label="GitHub" name="github" value={records.github || ""} onChange={(e) => update("github", e.target.value)} placeholder="https://github.com/…" />
        <Input label="Discord" name="discord" value={records.discord || ""} onChange={(e) => update("discord", e.target.value)} placeholder="handle#0000" />
        <Input label="Email" name="email" value={records.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
        <Input label="Contract Address" name="contract" value={records.contract || ""} onChange={(e) => update("contract", e.target.value)} placeholder="0x…" />
        <Input label="Agent Endpoint" name="agent" value={records.agent || ""} onChange={(e) => update("agent", e.target.value)} placeholder="https://agent.example.com" />
      </div>
      <Textarea
        label="Project Description"
        name="description"
        value={records.description || ""}
        onChange={(e) => update("description", e.target.value)}
        placeholder="A short description of this name or project."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!isOwner}>Save Records</Button>
        <Button variant="secondary" onClick={reset} type="button">Reset</Button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </Card>
  );
}

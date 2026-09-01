"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RecordEditor } from "@/components/RecordEditor";
import { ArcPaymentFlow } from "@/components/ArcPaymentFlow";
import { LoadingState, ErrorState } from "@/components/States";
import { AuthenticityClaimPanel } from "@/components/AuthenticityClaimPanel";
import { SoulStampVerification } from "@/components/SoulStampVerification";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { resolveName, renewName, transferName, setPrimaryName, createRenewalIntent, getRenewalIntent } from "@/lib/gns/contract";
import { normaliseName, formatExpiry } from "@/lib/utils";
import type { GnsName } from "@/lib/types";

export default function ManagePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const fullName = normaliseName(decodeURIComponent(name));
  const { address } = useWallet();
  const [data, setData] = useState<GnsName | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState(1);
  const [newOwner, setNewOwner] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renewalIntent, setRenewalIntent] = useState<{ hash: string; expiresAt: number } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    resolveName(fullName)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [fullName]);

  const isExpired = data?.status === "expired";
  const isSubname = Boolean(data?.is_subname);
  const isOwner = Boolean(address && data && data.owner.toLowerCase() === address.toLowerCase());
  const isActiveOwner = Boolean(isOwner && !isExpired);

  const onTransfer = async () => {
    if (!newOwner) {
      setMessage("Enter a new owner address.");
      return;
    }
    setBusy("transfer");
    setMessage(null);
    try {
      const res = await transferName(fullName, newOwner);
      setMessage(res.message);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setBusy(null);
    }
  };

  const onPrimary = async () => {
    setBusy("primary");
    setMessage(null);
    try {
      const res = await setPrimaryName(fullName);
      setMessage(res.message);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  };

  const prepareRenewal = async () => {
    setBusy("intent"); setMessage(null);
    try {
      const result = await createRenewalIntent(fullName, years);
      const data = result.data as { intent_hash?: string } | undefined;
      if (!data?.intent_hash) throw new Error("Renewal intent was not returned.");
      const current = await getRenewalIntent(fullName);
      if (!current) throw new Error("Finalized renewal intent could not be read back.");
      setRenewalIntent({ hash: current.intent_hash, expiresAt: current.expires_at });
      setMessage(result.message);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not prepare renewal."); }
    finally { setBusy(null); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <ErrorState message={`${fullName} is not registered.`} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink">
            Manage <span className="text-primary">{data.full_name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Expires {formatExpiry(data.expires_at)}</p>
        </div>
        <Link href={`/name/${encodeURIComponent(data.full_name)}`}>
          <Button variant="secondary">View Public Profile</Button>
        </Link>
      </div>

      <RecordEditor
        fullName={data.full_name}
        initialRecords={data.records || {}}
        initialPrimaryAddress={data.primary_address}
        isOwner={isActiveOwner}
      />

      <AuthenticityClaimPanel
        fullName={data.full_name}
        owner={data.owner}
        records={data.records || {}}
        isOwner={isActiveOwner}
      />

      <SoulStampVerification owner={data.owner} records={data.records || {}} />

      {isExpired ? (
        <Card padding="lg" className="space-y-4">
          <h3 className="font-semibold text-ink">This namespace has expired</h3>
          <p className="text-sm text-muted">
            This namespace has expired and is available for registration. Historical ownership is read-only.
          </p>
          <Link href={`/register/${encodeURIComponent(data.full_name)}`}>
            <Button>Register {data.full_name}</Button>
          </Link>
        </Card>
      ) : isSubname ? (
        <Card padding="lg" className="space-y-4">
          <h3 className="font-semibold text-ink">Subname expiry</h3>
          <p className="text-sm text-muted">
            Subname expiry follows the parent namespace and cannot be renewed separately.
          </p>
        </Card>
      ) : (
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">Renew with Arc USDC</h3>
            <p className="mt-1 text-xs text-muted">
              The Arc payment receipt is verified and consumed by GenLayer before the expiry changes.
            </p>
          </div>
          <select
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="h-11 rounded-lg border border-borderGrey bg-white px-3 text-sm"
            disabled={!isActiveOwner}
          >
            {[1, 2, 3, 5].map((y) => (
              <option key={y} value={y}>{y} year{y > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>

        <ArcPaymentFlow
          action="renew"
          fullName={fullName}
          years={years}
          intentHash={renewalIntent?.hash}
          intentExpiresAt={renewalIntent?.expiresAt}
          disabled={!isActiveOwner || !renewalIntent}
          onFinalize={(receipt) => renewName(fullName, years, receipt.txHash, receipt.logIndex)}
          onSuccess={load}
        />
        {isActiveOwner && !renewalIntent && <Button size="sm" onClick={prepareRenewal} loading={busy === "intent"}>Prepare renewal intent</Button>}
        {!isActiveOwner && <p className="text-xs text-muted">Only the current active namespace owner can renew this name.</p>}
      </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <h3 className="font-semibold text-ink">Transfer</h3>
          <p className="mt-1 text-xs text-muted">Send namespace ownership to another GenLayer address.</p>
          <div className="mt-3 space-y-2">
            <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="0x…" />
            <Button size="sm" onClick={onTransfer} loading={busy === "transfer"} disabled={!isActiveOwner}>Transfer</Button>
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="font-semibold text-ink">Set as Primary</h3>
          <p className="mt-1 text-xs text-muted">Reverse-resolve your wallet to this namespace.</p>
          <div className="mt-3">
            <Button size="sm" onClick={onPrimary} loading={busy === "primary"} disabled={!isActiveOwner}>Set Primary Name</Button>
          </div>
        </Card>
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

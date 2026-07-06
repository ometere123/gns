"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RecordEditor } from "@/components/RecordEditor";
import { LoadingState, ErrorState } from "@/components/States";
import { VerifyProjectClaim } from "@/components/VerifyProjectClaim";
import { SoulStampVerification } from "@/components/SoulStampVerification";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { resolveName, renewName, transferName, setPrimaryName, quoteRenewal, weiToGen } from "@/lib/gns/contract";
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
  const [renewQuote, setRenewQuote] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    quoteRenewal(years)
      .then((v) => {
        if (!cancelled) setRenewQuote(v);
      })
      .catch(() => {
        if (!cancelled) setRenewQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [years]);

  const load = () => {
    setLoading(true);
    setError(null);
    resolveName(fullName)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [fullName]);

  const isOwner = Boolean(address && data && data.owner.toLowerCase() === address.toLowerCase());

  const onRenew = async () => {
    setBusy("renew");
    setMessage(null);
    try {
      const res = await renewName(fullName, years);
      setMessage(res.message);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Renew failed.");
    } finally {
      setBusy(null);
    }
  };

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

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <ErrorState message={`${fullName} is not registered.`} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Manage <span className="text-primary">{data.full_name}</span></h1>
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
        isOwner={isOwner}
      />

      <SoulStampVerification owner={data.owner} records={data.records || {}} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="lg">
          <h3 className="font-semibold text-ink">Renew</h3>
          <p className="mt-1 text-xs text-muted">
            Paid renewal. Renewal price:{" "}
            <b>{renewQuote !== null ? `${weiToGen(renewQuote)} GEN` : "Loading…"}</b>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="h-11 rounded-lg border border-borderGrey bg-white px-3 text-sm"
            >
              {[1, 2, 3, 5].map((y) => (
                <option key={y} value={y}>{y}y</option>
              ))}
            </select>
            <Button size="sm" onClick={onRenew} loading={busy === "renew"} disabled={!isOwner}>
              {renewQuote !== null ? `Renew for ${weiToGen(renewQuote)} GEN` : "Renew"}
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="font-semibold text-ink">Transfer</h3>
          <p className="mt-1 text-xs text-muted">Send ownership to another address.</p>
          <div className="mt-3 space-y-2">
            <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="0x…" />
            <Button size="sm" onClick={onTransfer} loading={busy === "transfer"} disabled={!isOwner}>Transfer</Button>
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="font-semibold text-ink">Set as Primary</h3>
          <p className="mt-1 text-xs text-muted">Reverse-resolve your wallet to this name.</p>
          <div className="mt-3">
            <Button size="sm" onClick={onPrimary} loading={busy === "primary"} disabled={!isOwner}>Set Primary Name</Button>
          </div>
        </Card>
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}

      <VerifyProjectClaim fullName={data.full_name} disabled={!isOwner} />
    </div>
  );
}

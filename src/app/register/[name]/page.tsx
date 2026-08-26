"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/Badge";
import { ArcPaymentFlow } from "@/components/ArcPaymentFlow";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { isAvailable, registerName } from "@/lib/gns/contract";
import { isValidLabel, normaliseName, stripGenSuffix } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { ErrorState, LoadingState } from "@/components/States";
import type { ArcPaymentReceipt } from "@/lib/arc/client";

const DURATIONS = [1, 2, 3, 5];

export default function RegisterPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);
  const label = stripGenSuffix(decoded);
  const fullName = normaliseName(label);
  const { address } = useWallet();

  const [years, setYears] = useState(1);
  const [primary, setPrimary] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (address && !primary) setPrimary(address);
  }, [address, primary]);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    isAvailable(fullName)
      .then((value) => !cancelled && setAvailable(value))
      .catch(() => !cancelled && setAvailable(null))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [fullName]);

  if (!isValidLabel(label)) return <ErrorState message="Invalid name label." />;

  if (registered) {
    return (
      <Card padding="lg" className="mx-auto max-w-3xl bg-softblue/40">
        <Badge>Registered</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{fullName} is yours.</h1>
        <p className="mt-2 text-sm text-muted">
          The Arc USDC receipt was independently verified and consumed by the finalized GenLayer registration transaction.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/manage/${encodeURIComponent(fullName)}`}><Button>Set Records</Button></Link>
          <Link href={`/name/${encodeURIComponent(fullName)}`}><Button variant="secondary">View Profile</Button></Link>
          <Link href={`/subnames/${encodeURIComponent(fullName)}`}><Button variant="ghost">Create Subname</Button></Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge>Register</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Register <span className="text-primary">{fullName}</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pay in USDC on Arc, then let GenLayer validators verify and consume that payment receipt before the name is created.
        </p>
      </div>

      {checking ? (
        <LoadingState message="Checking availability…" />
      ) : available === false ? (
        <Card>
          <p className="text-sm text-ink"><span className="font-semibold">{fullName}</span> is not available.</p>
          <Link href={`/name/${encodeURIComponent(fullName)}`} className="mt-3 inline-block text-sm text-primary hover:underline">
            View its public profile →
          </Link>
        </Card>
      ) : (
        <Card padding="lg" className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Step 1 · Namespace</p>
            <p className="mt-1 text-lg font-semibold text-ink">{fullName}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Step 2 · Duration</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setYears(duration)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    years === duration
                      ? "border-primary bg-softblue text-primary"
                      : "border-borderGrey bg-white text-ink hover:bg-section"
                  }`}
                >
                  {duration} year{duration > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Step 3 · Primary address</p>
            <div className="mt-2">
              <Input value={primary} onChange={(event) => setPrimary(event.target.value)} placeholder="0x…" />
            </div>
          </div>

          {!address ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">Connect the wallet that will own this namespace.</p>
              <ConnectWalletButton />
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Step 4 · Pay and finalize</p>
              <ArcPaymentFlow
                action="register"
                fullName={fullName}
                years={years}
                disabled={!/^0x[0-9a-fA-F]{40}$/.test(primary)}
                onFinalize={(receipt: ArcPaymentReceipt) =>
                  registerName(fullName, years, primary || address, receipt.txHash, receipt.logIndex)
                }
                onSuccess={() => setRegistered(true)}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/Badge";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { isAvailable, registerName, quoteRegistration, weiToGen } from "@/lib/gns/contract";
import { isValidLabel, normaliseName, stripGenSuffix } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { ErrorState, LoadingState } from "@/components/States";

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
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [quoteWei, setQuoteWei] = useState<bigint | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (address && !primary) setPrimary(address);
  }, [address, primary]);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    isAvailable(fullName)
      .then((v) => {
        if (!cancelled) setAvailable(v);
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fullName]);

  useEffect(() => {
    let cancelled = false;
    setQuoteError(null);
    quoteRegistration(years)
      .then((v) => {
        if (!cancelled) setQuoteWei(v);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuoteWei(null);
          setQuoteError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [years]);

  const onRegister = async () => {
    if (!address) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await registerName(label, years, primary || address);
      setStatus({ ok: res.success, message: res.message });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : "Registration failed." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValidLabel(label)) {
    return <ErrorState message="Invalid name label." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge>Register</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Register <span className="text-primary">{fullName}</span>
        </h1>
      </div>

      {checking ? (
        <LoadingState message="Checking availability…" />
      ) : available === false ? (
        <Card>
          <p className="text-sm text-ink">
            <span className="font-semibold">{fullName}</span> is not available.
          </p>
          <Link href={`/name/${encodeURIComponent(fullName)}`} className="mt-3 inline-block text-sm text-primary hover:underline">
            View its public profile →
          </Link>
        </Card>
      ) : (
        <>
          <Card padding="lg" className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Step 1: Name</p>
              <p className="mt-1 text-lg font-semibold text-ink">{fullName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Step 2: Duration</p>
              <div className="mt-2 flex gap-2">
                {DURATIONS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYears(y)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      years === y
                        ? "border-primary bg-softblue text-primary"
                        : "border-borderGrey bg-white text-ink hover:bg-section"
                    }`}
                  >
                    {y} year{y > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Step 3: Primary Address</p>
              <div className="mt-2">
                <Input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  placeholder="0x…"
                />
              </div>
            </div>
            <div className="rounded-xl bg-section p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">Step 4: Summary</p>
              <ul className="mt-2 space-y-1 text-ink">
                <li>Name: <b>{fullName}</b></li>
                <li>Duration: <b>{years} year{years > 1 ? "s" : ""}</b></li>
                <li>Resolver: <b>Default GNS Resolver</b></li>
                <li>
                  Registration price:{" "}
                  <b>
                    {quoteWei !== null
                      ? `${weiToGen(quoteWei)} GEN`
                      : quoteError
                      ? "Price unavailable"
                      : "Loading…"}
                  </b>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted">
                Paid registration. Fees go to the GNS contract and can be withdrawn by the protocol admin to the treasury.
              </p>
            </div>
            {!address ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted">Connect a wallet to continue.</p>
                <ConnectWalletButton />
              </div>
            ) : (
              <Button onClick={onRegister} loading={submitting} size="lg" disabled={quoteWei === null}>
                {quoteWei !== null
                  ? `Register for ${weiToGen(quoteWei)} GEN`
                  : "Register"}
              </Button>
            )}
            {status && (
              <p className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
                {status.message}
              </p>
            )}
          </Card>

          {status?.ok && (
            <Card padding="lg" className="bg-softblue/40">
              <h3 className="text-xl font-semibold text-ink">{fullName} is yours.</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/manage/${encodeURIComponent(fullName)}`}>
                  <Button>Set Records</Button>
                </Link>
                <Link href={`/name/${encodeURIComponent(fullName)}`}>
                  <Button variant="secondary">View Profile</Button>
                </Link>
                <Link href={`/subnames/${encodeURIComponent(fullName)}`}>
                  <Button variant="ghost">Create Subname</Button>
                </Link>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

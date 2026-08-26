"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/Badge";
import { ArcPaymentFlow } from "@/components/ArcPaymentFlow";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  cancelRegistrationReservation,
  getRegistrationReservation,
  isAvailable,
  registerName,
  reserveRegistration,
  type RegistrationReservation,
} from "@/lib/gns/contract";
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
  const { address, switchToGenLayer } = useWallet();

  const [years, setYears] = useState(1);
  const [primary, setPrimary] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [reservation, setReservation] = useState<RegistrationReservation | null>(null);
  const [reservationBusy, setReservationBusy] = useState<"reserve" | "cancel" | null>(null);
  const [reservationMessage, setReservationMessage] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (address && !primary) setPrimary(address);
  }, [address, primary]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const loadAvailability = useCallback(async () => {
    setChecking(true);
    try {
      setAvailable(await isAvailable(fullName));
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, [fullName]);

  const loadReservation = useCallback(async () => {
    try {
      setReservation(await getRegistrationReservation(fullName));
      setClock(Date.now());
    } catch {
      setReservation(null);
    }
  }, [fullName]);

  useEffect(() => {
    void loadAvailability();
    void loadReservation();
  }, [loadAvailability, loadReservation]);

  const primaryValid = /^0x[0-9a-fA-F]{40}$/.test(primary);
  const reservationActive = Boolean(
    reservation && reservation.expires_at * 1000 > clock
  );
  const reservationMine = Boolean(
    reservationActive &&
      reservation &&
      address &&
      reservation.reserver.toLowerCase() === address.toLowerCase()
  );
  const reservationMatches = Boolean(
    reservationMine &&
      reservation &&
      reservation.years === years &&
      reservation.primary_address.toLowerCase() === primary.toLowerCase()
  );
  const reservedByOther = Boolean(reservationActive && reservation && address && !reservationMine);

  const reservationExpiry = useMemo(() => {
    if (!reservation?.expires_at) return "";
    return new Date(reservation.expires_at * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [reservation]);

  const onReserve = async () => {
    if (!address || !primaryValid) return;
    setReservationBusy("reserve");
    setReservationMessage(null);
    try {
      await switchToGenLayer();
      const result = await reserveRegistration(fullName, years, primary);
      setReservationMessage(result.message);
      await loadReservation();
    } catch (error) {
      setReservationMessage(
        error instanceof Error ? error.message : "Could not reserve this registration."
      );
    } finally {
      setReservationBusy(null);
    }
  };

  const onCancelReservation = async () => {
    if (!address) return;
    setReservationBusy("cancel");
    setReservationMessage(null);
    try {
      await switchToGenLayer();
      const result = await cancelRegistrationReservation(fullName);
      setReservationMessage(result.message);
      await loadReservation();
    } catch (error) {
      setReservationMessage(
        error instanceof Error ? error.message : "Could not cancel the reservation."
      );
    } finally {
      setReservationBusy(null);
    }
  };

  if (!isValidLabel(label)) return <ErrorState message="Invalid name label." />;

  if (registered) {
    return (
      <Card padding="lg" className="mx-auto max-w-3xl bg-softblue/40">
        <Badge>Registered</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{fullName} is yours.</h1>
        <p className="mt-2 text-sm text-muted">
          The name now exists in the GenLayer registry. Its Arc USDC payment receipt was
          independently verified and consumed by the finalized registration transaction.
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
          The namespace stays on GenLayer. Reserve it there first, pay USDC on Arc,
          then finalize back on GenLayer after validators verify the Arc receipt.
        </p>
      </div>

      {checking ? (
        <LoadingState message="Checking availability…" />
      ) : available === false ? (
        <Card>
          <p className="text-sm text-ink"><span className="font-semibold">{fullName}</span> is already registered.</p>
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
            <>
              <div className="rounded-xl border border-borderGrey bg-section p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Step 4 · Reserve on GenLayer</p>
                {reservedByOther ? (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-ink">Temporarily reserved by another wallet</p>
                    <p className="mt-1 text-xs text-muted">
                      No Arc payment should be made for this name while that reservation is active
                      {reservationExpiry ? ` (until about ${reservationExpiry})` : ""}.
                    </p>
                  </div>
                ) : reservationMatches ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Reservation finalized on GenLayer</p>
                      <p className="mt-1 text-xs text-muted">
                        Bound to this wallet, {years} year{years > 1 ? "s" : ""}, and {primary}.
                        {reservationExpiry ? ` Expires about ${reservationExpiry}.` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelReservation}
                      loading={reservationBusy === "cancel"}
                    >
                      Cancel reservation
                    </Button>
                  </div>
                ) : reservationMine ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-muted">
                      Your active reservation uses different terms. Cancel it before reserving
                      the new duration or primary address.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onCancelReservation}
                      loading={reservationBusy === "cancel"}
                    >
                      Cancel old reservation
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-xl text-sm text-muted">
                      This short reservation prevents another wallet from taking the name after
                      you pay on Arc but before GenLayer finalization.
                    </p>
                    <Button
                      size="sm"
                      onClick={onReserve}
                      loading={reservationBusy === "reserve"}
                      disabled={!primaryValid}
                    >
                      Reserve {fullName}
                    </Button>
                  </div>
                )}
                {reservationMessage && <p className="mt-2 text-xs text-muted">{reservationMessage}</p>}
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Step 5 · Pay on Arc and finalize</p>
                <ArcPaymentFlow
                  action="register"
                  fullName={fullName}
                  years={years}
                  disabled={!primaryValid || !reservationMatches}
                  onFinalize={(receipt: ArcPaymentReceipt) =>
                    registerName(fullName, years, primary || address, receipt.txHash, receipt.logIndex)
                  }
                  onSuccess={() => setRegistered(true)}
                />
                {!reservationMatches && !reservedByOther && (
                  <p className="mt-2 text-xs text-muted">
                    Arc payment stays disabled until a matching, unexpired GenLayer reservation is finalized.
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

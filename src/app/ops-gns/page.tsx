"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/Badge";
import { AddressText } from "@/components/AddressText";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { EmptyState, LoadingState } from "@/components/States";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  acceptRegistryAdmin,
  adminCancelAdminTransfer,
  adminProposeAdmin,
  adminSetRegistrationsPaused,
  getAdmin,
  getArcPaymentConfig,
  getPendingAdmin,
  getTotalNames,
  getTotalPaymentsConsumed,
} from "@/lib/gns/contract";
import {
  arcAcceptAdmin,
  arcAcceptTreasury,
  arcCancelAdminTransfer,
  arcCancelTreasuryTransfer,
  arcProposeAdmin,
  arcProposeTreasury,
  arcSetPaused,
  arcSetPrices,
  arcWithdraw,
  arcWithdrawAll,
  formatUsdc,
  readArcRouterOverview,
  usdcToBaseUnits,
  type ArcRouterOverview,
} from "@/lib/arc/client";

type RegistryOverview = {
  admin: string;
  pendingAdmin: string;
  paused: boolean;
  router: string;
  totalNames: number;
  paymentsConsumed: number;
};

const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

export default function OpsGnsPage() {
  const { address, switchToGenLayer } = useWallet();
  const [registry, setRegistry] = useState<RegistryOverview | null>(null);
  const [arc, setArc] = useState<ArcRouterOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [registryAdminInput, setRegistryAdminInput] = useState("");
  const [arcAdminInput, setArcAdminInput] = useState("");
  const [treasuryInput, setTreasuryInput] = useState("");
  const [registrationPrice, setRegistrationPrice] = useState("");
  const [renewalPrice, setRenewalPrice] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [admin, pendingAdmin, config, names, consumed, arcOverview] = await Promise.all([
        getAdmin(),
        getPendingAdmin(),
        getArcPaymentConfig(),
        getTotalNames(),
        getTotalPaymentsConsumed(),
        readArcRouterOverview(),
      ]);
      setRegistry({
        admin,
        pendingAdmin,
        paused: config.registrations_paused,
        router: config.router,
        totalNames: names,
        paymentsConsumed: consumed,
      });
      setArc(arcOverview);
      setRegistrationPrice(formatUsdc(arcOverview.registrationPricePerYear));
      setRenewalPrice(formatUsdc(arcOverview.renewalPricePerYear));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Protocol overview unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage("Transaction finalized successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setBusy(null);
    }
  };

  const runRegistry = (key: string, fn: () => Promise<unknown>) =>
    run(key, async () => {
      await switchToGenLayer();
      return fn();
    });

  if (!address) {
    return (
      <EmptyState
        title="Protocol operations"
        description="Connect a protocol admin or treasury wallet to use operational controls."
        action={<ConnectWalletButton />}
      />
    );
  }

  if (loading && (!registry || !arc)) return <LoadingState message="Loading GenLayer and Arc protocol state…" />;
  if (!registry || !arc) return <EmptyState title="Configuration unavailable" description={message || "Could not load protocol state."} />;

  const isRegistryAdmin = same(address, registry.admin);
  const isPendingRegistryAdmin = same(address, registry.pendingAdmin);
  const isArcAdmin = same(address, arc.admin);
  const isPendingArcAdmin = same(address, arc.pendingAdmin);
  const isTreasury = same(address, arc.treasury);
  const isPendingTreasury = same(address, arc.pendingTreasury);
  const hasRole = isRegistryAdmin || isPendingRegistryAdmin || isArcAdmin || isPendingArcAdmin || isTreasury || isPendingTreasury;

  if (!hasRole) {
    return (
      <EmptyState
        title="Access denied"
        description="The connected wallet is not the current or pending GenLayer admin, Arc admin, or Arc treasury. Contract-level permissions remain the source of truth."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="amber">Protocol operations</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">GNS controls</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Namespace administration stays on GenLayer. USDC pricing, custody and withdrawals stay on Arc. Admin and treasury are separate roles and both use two-step handover.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">GenLayer registry</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Namespace control</h2>
            </div>
            <Badge tone={registry.paused ? "amber" : "green"}>{registry.paused ? "Paused" : "Active"}</Badge>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Admin"><AddressText value={registry.admin} /></Row>
            <Row label="Pending admin"><AddressText value={registry.pendingAdmin || "0x0000000000000000000000000000000000000000"} /></Row>
            <Row label="Arc router"><AddressText value={registry.router} /></Row>
            <Row label="Names">{registry.totalNames}</Row>
            <Row label="Arc receipts consumed">{registry.paymentsConsumed}</Row>
          </dl>
        </Card>

        <Card padding="lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Arc payment router</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">USDC treasury</h2>
            </div>
            <Badge tone={arc.paused ? "amber" : "green"}>{arc.paused ? "Paused" : "Active"}</Badge>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Admin"><AddressText value={arc.admin} /></Row>
            <Row label="Treasury"><AddressText value={arc.treasury} /></Row>
            <Row label="Registration / year">{formatUsdc(arc.registrationPricePerYear)} USDC</Row>
            <Row label="Renewal / year">{formatUsdc(arc.renewalPricePerYear)} USDC</Row>
            <Row label="Router balance">{formatUsdc(arc.treasuryBalance)} USDC</Row>
            <Row label="Total collected">{formatUsdc(arc.totalCollected)} USDC</Row>
            <Row label="Total withdrawn">{formatUsdc(arc.totalWithdrawn)} USDC</Row>
          </dl>
        </Card>
      </div>

      {(isRegistryAdmin || isPendingRegistryAdmin) && (
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="font-semibold text-ink">GenLayer registry administration</h2>
            <p className="mt-1 text-xs text-muted">These controls cannot withdraw USDC or manufacture authenticity verdicts.</p>
          </div>

          {isRegistryAdmin && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Registration pause</p>
                <Button
                  onClick={() => runRegistry("registry-pause", () => adminSetRegistrationsPaused(!registry.paused))}
                  loading={busy === "registry-pause"}
                >
                  {registry.paused ? "Resume registrations" : "Pause registrations"}
                </Button>
              </div>
              <div className="space-y-2">
                <Input label="Propose new GenLayer admin" value={registryAdminInput} onChange={(e) => setRegistryAdminInput(e.target.value)} placeholder="0x…" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => runRegistry("registry-admin", () => adminProposeAdmin(registryAdminInput))}
                    loading={busy === "registry-admin"}
                    disabled={!registryAdminInput}
                  >
                    Propose admin
                  </Button>
                  {registry.pendingAdmin && (
                    <Button variant="ghost" onClick={() => runRegistry("registry-cancel", adminCancelAdminTransfer)} loading={busy === "registry-cancel"}>
                      Cancel proposal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isPendingRegistryAdmin && (
            <Button onClick={() => runRegistry("registry-accept", acceptRegistryAdmin)} loading={busy === "registry-accept"}>
              Accept GenLayer admin role
            </Button>
          )}
        </Card>
      )}

      {(isArcAdmin || isPendingArcAdmin) && (
        <Card padding="lg" className="space-y-5">
          <div>
            <h2 className="font-semibold text-ink">Arc router administration</h2>
            <p className="mt-1 text-xs text-muted">Pricing and payment collection live here, independently from namespace ownership and authenticity judgment.</p>
          </div>

          {isArcAdmin && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Input label="Registration price / year (USDC)" value={registrationPrice} onChange={(e) => setRegistrationPrice(e.target.value)} />
                <Input label="Renewal price / year (USDC)" value={renewalPrice} onChange={(e) => setRenewalPrice(e.target.value)} />
                <Button
                  onClick={() => run("arc-price", () => arcSetPrices(address, usdcToBaseUnits(registrationPrice), usdcToBaseUnits(renewalPrice)))}
                  loading={busy === "arc-price"}
                >
                  Update Arc prices
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Payment collection</p>
                <Button onClick={() => run("arc-pause", () => arcSetPaused(address, !arc.paused))} loading={busy === "arc-pause"}>
                  {arc.paused ? "Resume Arc payments" : "Pause Arc payments"}
                </Button>
              </div>

              <div className="space-y-2">
                <Input label="Propose new Arc admin" value={arcAdminInput} onChange={(e) => setArcAdminInput(e.target.value)} placeholder="0x…" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => run("arc-admin", () => arcProposeAdmin(address, arcAdminInput))} loading={busy === "arc-admin"} disabled={!arcAdminInput}>
                    Propose admin
                  </Button>
                  {arc.pendingAdmin !== "0x0000000000000000000000000000000000000000" && (
                    <Button variant="ghost" onClick={() => run("arc-admin-cancel", () => arcCancelAdminTransfer(address))} loading={busy === "arc-admin-cancel"}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Input label="Propose new treasury" value={treasuryInput} onChange={(e) => setTreasuryInput(e.target.value)} placeholder="0x…" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => run("arc-treasury", () => arcProposeTreasury(address, treasuryInput))} loading={busy === "arc-treasury"} disabled={!treasuryInput}>
                    Propose treasury
                  </Button>
                  {arc.pendingTreasury !== "0x0000000000000000000000000000000000000000" && (
                    <Button variant="ghost" onClick={() => run("arc-treasury-cancel", () => arcCancelTreasuryTransfer(address))} loading={busy === "arc-treasury-cancel"}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isPendingArcAdmin && (
            <Button onClick={() => run("arc-admin-accept", () => arcAcceptAdmin(address))} loading={busy === "arc-admin-accept"}>
              Accept Arc admin role
            </Button>
          )}
        </Card>
      )}

      {(isTreasury || isPendingTreasury) && (
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="font-semibold text-ink">Arc treasury</h2>
            <p className="mt-1 text-xs text-muted">Only the configured treasury can withdraw collected USDC.</p>
          </div>

          {isPendingTreasury && !isTreasury && (
            <Button onClick={() => run("treasury-accept", () => arcAcceptTreasury(address))} loading={busy === "treasury-accept"}>
              Accept treasury role
            </Button>
          )}

          {isTreasury && (
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
              <Input label="Withdraw amount (USDC)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="100" />
              <Button onClick={() => run("withdraw", () => arcWithdraw(address, usdcToBaseUnits(withdrawAmount)))} loading={busy === "withdraw"} disabled={!withdrawAmount}>
                Withdraw
              </Button>
              <Button variant="secondary" onClick={() => run("withdraw-all", () => arcWithdrawAll(address))} loading={busy === "withdraw-all"} disabled={arc.treasuryBalance === 0n}>
                Withdraw all
              </Button>
            </div>
          )}
        </Card>
      )}

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borderGrey/70 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

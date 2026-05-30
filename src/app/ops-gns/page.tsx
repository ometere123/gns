"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/Badge";
import { AddressText } from "@/components/AddressText";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { EmptyState, LoadingState } from "@/components/States";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  adminFlagName,
  adminUnflagName,
  adminSetReportStatus,
  adminTransferAdmin,
  adminWithdraw,
  adminSetPricePerYear,
  adminSetTreasury,
  getAdmin,
  getTreasury,
  getPricePerYear,
  getContractBalance,
  getTotalProtocolRevenue,
  getTotalWithdrawn,
  getTotalNames,
  getTotalReports,
  weiToGen,
  genToWei,
} from "@/lib/gns/contract";

const STATUSES = ["open", "reviewed", "flagged", "dismissed"];

type Overview = {
  admin: string;
  treasury: string;
  pricePerYearWei: bigint;
  balanceWei: bigint;
  revenueWei: bigint;
  withdrawnWei: bigint;
  totalNames: number;
  totalReports: number;
};

export default function OpsGnsPage() {
  const { address } = useWallet();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  // forms
  const [priceGen, setPriceGen] = useState("");
  const [treasuryInput, setTreasuryInput] = useState("");
  const [withdrawGen, setWithdrawGen] = useState("");
  const [flagName, setFlagName] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [unflag, setUnflag] = useState("");
  const [reportId, setReportId] = useState("");
  const [reportStatus, setReportStatus] = useState(STATUSES[1]);
  const [newAdmin, setNewAdmin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [admin, treasury, ppy, bal, rev, wd, names, reports] = await Promise.all([
        getAdmin(),
        getTreasury(),
        getPricePerYear(),
        getContractBalance(),
        getTotalProtocolRevenue(),
        getTotalWithdrawn(),
        getTotalNames(),
        getTotalReports(),
      ]);
      setOverview({
        admin,
        treasury,
        pricePerYearWei: ppy,
        balanceWei: bal,
        revenueWei: rev,
        withdrawnWei: wd,
        totalNames: names,
        totalReports: reports,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!address) {
    return (
      <EmptyState
        title="Admin only"
        description="Connect the admin wallet to view protocol controls."
        action={<ConnectWalletButton />}
      />
    );
  }

  if (loading || !overview) return <LoadingState message="Loading protocol overview…" />;

  const isAdmin = overview.admin && address.toLowerCase() === overview.admin.toLowerCase();

  if (!isAdmin) {
    return (
      <EmptyState
        title="Access denied"
        description={`Connected wallet does not match the on-chain admin (${overview.admin}). Contract writes will reject anyway.`}
      />
    );
  }

  const wrap = async (key: string, fn: () => Promise<{ message: string }>) => {
    setBusy(key);
    setMessage(null);
    try {
      const r = await fn();
      setMessage(r.message);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="amber">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Protocol controls</h1>
        <p className="mt-1 text-sm text-muted">
          Registration fees are paid to the GNS contract and can be withdrawn by the
          protocol admin to the treasury address.
        </p>
      </div>

      <Card padding="lg">
        <h2 className="font-semibold text-ink">Protocol overview</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="Admin"><AddressText value={overview.admin} /></Row>
          <Row k="Treasury"><AddressText value={overview.treasury} /></Row>
          <Row k="Price per year">{weiToGen(overview.pricePerYearWei)} GEN</Row>
          <Row k="Contract balance">{weiToGen(overview.balanceWei)} GEN</Row>
          <Row k="Total protocol revenue">{weiToGen(overview.revenueWei)} GEN</Row>
          <Row k="Total withdrawn">{weiToGen(overview.withdrawnWei)} GEN</Row>
          <Row k="Total names">{overview.totalNames}</Row>
          <Row k="Total reports">{overview.totalReports}</Row>
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Set price per year</h2>
          <p className="text-xs text-muted">Current: {weiToGen(overview.pricePerYearWei)} GEN</p>
          <Input
            label="New price (GEN)"
            value={priceGen}
            onChange={(e) => setPriceGen(e.target.value)}
            placeholder="5"
          />
          <Button
            onClick={() => wrap("price", () => adminSetPricePerYear(genToWei(priceGen)))}
            loading={busy === "price"}
            disabled={!priceGen}
          >
            Update price
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Set treasury</h2>
          <p className="text-xs text-muted">All withdrawals go to this address.</p>
          <Input
            label="Treasury address"
            value={treasuryInput}
            onChange={(e) => setTreasuryInput(e.target.value)}
            placeholder="0x…"
          />
          <Button
            onClick={() => wrap("treasury", () => adminSetTreasury(treasuryInput))}
            loading={busy === "treasury"}
            disabled={!treasuryInput}
          >
            Update treasury
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Withdraw</h2>
          <p className="text-xs text-muted">
            Available: {weiToGen(overview.balanceWei)} GEN. Funds are sent to the treasury address.
          </p>
          <Input
            label="Amount (GEN)"
            value={withdrawGen}
            onChange={(e) => setWithdrawGen(e.target.value)}
            placeholder="1"
          />
          <Button
            onClick={() => wrap("withdraw", () => adminWithdraw(genToWei(withdrawGen)))}
            loading={busy === "withdraw"}
            disabled={!withdrawGen}
          >
            Withdraw to treasury
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Transfer admin</h2>
          <Input
            label="New admin address"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="0x…"
          />
          <Button
            variant="danger"
            onClick={() => wrap("xfer", () => adminTransferAdmin(newAdmin))}
            loading={busy === "xfer"}
            disabled={!newAdmin}
          >
            Transfer admin
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Flag a name</h2>
          <Input
            label="Name"
            value={flagName}
            onChange={(e) => setFlagName(e.target.value.toLowerCase())}
            placeholder="example.gen"
          />
          <Textarea
            label="Reason"
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Why this name is being flagged."
          />
          <Button
            onClick={() => wrap("flag", () => adminFlagName(flagName, flagReason))}
            loading={busy === "flag"}
            disabled={!flagName}
          >
            Flag name
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Unflag a name</h2>
          <Input
            label="Name"
            value={unflag}
            onChange={(e) => setUnflag(e.target.value.toLowerCase())}
            placeholder="example.gen"
          />
          <Button
            onClick={() => wrap("unflag", () => adminUnflagName(unflag))}
            loading={busy === "unflag"}
            disabled={!unflag}
          >
            Unflag name
          </Button>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-ink">Set report status</h2>
          <Input
            label="Report ID"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="1"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className="h-11 w-full rounded-lg border border-borderGrey bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => wrap("status", () => adminSetReportStatus(reportId, reportStatus))}
            loading={busy === "status"}
            disabled={!reportId}
          >
            Update status
          </Button>
        </Card>
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

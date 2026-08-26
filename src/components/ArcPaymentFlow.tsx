"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/lib/wallet/WalletProvider";
import {
  ARC_PAYMENT_ROUTER_ADDRESS,
  arcExplorerTx,
  formatUsdc,
  payArcRegistration,
  payArcRenewal,
  quoteArcRegistration,
  quoteArcRenewal,
  type ArcPaymentReceipt,
} from "@/lib/arc/client";

type StoredReceipt = Omit<ArcPaymentReceipt, "amount"> & { amount: string };

type Props = {
  action: "register" | "renew";
  fullName: string;
  years: number;
  disabled?: boolean;
  onFinalize: (receipt: ArcPaymentReceipt) => Promise<{ success: boolean; message: string }>;
  onSuccess?: () => void;
};

function storageKey(action: string, name: string, years: number, address: string | null): string {
  return `gns:arc-payment:${action}:${name.toLowerCase()}:${years}:${(address || "").toLowerCase()}`;
}

function fromStored(raw: StoredReceipt): ArcPaymentReceipt {
  return { ...raw, amount: BigInt(raw.amount) };
}

function toStored(receipt: ArcPaymentReceipt): StoredReceipt {
  return { ...receipt, amount: receipt.amount.toString() };
}

export function ArcPaymentFlow({ action, fullName, years, disabled, onFinalize, onSuccess }: Props) {
  const { address, switchToGenLayer } = useWallet();
  const [quote, setQuote] = useState<bigint | null>(null);
  const [receipt, setReceipt] = useState<ArcPaymentReceipt | null>(null);
  const [busy, setBusy] = useState<"pay" | "finalize" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const key = useMemo(() => storageKey(action, fullName, years, address), [action, fullName, years, address]);

  useEffect(() => {
    let cancelled = false;
    const quoteFn = action === "register" ? quoteArcRegistration : quoteArcRenewal;
    quoteFn(years)
      .then((value) => !cancelled && setQuote(value))
      .catch((error) => {
        if (!cancelled) {
          setQuote(null);
          setMessage({ ok: false, text: error instanceof Error ? error.message : "Arc quote unavailable." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [action, years]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setReceipt(null);
      return;
    }
    try {
      setReceipt(fromStored(JSON.parse(raw) as StoredReceipt));
    } catch {
      window.localStorage.removeItem(key);
      setReceipt(null);
    }
  }, [key]);

  const pay = async () => {
    if (!address) return;
    if (!ARC_PAYMENT_ROUTER_ADDRESS) {
      setMessage({ ok: false, text: "Arc payment router is not configured." });
      return;
    }
    setBusy("pay");
    setMessage(null);
    try {
      const result = action === "register"
        ? await payArcRegistration(address, fullName, years)
        : await payArcRenewal(address, fullName, years);
      if (result.payer.toLowerCase() !== address.toLowerCase()) throw new Error("Arc receipt payer does not match connected wallet.");
      if (result.years !== years) throw new Error("Arc receipt duration does not match this request.");
      setReceipt(result);
      window.localStorage.setItem(key, JSON.stringify(toStored(result)));
      setMessage({ ok: true, text: "Arc USDC payment finalized. Complete the GenLayer step to consume this receipt." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Arc payment failed." });
    } finally {
      setBusy(null);
    }
  };

  const finalize = async () => {
    if (!receipt) return;
    setBusy("finalize");
    setMessage(null);
    try {
      await switchToGenLayer();
      const result = await onFinalize(receipt);
      setMessage({ ok: result.success, text: result.message });
      if (result.success) {
        window.localStorage.removeItem(key);
        setReceipt(null);
        onSuccess?.();
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "GenLayer finalization failed." });
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
    setReceipt(null);
    setMessage(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-borderGrey bg-section p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Arc USDC payment</p>
            <p className="mt-1 font-semibold text-ink">
              {quote !== null ? `${formatUsdc(quote)} USDC` : "Loading price…"}
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-muted">Gas is paid in USDC on Arc</span>
        </div>
        <p className="mt-2 text-xs text-muted">
          GNS never trusts the browser as proof of payment. GenLayer validators independently verify the finalized Arc router receipt before changing namespace state.
        </p>
      </div>

      {!receipt ? (
        <Button
          onClick={pay}
          loading={busy === "pay"}
          disabled={disabled || !address || quote === null || busy !== null}
          size="lg"
        >
          {quote !== null ? `Pay ${formatUsdc(quote)} USDC on Arc` : "Pay on Arc"}
        </Button>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Arc payment finalized</p>
          <p className="mt-1 break-all text-xs text-emerald-800">{receipt.txHash}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={finalize} loading={busy === "finalize"} disabled={busy !== null}>
              Finalize on GenLayer
            </Button>
            <a
              href={arcExplorerTx(receipt.txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-900"
            >
              View Arc transaction
            </a>
            <button type="button" onClick={clear} className="px-2 text-xs text-muted hover:text-ink">
              Forget local receipt
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  );
}

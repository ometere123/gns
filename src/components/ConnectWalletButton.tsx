"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet, EXPECTED_CHAIN_ID } from "@/lib/wallet/WalletProvider";
import { truncateAddress } from "@/lib/utils";
import { Button } from "./ui/Button";

const EXPLORER = (process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com/").replace(/\/$/, "");

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { address, chainId, connect, disconnect, connecting, switchToGenLayer } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!address) {
    return (
      <Button onClick={connect} loading={connecting} size={compact ? "sm" : "md"}>
        Connect Wallet
      </Button>
    );
  }

  const wrongNetwork = chainId !== null && chainId !== EXPECTED_CHAIN_ID;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-section dark:bg-white/5 dark:hover:bg-white/10 ${
          wrongNetwork
            ? "border-red-300 text-red-700"
            : "border-borderGrey text-ink dark:border-white/10 dark:text-white"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${wrongNetwork ? "bg-red-500" : "bg-emerald-500"}`} />
        {wrongNetwork ? (
          <span>Wrong network</span>
        ) : (
          <span className="font-mono">{truncateAddress(address)}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-borderGrey bg-white p-1 shadow-lg dark:border-white/10 dark:bg-ink dark:shadow-black/40">
          <div className="px-3 pt-3 pb-2">
            <p className="text-xs uppercase tracking-wide text-muted">Connected</p>
            <p className="mt-1 break-all font-mono text-sm text-ink">{address}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${wrongNetwork ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className={wrongNetwork ? "text-red-700" : "text-muted"}>
                {wrongNetwork
                  ? `Wrong network (chain ${chainId}). Expected ${EXPECTED_CHAIN_ID}.`
                  : `GenLayer Studionet · chain ${chainId}`}
              </span>
            </div>
          </div>
          <div className="my-1 h-px bg-borderGrey" />
          {wrongNetwork && (
            <MenuItem onClick={() => { setOpen(false); switchToGenLayer(); }}>
              Switch to GenLayer Studionet
            </MenuItem>
          )}
          <MenuItem onClick={copy}>{copied ? "Copied!" : "Copy address"}</MenuItem>
          <MenuItem
            onClick={() => {
              window.open(`${EXPLORER}/address/${address}`, "_blank", "noreferrer");
              setOpen(false);
            }}
          >
            View on explorer ↗
          </MenuItem>
          <div className="my-1 h-px bg-borderGrey" />
          <MenuItem
            destructive
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-section dark:hover:bg-white/5 ${
        destructive ? "text-red-600" : "text-ink dark:text-white"
      }`}
    >
      {children}
    </button>
  );
}

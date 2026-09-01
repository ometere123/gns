"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ARC_CHAIN_HEX, ARC_EXPLORER_URL, ARC_RPC_URL } from "@/lib/arc/client";

type WalletState = {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  hasInjected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToGenLayer: () => Promise<void>;
  switchToArc: () => Promise<void>;
};

export const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "61999");

const WalletContext = createContext<WalletState | null>(null);

type EthLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (args: unknown) => void) => void;
  removeListener?: (event: string, handler: (args: unknown) => void) => void;
};

function getEthereum(): EthLike | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthLike }).ethereum || null;
}

function parseChainId(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    try {
      return Number(BigInt(trimmed));
    } catch {
      return null;
    }
  }
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasInjected, setHasInjected] = useState(false);

  useEffect(() => {
    const eth = getEthereum();
    setHasInjected(Boolean(eth));
    if (!eth) return;

    const saved = window.localStorage.getItem("gns:address");
    if (saved) setAddress(saved);

    eth.request({ method: "eth_chainId" })
      .then((cid) => setChainId(parseChainId(cid)))
      .catch(() => {});

    const accountsHandler = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      const next = list[0] || null;
      setAddress(next);
      if (next) window.localStorage.setItem("gns:address", next);
      else window.localStorage.removeItem("gns:address");
    };
    const chainHandler = (cid: unknown) => setChainId(parseChainId(cid));

    eth.on?.("accountsChanged", accountsHandler as (args: unknown) => void);
    eth.on?.("chainChanged", chainHandler as (args: unknown) => void);
    return () => {
      eth.removeListener?.("accountsChanged", accountsHandler as (args: unknown) => void);
      eth.removeListener?.("chainChanged", chainHandler as (args: unknown) => void);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      alert("No injected wallet detected. Install a wallet like MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts?.[0] || null;
      setAddress(next);
      if (next) window.localStorage.setItem("gns:address", next);
      const cid = await eth.request({ method: "eth_chainId" });
      setChainId(parseChainId(cid));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    window.localStorage.removeItem("gns:address");
  }, []);

  const switchToGenLayer = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) throw new Error("No injected wallet detected.");
    const hex = `0x${EXPECTED_CHAIN_ID.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (err) {
      if ((err as { code?: number })?.code !== 4902) throw err;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: "GenLayer Studionet",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api"],
            blockExplorerUrls: [process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com/"],
          },
        ],
      });
    }
  }, []);

  const switchToArc = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) throw new Error("No injected wallet detected.");
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_HEX }] });
    } catch (err) {
      if ((err as { code?: number })?.code !== 4902) throw err;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_CHAIN_HEX,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC_RPC_URL],
            blockExplorerUrls: [ARC_EXPLORER_URL],
          },
        ],
      });
    }
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      connecting,
      hasInjected,
      connect,
      disconnect,
      switchToGenLayer,
      switchToArc,
    }),
    [address, chainId, connecting, hasInjected, connect, disconnect, switchToGenLayer, switchToArc]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

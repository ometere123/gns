"use client";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { isValidSubLabel } from "@/lib/utils";
import { createSubname } from "@/lib/gns/contract";
import { useWallet } from "@/lib/wallet/WalletProvider";

export function SubnameCreator({
  parentName,
  onCreated,
}: {
  parentName: string;
  onCreated?: (sub: string) => void;
}) {
  const { address } = useWallet();
  const [sub, setSub] = useState("");
  const [primary, setPrimary] = useState(address || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!isValidSubLabel(sub)) {
      setMessage("Invalid subname label.");
      return;
    }
    if (!primary) {
      setMessage("Primary address required.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await createSubname(parentName, sub, primary);
      setMessage(res.message || "Subname created.");
      onCreated?.(`${sub}.${parentName}`);
      setSub("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create subname.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <h3 className="text-lg font-semibold text-ink">Create a subname</h3>
      <p className="mt-1 text-sm text-muted">
        Subnames live beneath your name and inherit its expiry.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex w-full overflow-hidden rounded-lg border border-borderGrey">
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value.toLowerCase())}
            placeholder="pay"
            className="h-11 w-full px-4 text-sm focus:outline-none"
          />
          <span className="flex items-center pr-3 text-sm text-muted">.{parentName}</span>
        </div>
      </div>
      <div className="mt-3">
        <Input
          label="Primary Address"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          placeholder="0x…"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} loading={busy}>Create Subname</Button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </Card>
  );
}

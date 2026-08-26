"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "./ui/Card";
import { Badge } from "./Badge";
import { Button } from "./ui/Button";
import { AddressText } from "./AddressText";
import { formatExpiry } from "@/lib/utils";
import { formatUsdc, quoteArcRegistration } from "@/lib/arc/client";
import type { SearchResult } from "@/lib/types";

export function NameStatusCard({ result }: { result: SearchResult }) {
  const { fullName, available, name } = result;
  const [priceLine, setPriceLine] = useState<string>("Loading Arc USDC price…");

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    quoteArcRegistration(1)
      .then((amount) => {
        if (!cancelled) setPriceLine(`Registration price: ${formatUsdc(amount)} USDC / year on Arc`);
      })
      .catch(() => {
        if (!cancelled) setPriceLine("Arc registration price unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [available]);

  if (available) {
    return (
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="green">Available</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-ink">
              <span className="text-primary">{fullName}</span> is available
            </h2>
            <p className="mt-1 text-sm text-muted">{priceLine}</p>
            <p className="mt-1 text-xs text-muted">
              Ownership is created on GenLayer. Arc is only the USDC payment rail.
            </p>
          </div>
          <Link href={`/register/${encodeURIComponent(fullName.replace(".gen", ""))}`}>
            <Button size="lg">Reserve & Register</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge tone={name?.status === "flagged" ? "red" : "blue"}>
            {name?.status?.toUpperCase() || "REGISTERED"}
          </Badge>
          <h2 className="mt-3 text-3xl font-semibold text-ink">
            <span className="text-primary">{fullName}</span> is already registered
          </h2>
          {name && (
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Owner</dt>
                <dd><AddressText value={name.owner} /></dd>
              </div>
              <div>
                <dt className="text-muted">Primary Address</dt>
                <dd><AddressText value={name.primary_address} /></dd>
              </div>
              <div>
                <dt className="text-muted">Expires</dt>
                <dd className="text-ink">{formatExpiry(name.expires_at)}</dd>
              </div>
              <div>
                <dt className="text-muted">Records</dt>
                <dd className="text-ink">
                  {Object.values(name.records || {}).filter(Boolean).length}
                </dd>
              </div>
            </dl>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/name/${encodeURIComponent(fullName)}`}>
            <Button variant="primary">View Profile</Button>
          </Link>
          <Link href={`/resolve?q=${encodeURIComponent(fullName)}`}>
            <Button variant="secondary">Resolve Address</Button>
          </Link>
          <Link href={`/disputes?name=${encodeURIComponent(fullName)}`}>
            <Button variant="ghost">Challenge Authenticity</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

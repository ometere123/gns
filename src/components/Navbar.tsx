"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/resolve", label: "Resolve" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/disputes", label: "Disputes" },
  { href: "/about", label: "Docs" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-borderGrey bg-white/90 backdrop-blur dark:border-white/10 dark:bg-ink/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="/gns-logo.png"
            alt="GNS"
            width={120}
            height={40}
            priority
            className="h-10 w-auto object-contain"
          />
          <span className="hidden md:block text-sm font-semibold text-ink dark:text-white tracking-tight">
            GenLayer Naming Service
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-section hover:text-primary dark:text-white/90 dark:hover:bg-white/5"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">
            <ConnectWalletButton compact />
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-borderGrey bg-white text-ink hover:bg-section md:hidden dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-borderGrey bg-white px-4 py-3 md:hidden dark:border-white/10 dark:bg-ink">
          <nav className="flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-section dark:text-white/90 dark:hover:bg-white/5"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-3 sm:hidden">
              <ConnectWalletButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

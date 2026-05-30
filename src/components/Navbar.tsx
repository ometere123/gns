import Link from "next/link";
import { ConnectWalletButton } from "./ConnectWalletButton";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/resolve", label: "Resolve" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/disputes", label: "Disputes" },
  { href: "/about", label: "Docs" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-borderGrey bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">G</span>
          <span className="text-lg font-semibold text-ink">
            GNS<span className="text-primary">.</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-section hover:text-primary"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ConnectWalletButton compact />
        </div>
      </div>
    </header>
  );
}

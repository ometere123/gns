import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-borderGrey bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>
          GNS — GenLayer Naming Service. Readable names for wallets, contracts, AI agents, and apps on GenLayer.
        </p>
        <div className="flex gap-4">
          <Link href="/about" className="hover:text-primary">Docs</Link>
          <Link href="/disputes" className="hover:text-primary">Disputes</Link>
          <Link href="/resolve" className="hover:text-primary">Resolver</Link>
        </div>
      </div>
    </footer>
  );
}

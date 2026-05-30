import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet/WalletProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "GNS — GenLayer Naming Service",
  description:
    "Readable names for wallets, contracts, AI agents, and apps on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-ink">
        <WalletProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}

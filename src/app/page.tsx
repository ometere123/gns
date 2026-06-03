import Link from "next/link";
import { NameSearchBar } from "@/components/NameSearchBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";

const EXAMPLES = ["papito.gen", "agent.gen", "bountylens.gen", "pay.papito.gen"];

const FEATURES = [
  {
    title: "For humans",
    desc: "One readable identity for your wallets, profile records, and links.",
  },
  {
    title: "For contracts",
    desc: "Give your intelligent contracts a memorable, resolvable name.",
  },
  {
    title: "For AI agents",
    desc: "Identify and verify AI agents with subnames like agent.you.gen.",
  },
  {
    title: "For apps",
    desc: "Brand your GenLayer dApp with a clean .gen handle.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="grid items-start gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Badge>GenLayer Native</Badge>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Your identity layer for{" "}
            <span className="text-primary">GenLayer</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted">
            Register readable .gen names for wallets, contracts, AI agents,
            projects, and apps built on GenLayer.
          </p>
          <div className="mt-8">
            <NameSearchBar />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <Link
                key={e}
                href={`/search?name=${encodeURIComponent(e.replace(".gen", ""))}`}
                className="rounded-full border border-borderGrey bg-white px-3 py-1 text-xs text-primary hover:bg-softblue"
              >
                {e}
              </Link>
            ))}
          </div>
        </div>

        <Card padding="lg" className="bg-gradient-to-br from-white to-softblue">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ink">papito.gen</h3>
            <Badge tone="green">Active</Badge>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <Row k="Owner" v="0x82…91A" />
            <Row k="Primary Address" v="0x82…91A" />
            <Row k="X" v="@papito" />
            <Row k="Website" v="papito.xyz" />
            <Row k="Agent" v="bounty-agent.papito.gen" />
          </dl>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">Why GNS?</h2>
        <p className="mt-2 text-sm text-muted">One name. Many records. Built for humans and agents.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <h3 className="text-base font-semibold text-primary">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", t: "Search", d: "Find an available .gen name." },
            { n: "2", t: "Register", d: "Claim it on GenLayer with your wallet." },
            { n: "3", t: "Resolve", d: "Anyone can resolve your name to records." },
          ].map((s) => (
            <Card key={s.n}>
              <span className="text-xs font-semibold text-primary">STEP {s.n}</span>
              <h3 className="mt-1 text-lg font-semibold text-ink">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card padding="lg" className="bg-softblue/40">
          <Badge>Coming later</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-ink">
            Future AI protection layer
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Impersonation detection, dispute review, and brand protection, powered by
            GenLayer Equivalence-Principle prompts. MVP ships deterministic. The AI
            review layer is architected and ready to switch on.
          </p>
        </Card>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-borderGrey pb-2 last:border-none last:pb-0">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono text-ink">{v}</dd>
    </div>
  );
}

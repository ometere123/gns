import Link from "next/link";
import { NameSearchBar } from "@/components/NameSearchBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";

const EXAMPLES = ["builder.gen", "agent.gen", "service.gen", "proof.gen"];

const FEATURES = [
  {
    title: "Readable ownership",
    desc: "Resolve a .gen namespace to its current owner, primary address and public records.",
  },
  {
    title: "Arc USDC payments",
    desc: "Registration and renewal are paid in USDC on Arc, where USDC is also the gas asset.",
  },
  {
    title: "Evidence-grounded authenticity",
    desc: "A separate GenLayer trust layer checks wallet-bound public evidence instead of treating registration as identity proof.",
  },
  {
    title: "Dispute lifecycle",
    desc: "Challenge suspicious authenticity claims without letting a weak challenge erase an existing verified state.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="grid items-start gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Badge>GenLayer × Arc</Badge>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Readable namespaces with{" "}
            <span className="text-primary">verifiable context</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted">
            GNS combines deterministic .gen ownership on GenLayer, USDC payments on Arc,
            and evidence-grounded authenticity and dispute adjudication.
          </p>
          <div className="mt-8">
            <NameSearchBar />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Link
                key={example}
                href={`/search?name=${encodeURIComponent(example.replace(".gen", ""))}`}
                className="rounded-full border border-borderGrey bg-white px-3 py-1 text-xs text-primary hover:bg-softblue"
              >
                {example}
              </Link>
            ))}
          </div>
        </div>

        <Card padding="lg" className="bg-gradient-to-br from-white to-softblue">
          <p className="text-xs uppercase tracking-wide text-muted">One registration, two distinct truths</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-borderGrey bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">Namespace ownership</h3>
                <Badge tone="green">Deterministic</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                Who currently owns the .gen name and what records they published.
              </p>
            </div>
            <div className="rounded-xl border border-borderGrey bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">Authenticity</h3>
                <Badge>Adjudicated</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                Whether public, wallet-bound evidence supports the claimed identity or project relationship.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">What GNS separates</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Payment, ownership and authenticity are deliberately different layers. No payment can manufacture a verified identity verdict.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="text-base font-semibold text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">Register a name</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", t: "Search", d: "Choose an available canonical .gen namespace." },
            { n: "2", t: "Pay on Arc", d: "Pay the router in USDC. The resulting receipt is bound to your namespace and duration." },
            { n: "3", t: "Finalize on GenLayer", d: "Validators independently verify and consume the Arc receipt before ownership changes." },
          ].map((step) => (
            <Card key={step.n}>
              <span className="text-xs font-semibold text-primary">STEP {step.n}</span>
              <h3 className="mt-1 text-lg font-semibold text-ink">{step.t}</h3>
              <p className="mt-2 text-sm text-muted">{step.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card padding="lg" className="bg-softblue/40">
          <Badge>Authenticity ≠ ownership</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-ink">Claim identity only with public evidence.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            After registration, owners can create a separate authenticity claim. GenLayer validators fetch the cited evidence inside the verdict path and require a claim-specific wallet attestation hosted under a registered public source such as a controlled GitHub repository.
          </p>
        </Card>
      </section>
    </div>
  );
}

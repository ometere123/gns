import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";

const FAQ = [
  {
    q: "What is GNS?",
    a: "GNS is the GenLayer Naming Service — a protocol-level naming layer for the GenLayer ecosystem. It maps human-readable .gen names to wallets, contracts, AI agents, and project records.",
  },
  {
    q: "What is a .gen name?",
    a: "A .gen name is a readable handle registered on the GNS contract. Examples include papito.gen and bountylens.gen.",
  },
  {
    q: "What can I attach to a name?",
    a: "Avatar, website, X, GitHub, Discord, email, contract address, AI agent endpoint, and a short description.",
  },
  {
    q: "What are subnames?",
    a: "Subnames are scoped names beneath your root, like pay.papito.gen. They share the parent's expiry.",
  },
  {
    q: "What is reverse lookup?",
    a: "Given an address, GNS returns its primary .gen name so apps can show your name instead of a hex address.",
  },
  {
    q: "What is an AI agent identity?",
    a: "A subname dedicated to an AI agent endpoint, so other services can verify which agent they are talking to.",
  },
  {
    q: "What happens when a name expires?",
    a: "Expired names become available again. Renew before expiry to keep your records intact.",
  },
  {
    q: "Is .gen a real DNS domain?",
    a: "No. GNS names are protocol-level names for the GenLayer ecosystem. They are not public DNS domains unless later connected to DNS or browser infrastructure.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Badge>Docs</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">About GNS</h1>
        <p className="mt-2 text-sm text-muted">
          Readable names for the intelligent contract economy. Register .gen names for wallets, contracts, AI agents, and apps on GenLayer.
        </p>
      </div>
      <div className="space-y-4">
        {FAQ.map((f) => (
          <Card key={f.q}>
            <h3 className="font-semibold text-ink">{f.q}</h3>
            <p className="mt-2 text-sm text-muted">{f.a}</p>
          </Card>
        ))}
      </div>
      <Card padding="lg" className="bg-softblue/40">
        <h3 className="font-semibold text-ink">Limitations</h3>
        <p className="mt-2 text-sm text-muted">
          GNS names are protocol-level names for the GenLayer ecosystem. They are not public DNS domains unless later connected to DNS or browser infrastructure. The AI protection layer (impersonation detection, dispute review, project verification) is architected in the contract but not yet enabled in the MVP UI.
        </p>
      </Card>
    </div>
  );
}

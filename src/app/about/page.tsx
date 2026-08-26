import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/Badge";

const FAQ = [
  {
    q: "What is GNS?",
    a: "GNS is a .gen namespace, authenticity and dispute protocol. Deterministic namespace state lives on GenLayer, commercial registration/renewal fees are paid in USDC on Arc, and GenLayer adjudicates evidence-grounded authenticity claims.",
  },
  {
    q: "What does registering a .gen name prove?",
    a: "Registration proves control of that namespace in the GNS registry. It does not by itself prove a real-world person, organization, project or brand relationship.",
  },
  {
    q: "How do payments work?",
    a: "You pay USDC to the GNS payment router on Arc. GenLayer validators then independently fetch and verify that finalized Arc receipt before the registry consumes it and creates or renews the namespace.",
  },
  {
    q: "Why Arc?",
    a: "Arc uses USDC as its gas asset, so the same asset used to pay GNS also covers the Arc transaction fee. GNS does not require a separate commercial GEN-denominated price.",
  },
  {
    q: "How does authenticity work?",
    a: "The namespace owner creates a separate claim whose subject is bound to current registry state. Validators retrieve public evidence inside the verdict path and require a claim-specific wallet attestation hosted under a registered public source such as a controlled GitHub repository.",
  },
  {
    q: "Can a challenge instantly remove verification?",
    a: "No. Opening a challenge records an open dispute without erasing the prior authoritative VERIFIED state. Only a finalized resolution can revoke or stale that verification under the policy.",
  },
  {
    q: "What can I attach to a name?",
    a: "Avatar, website, X, GitHub, Discord, email, contract address, agent endpoint and a short description. Only publish records you actually control or intend to represent.",
  },
  {
    q: "What are subnames?",
    a: "Subnames are deterministic names beneath a root, such as agent.builder.gen. They inherit the parent's expiry and do not require a separate Arc commercial payment in v3.",
  },
  {
    q: "Is .gen a DNS domain?",
    a: "No. .gen is a protocol namespace. It does not give DNS ownership and GNS does not require users to own a web domain; a controlled public GitHub repository can serve as an authenticity evidence source.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Badge>Protocol</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-ink">About GNS</h1>
        <p className="mt-2 text-sm text-muted">
          GNS separates payment, namespace ownership and authenticity instead of treating them as the same fact.
        </p>
      </div>
      <div className="space-y-4">
        {FAQ.map((item) => (
          <Card key={item.q}>
            <h3 className="font-semibold text-ink">{item.q}</h3>
            <p className="mt-2 text-sm text-muted">{item.a}</p>
          </Card>
        ))}
      </div>
      <Card padding="lg" className="bg-softblue/40">
        <h3 className="font-semibold text-ink">Trust boundary</h3>
        <p className="mt-2 text-sm text-muted">
          GNS authenticity is an evidence-grounded protocol verdict, not legal identity, trademark ownership or a guarantee about future behavior. Arc payments buy protocol actions; they never buy a VERIFIED verdict.
        </p>
      </Card>
    </div>
  );
}

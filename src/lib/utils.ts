export function stripGenSuffix(input: string): string {
  const raw = input.trim().toLowerCase();
  if (raw.endsWith(".gen")) return raw.slice(0, -4);
  return raw;
}

export function normaliseName(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) return "";
  if (raw.endsWith(".gen")) return raw;
  return raw + ".gen";
}

export function isValidLabel(label: string): boolean {
  const l = label.trim().toLowerCase();
  if (l.length < 3 || l.length > 32) return false;
  if (l === "gen") return false;
  if (l.includes(".")) return false;
  if (l.startsWith("-") || l.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(l);
}

export function isValidSubLabel(label: string): boolean {
  const l = label.trim().toLowerCase();
  if (l.length < 2 || l.length > 32) return false;
  if (l.includes(".")) return false;
  if (l.startsWith("-") || l.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(l);
}

export function truncateAddress(address: string | undefined, head = 6, tail = 4): string {
  if (!address) return "";
  const a = address.trim();
  if (a.length <= head + tail + 2) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function formatExpiry(timestamp: number): string {
  if (!timestamp) return "—";
  try {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export function daysUntil(timestamp: number): number {
  if (!timestamp) return 0;
  const ms = timestamp * 1000 - Date.now();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function generateNameSuggestions(label: string): string[] {
  const base = stripGenSuffix(label).replace(/[^a-z0-9-]/g, "") || "name";
  const suffixes = ["ai", "labs", "the", "pay", "hq"];
  const out = new Set<string>();
  out.add(`${base}ai.gen`);
  out.add(`${base}labs.gen`);
  out.add(`the${base}.gen`);
  out.add(`${base}hq.gen`);
  out.add(`pay${base}.gen`);
  for (const s of suffixes) out.add(`${base}${s}.gen`);
  return Array.from(out).slice(0, 6);
}

export function classNames(...arr: Array<string | false | null | undefined>): string {
  return arr.filter(Boolean).join(" ");
}

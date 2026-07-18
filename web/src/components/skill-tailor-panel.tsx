"use client";

import { useEffect, useState } from "react";
import { Check, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Candidate = { name: string; category: string };
type SkillsResponse = {
  hasReport: boolean;
  hasKeywords: boolean;
  candidates: Candidate[];
  matched: string[];
  declined: string[];
  error?: string;
};

function companySlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "role";
}

// The interactive half of "dynamic CV skill tailoring" (plan §1.4 / §2.2). A
// headless worker can't ask "do you know GraphQL?" — so that question has to
// be answered HERE, in the web, before the tailored-PDF worker ever runs. Once
// every JD-recognized skill is confirmed or declined, data/skills-master.yml is
// current and the (headless) `pdf` worker can safely read from it.
export function SkillTailorPanel({ n, company }: { n: string; company: string }) {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [decided, setDecided] = useState<Record<string, "known" | "unknown">>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/skills?report=${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((d: SkillsResponse) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Couldn't load the skill list."));
  }, [n]);

  async function decide(c: Candidate, known: boolean) {
    setPending((p) => new Set(p).add(c.name));
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, category: c.category, source: `jd:${companySlug(company)}`, known }),
      });
      if (!res.ok) throw new Error("write failed");
      setDecided((d) => ({ ...d, [c.name]: known ? "known" : "unknown" }));
    } catch {
      // leave it undecided — the buttons stay live to retry
    } finally {
      setPending((p) => {
        const n2 = new Set(p);
        n2.delete(c.name);
        return n2;
      });
    }
  }

  if (error) return null; // no skills-master.yml or no report — don't block the page, just skip
  if (!data) {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-faint">
        <Loader2 className="size-3.5 animate-spin" /> Checking JD skills against your master list…
      </div>
    );
  }
  if (!data.hasKeywords) return null; // older report with no "Keywords extracted" section — nothing to check

  const remaining = data.candidates.filter((c) => !decided[c.name]);
  const allResolved = remaining.length === 0;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface/40 px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <p className="text-sm font-medium">Dynamic CV tailoring</p>
      </div>

      {data.candidates.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Every skill this JD asks for is already on your master list — the tailored CV will pull from it directly.
        </p>
      ) : allResolved ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" /> All set — the tailored CV will only use confirmed skills.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            This JD mentions skills not yet on your master list. Confirm each one — declined skills are never asked about again.
          </p>
          <ul className="mt-3 space-y-2">
            {remaining.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface/60 px-3 py-2">
                <span className="text-sm">
                  {c.name} <span className="text-xs text-faint">· {c.category}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending.has(c.name)}
                    onClick={() => decide(c, true)}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400 max-sm:min-h-[44px]"
                  >
                    <Check className="size-3" /> Know it
                  </button>
                  <button
                    type="button"
                    disabled={pending.has(c.name)}
                    onClick={() => decide(c, false)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover disabled:opacity-50 max-sm:min-h-[44px]"
                  >
                    <X className="size-3" /> Don&apos;t know
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.matched.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.matched.map((m) => (
            <span key={m} className={cn("rounded-md border border-border/60 bg-surface/60 px-2 py-0.5 text-[11px] text-muted")}>
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

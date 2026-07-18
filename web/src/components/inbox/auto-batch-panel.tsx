"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2, Check, X, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApply } from "@/components/apply/apply-provider";

type Row = {
  url: string;
  company: string;
  title: string;
  status: "evaluating" | "evaluated" | "discarded" | "tailoring" | "generating-pdf" | "ready" | "error" | "duplicate";
  score?: number;
  percent?: number;
  reportNum?: string;
  message?: string;
};

const THRESHOLD = 70;

function cliId(): string | null {
  try {
    return JSON.parse(localStorage.getItem("career-ops:config") || "{}").cliId || null;
  } catch {
    return null;
  }
}

export function AutoBatchPanel({ count }: { count: number }) {
  const router = useRouter();
  const apply = useApply();
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ ready: number; discarded: number; errors: number } | null>(null);
  const openedFirst = useRef(false);

  const upsert = (url: string, patch: Partial<Row>) => {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.url === url);
      if (i === -1) return rs;
      const next = [...rs];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const run = async () => {
    const id = cliId();
    if (!id) {
      alert("Configure a CLI in Config first — the batch runner needs it to evaluate.");
      return;
    }
    setRunning(true);
    setExpanded(true);
    setRows([]);
    setSummary(null);
    openedFirst.current = false;

    try {
      const r = await fetch("/api/pipeline/auto-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliId: id, thresholdPercent: THRESHOLD }),
      });
      if (!r.body) {
        setRunning(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          switch (ev.kind) {
            case "job-start":
              setRows((rs) => [...rs, { url: ev.url as string, company: ev.company as string, title: ev.title as string, status: "evaluating" }]);
              break;
            case "skip-duplicate":
              upsert(ev.url as string, { status: "duplicate", message: ev.reason as string });
              break;
            case "evaluated":
              upsert(ev.url as string, { status: "evaluated", score: ev.score as number, percent: ev.percent as number, reportNum: ev.reportNum as string });
              break;
            case "discarded":
              upsert(ev.url as string, { status: "discarded", score: ev.score as number, percent: ev.percent as number });
              break;
            case "skills-confirmed":
              // reportNum-keyed — find the row by reportNum instead of url
              setRows((rs) => rs.map((r) => (r.reportNum === ev.reportNum ? { ...r, status: "tailoring" } : r)));
              break;
            case "ready": {
              upsert(ev.url as string, { status: "ready", score: ev.score as number, reportNum: ev.reportNum as string });
              if (!openedFirst.current) {
                openedFirst.current = true;
                void apply.open(ev.url as string, { prefill: true, company: ev.company as string });
                router.push("/apply");
              }
              break;
            }
            case "error":
              if (ev.url) upsert(ev.url as string, { status: "error", message: ev.message as string });
              break;
            case "batch-done":
              setSummary({ ready: ev.ready as number, discarded: ev.discarded as number, errors: ev.errors as number });
              router.refresh();
              break;
            default:
              break;
          }
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-brand/25 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Zap className="size-4 text-brand" /> Auto-batch
          </div>
          <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Evaluates every pending inbox posting ({count}). Score ≥{THRESHOLD}% → auto-confirms JD skills, generates a tailored CV, opens the filled
            application form. Below {THRESHOLD}% → discarded, no PDF spent. Always stops before Submit — that part is still you.
          </p>
        </div>
        <button
          type="button"
          disabled={running || count === 0}
          onClick={run}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-sm transition-colors hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          {running ? "Running…" : `Run auto-batch (${count})`}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-surface/50">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground"
          >
            <span>
              {summary ? `Done — ${summary.ready} ready · ${summary.discarded} discarded · ${summary.errors} errors` : `Processing ${rows.length}/${count}…`}
            </span>
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <ul className="divide-y divide-border border-t border-border">
              {rows.map((r) => (
                <li key={r.url} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]">
                  <StatusIcon status={r.status} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">{r.company}</span> <span className="text-muted">· {r.title}</span>
                  </span>
                  {r.percent != null && <span className="shrink-0 tabular-nums text-faint">{r.percent}%</span>}
                  {r.status === "ready" && r.reportNum && (
                    <button
                      type="button"
                      onClick={() => {
                        void apply.open(r.url, { prefill: true, company: r.company });
                        router.push("/apply");
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand"
                    >
                      Apply <ExternalLink className="size-3" />
                    </button>
                  )}
                  {r.message && <span className="shrink-0 max-w-[14rem] truncate text-faint" title={r.message}>{r.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Row["status"] }) {
  if (status === "ready") return <Check className="size-3.5 shrink-0 text-emerald-500" />;
  if (status === "discarded" || status === "duplicate") return <X className="size-3.5 shrink-0 text-faint" />;
  if (status === "error") return <X className="size-3.5 shrink-0 text-red-500" />;
  return <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" />;
}

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readInbox, readApplications, readReport, markPipelineDone } from "@/lib/career-ops";
import { acquireTrackerWrite, releaseTrackerWrite } from "@/lib/core/run-registry";
import { runOnce } from "@/lib/core/run-once";
import { skillsMasterExists, readSkillsMaster, recordSkillDecision, isKnownSkill } from "@/lib/skills-master";
import { extractReportKeywords, matchTechKeywords } from "@/lib/tech-keywords";

export type AutoBatchEvent =
  | { kind: "queue"; total: number }
  | { kind: "job-start"; url: string; company: string; title: string }
  | { kind: "skip-duplicate"; url: string; company: string; reason: string }
  | { kind: "evaluated"; url: string; company: string; title: string; reportNum: string; score: number; percent: number }
  | { kind: "discarded"; url: string; company: string; score: number; percent: number }
  | { kind: "skills-confirmed"; reportNum: string; count: number }
  | { kind: "ready"; url: string; company: string; title: string; reportNum: string; score: number }
  | { kind: "error"; url: string; company: string; message: string }
  | { kind: "batch-done"; total: number; ready: number; discarded: number; errors: number };

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function reportsSnapshot(): Set<string> {
  try {
    return new Set(fs.readdirSync(path.join(careerOpsRoot(), "reports")).filter((f) => f.endsWith(".md")));
  } catch {
    return new Set();
  }
}

function newReportNum(before: Set<string>): string | null {
  const after = reportsSnapshot();
  for (const f of after) {
    if (!before.has(f)) {
      const m = f.match(/^(\d+)/);
      if (m) return m[1];
    }
  }
  return null;
}

function scoreFromReport(content: string): number | null {
  const m = content.match(/\*\*Score:\*\*\s*([\d.]+)\s*\/\s*5/);
  return m ? parseFloat(m[1]) : null;
}

/** Cheap, deterministic (non-LLM) tracker status flip for auto-discarded postings. */
function discardInTracker(company: string, percent: number, threshold: number): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(careerOpsRoot(), "set-status.mjs"), company, "Discarded", "--note", `auto-batch: ${percent.toFixed(0)}% < ${threshold}% threshold`],
      { cwd: careerOpsRoot() },
    );
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

/**
 * Auto-batch pipeline (at Fiodar's request, 2026-07-13): evaluate → gate on
 * match% → auto-confirm every JD skill the tailoring dictionary recognizes
 * (deliberately overrides the normal "human clicks Know it/Don't know" gate —
 * see recordSkillDecision's doc comment for what that gate normally protects)
 * → generate the tailored CV PDF. STRICTLY sequential (one posting fully done
 * before the next starts) — cheaper on tracker-lock contention than parallel,
 * and the whole point of a "run it and walk away" batch is not needing to
 * watch N windows at once. Never touches Apply/Submit — that boundary is
 * unrelated to this function and stays exactly where it was.
 */
export async function runAutoBatch(
  opts: { cliId: string; thresholdPercent: number },
  onEvent: (e: AutoBatchEvent) => void,
): Promise<void> {
  const pending = readInbox().filter((j) => !j.done);
  // Dedupe by URL (pipeline.md can list the same posting twice) AND by
  // company+role already present in the tracker (the "3x Polcode" case —
  // same job, different scraped URL variant).
  const seenUrls = new Set<string>();
  const apps = readApplications();
  const jobs = pending.filter((j) => {
    if (seenUrls.has(j.url)) return false;
    seenUrls.add(j.url);
    return true;
  });

  onEvent({ kind: "queue", total: jobs.length });

  let ready = 0;
  let discarded = 0;
  let errors = 0;

  for (const job of jobs) {
    onEvent({ kind: "job-start", url: job.url, company: job.company, title: job.role });

    const dupe = apps.find((a) => norm(a.company) === norm(job.company) && norm(a.role).length > 3 && norm(a.role) === norm(job.role));
    if (dupe) {
      onEvent({ kind: "skip-duplicate", url: job.url, company: job.company, reason: `already has report #${dupe.report || dupe.n}` });
      try { markPipelineDone(job.url); } catch { /* best-effort */ }
      continue;
    }

    const before = reportsSnapshot();
    const writeToken = acquireTrackerWrite();
    const evalRun = await runOnce("evaluate", job.url, opts.cliId).finally(() => releaseTrackerWrite(writeToken));
    if (!evalRun.ok) {
      errors++;
      onEvent({ kind: "error", url: job.url, company: job.company, message: evalRun.error || "evaluation failed" });
      continue;
    }
    const reportNum = newReportNum(before);
    if (!reportNum) {
      errors++;
      onEvent({ kind: "error", url: job.url, company: job.company, message: "evaluation finished but no report was written" });
      continue;
    }
    const report = readReport(reportNum);
    const score = report ? scoreFromReport(report.content) : null;
    if (score == null) {
      errors++;
      onEvent({ kind: "error", url: job.url, company: job.company, message: "couldn't parse a score from the report" });
      continue;
    }
    const percent = Math.round((score / 5) * 100);
    onEvent({ kind: "evaluated", url: job.url, company: job.company, title: job.role, reportNum, score, percent });

    if (percent < opts.thresholdPercent) {
      discarded++;
      onEvent({ kind: "discarded", url: job.url, company: job.company, score, percent });
      await discardInTracker(job.company, percent, opts.thresholdPercent);
      continue;
    }

    // Auto-confirm every JD skill the dictionary recognizes (explicit override
    // of the normal human-attestation gate — Fiodar's call, see doc comment).
    if (skillsMasterExists() && report) {
      const { skills, declined } = readSkillsMaster();
      const keywords = extractReportKeywords(report.content);
      const matched = matchTechKeywords(keywords);
      const candidates = matched.filter((m) => !isKnownSkill(m.name, skills) && !isKnownSkill(m.name, declined));
      const slug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      for (const c of candidates) {
        recordSkillDecision({ name: c.name, category: c.category, source: `jd:${slug}-auto`, known: true });
      }
      if (candidates.length) onEvent({ kind: "skills-confirmed", reportNum, count: candidates.length });
    }

    const writeToken2 = acquireTrackerWrite();
    const pdfRun = await runOnce("pdf", reportNum, opts.cliId).finally(() => releaseTrackerWrite(writeToken2));
    if (!pdfRun.ok) {
      errors++;
      onEvent({ kind: "error", url: job.url, company: job.company, message: pdfRun.error || "PDF generation failed" });
      continue;
    }

    ready++;
    onEvent({ kind: "ready", url: job.url, company: job.company, title: job.role, reportNum, score });
  }

  onEvent({ kind: "batch-done", total: jobs.length, ready, discarded, errors });
}

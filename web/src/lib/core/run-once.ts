import { spawn } from "node:child_process";
import { resolveCli } from "@/lib/clis";
import { careerOpsRoot } from "@/lib/career-ops";
import { buildPrompt } from "@/lib/core/run-prompts";

export type RunOnceResult = { ok: boolean; text: string; error?: string };

/**
 * Non-streaming sibling of /api/run's spawn logic, for the auto-batch
 * orchestrator (lib/core/auto-batch.ts) — it needs a plain await, not an
 * NDJSON stream, since it drives many of these sequentially itself. Shares
 * buildPrompt() with /api/run so a batch run is worded identically to a
 * manual one; duplicates only the spawn plumbing (kept deliberately small).
 */
export async function runOnce(kind: "evaluate" | "pdf", input: string, cliId: string): Promise<RunOnceResult> {
  const resolved = resolveCli(cliId);
  if (!resolved) return { ok: false, text: "", error: `CLI '${cliId}' not found` };
  const { spec, binPath } = resolved;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(kind, input, "", today);
  const isClaude = cliId === "claude";
  const tools = { allowed: "Read,WebFetch,WebSearch,Write,Edit,Bash,Glob,Grep", disallowed: "Task,NotebookEdit" };
  const args = isClaude
    ? ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages",
       "--permission-mode", "acceptEdits",
       "--allowedTools", tools.allowed,
       "--disallowedTools", tools.disallowed]
    : spec.args(prompt);

  const killMs = kind === "pdf" ? 720_000 : 285_000;

  return new Promise((resolve) => {
    const child = spawn(binPath, args, { cwd: careerOpsRoot(), env: process.env });
    let text = "";
    let emittedText = false;
    let sawError = false;
    let buf = "";
    const killer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
    }, killMs);

    child.stdout.on("data", (d: Buffer) => {
      if (!isClaude) {
        emittedText = true;
        text += d.toString();
        return;
      }
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.text) {
            emittedText = true;
            text += ev.event.delta.text;
          }
        } catch {
          /* partial line */
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      if (/error|denied|fatal|not found|unauthorized|forbidden|auth|login|credential|api[ -]?key|quota|rate limit|not authenticated/i.test(s)) {
        sawError = true;
      }
    });
    child.on("error", (e) => {
      clearTimeout(killer);
      resolve({ ok: false, text, error: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      const cleanExit = code === 0;
      if (!emittedText && !sawError && !cleanExit) resolve({ ok: false, text, error: "CLI exited with an error" });
      else if (!emittedText && !sawError) resolve({ ok: false, text, error: "CLI produced no output" });
      else if (!cleanExit || sawError) resolve({ ok: false, text, error: "Run hit an error before finishing" });
      else resolve({ ok: true, text });
    });
  });
}

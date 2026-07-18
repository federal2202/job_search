import fs from "node:fs";
import { rootScript } from "@/lib/career-ops";
import { runAutoBatch, type AutoBatchEvent } from "@/lib/core/auto-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600; // sequential evaluate+pdf per posting — a real batch can run long

export async function POST(req: Request) {
  let body: { cliId?: string; thresholdPercent?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const cliId = body.cliId;
  const thresholdPercent = Number.isFinite(body.thresholdPercent) ? Math.min(100, Math.max(0, body.thresholdPercent!)) : 70;
  if (!cliId) return Response.json({ error: "cliId required" }, { status: 400 });

  if (!fs.existsSync(rootScript("scan"))) {
    return Response.json({ error: "This checkout is data-only — the batch runner isn't available." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: AutoBatchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await runAutoBatch({ cliId, thresholdPercent }, send);
      } catch (err) {
        send({ kind: "error", url: "", company: "", message: err instanceof Error ? err.message : "auto-batch failed" });
      }
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

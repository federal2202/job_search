import { NextResponse } from "next/server";
import { readReport } from "@/lib/career-ops";
import { readSkillsMaster, recordSkillDecision, skillsMasterExists, isKnownSkill } from "@/lib/skills-master";
import { extractReportKeywords, matchTechKeywords } from "@/lib/tech-keywords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The web-side half of "dynamic CV skill tailoring" (plan §1.4/§2.2): before a
// tailored CV can be generated for a report, every JD skill the dictionary
// recognizes must be either already-known, already-declined, or freshly
// decided right here — so the (headless) pdf worker never has to ask anything
// itself, it just reads the now-current data/skills-master.yml.

export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("report");
  if (!n) return NextResponse.json({ error: "report number required" }, { status: 400 });

  if (!skillsMasterExists()) {
    return NextResponse.json({ error: "data/skills-master.yml not found — run career-ops onboarding first." }, { status: 400 });
  }

  const report = readReport(n);
  const { skills, declined } = readSkillsMaster();

  const keywords = report ? extractReportKeywords(report.content) : [];
  const matched = matchTechKeywords(keywords);
  const candidates = matched.filter((m) => !isKnownSkill(m.name, skills) && !isKnownSkill(m.name, declined));
  const alreadyMatched = matched.filter((m) => isKnownSkill(m.name, skills));

  return NextResponse.json({
    hasReport: !!report,
    hasKeywords: keywords.length > 0,
    candidates, // new — needs a yes/no
    matched: alreadyMatched.map((m) => m.name), // already confirmed and relevant to this JD
    declined: declined.map((d) => d.name),
  });
}

export async function POST(req: Request) {
  let body: { name?: string; category?: string; source?: string; known?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { name, category, source, known } = body;
  if (!name || !category || !source || typeof known !== "boolean") {
    return NextResponse.json({ error: "name, category, source, known required" }, { status: 400 });
  }
  const result = recordSkillDecision({ name, category, source, known });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

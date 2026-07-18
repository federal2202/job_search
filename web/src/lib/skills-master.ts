import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

// Reads/writes `data/skills-master.yml` — the growing pool of skills Fiodar has
// explicitly confirmed (or declined) during interactive CV tailoring (plan §1.3/
// §1.4/§2.2). A skill is NEVER auto-added just because a JD mentions it; this
// module only records what the human clicked.
//
// Writes go through targeted TEXT insertion, not a parse-then-yaml.dump round
// trip — the file carries hand-written explanatory comments (growth rule,
// category dividers) that a full re-serialize via js-yaml would silently strip.
// Reads are a plain js-yaml load (safe — nothing is written back from it).

export type SkillEntry = { name: string; category: string; source: string; confirmed_date: string };

function filePath(): string {
  return path.join(careerOpsRoot(), "data", "skills-master.yml");
}

export function skillsMasterExists(): boolean {
  return fs.existsSync(filePath());
}

export function readSkillsMaster(): { skills: SkillEntry[]; declined: SkillEntry[] } {
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    const parsed = (yaml.load(raw) as { skills?: SkillEntry[]; declined?: SkillEntry[] } | undefined) || {};
    return { skills: parsed.skills ?? [], declined: parsed.declined ?? [] };
  } catch {
    return { skills: [], declined: [] };
  }
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlBlock(entry: SkillEntry): string {
  return [
    `  - name: ${quote(entry.name)}`,
    `    category: ${quote(entry.category)}`,
    `    source: ${quote(entry.source)}`,
    `    confirmed_date: ${quote(entry.confirmed_date)}`,
  ].join("\n");
}

/** Insert `block` as the last item of the top-level `key:` list, preserving
 *  every other byte of the file untouched (comments, spacing, ordering). */
function appendUnderKey(raw: string, key: "skills" | "declined", block: string): string {
  const lines = raw.split("\n");
  const keyLineRe = new RegExp(`^${key}:\\s*(\\[\\s*\\])?\\s*(#.*)?$`);
  const keyIdx = lines.findIndex((l) => keyLineRe.test(l));

  if (keyIdx === -1) {
    // No such top-level key yet — start a fresh section at EOF.
    const sep = raw.endsWith("\n") ? "" : "\n";
    return `${raw}${sep}${key}:\n${block}\n`;
  }

  // "key: []" (empty inline list) → expand into a real block list.
  if (/\[\s*\]/.test(lines[keyIdx])) {
    lines[keyIdx] = `${key}:`;
    lines.splice(keyIdx + 1, 0, block);
    return lines.join("\n");
  }

  // Otherwise the list already has entries — insert right before the next
  // column-0 line (the next top-level key, a comment header, or EOF).
  let endIdx = lines.length;
  for (let i = keyIdx + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  lines.splice(endIdx, 0, block);
  return lines.join("\n");
}

export function isKnownSkill(name: string, list: SkillEntry[]): boolean {
  const n = name.trim().toLowerCase();
  return list.some((s) => s.name.trim().toLowerCase() === n);
}

/**
 * Record Fiodar's yes/no on one JD skill. No-op (still `ok: true`) if the
 * skill was already decided either way — the whole point is never asking twice.
 */
export function recordSkillDecision(input: {
  name: string;
  category: string;
  source: string;
  known: boolean;
}): { ok: boolean; error?: string } {
  const file = filePath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return { ok: false, error: "data/skills-master.yml not found." };
  }
  const { skills, declined } = readSkillsMaster();
  if (isKnownSkill(input.name, skills) || isKnownSkill(input.name, declined)) {
    return { ok: true };
  }
  const today = new Date().toISOString().slice(0, 10);
  const entry: SkillEntry = {
    name: input.name,
    category: input.category,
    source: input.source,
    confirmed_date: today,
  };
  const updated = appendUnderKey(raw, input.known ? "skills" : "declined", yamlBlock(entry));
  atomicWriteWithBackup(file, updated);
  return { ok: true };
}

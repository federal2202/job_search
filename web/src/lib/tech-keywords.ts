// A curated dictionary mapping recognizable technology/tool keywords (as they
// tend to appear in a JD's "## Keywords extracted" list) to a canonical skill
// name + category — the same category vocabulary data/skills-master.yml uses.
//
// This is deliberately a static, zero-cost lookup (no AI call): distinguishing
// "GraphQL" or "Contentstack" from filler phrases like "team player" is a
// solved, enumerable problem for common stacks, and matching it for free keeps
// the skill-tailoring gate instant. It will miss niche/obscure tools — that's
// an acceptable v1 gap, and the dictionary is meant to grow over time the same
// way the master skill list does.
//
// Matching is case-insensitive, word-boundary aware (so "react" doesn't match
// inside "reactive"). Multi-word aliases are matched as a literal phrase.

export type TechCategory = "Frontend" | "Backend" | "DevOps & Cloud" | "Integrations & AI" | "Testing & Tools";

const DICTIONARY: Record<string, { canonical: string; category: TechCategory }> = {
  // Frontend
  javascript: { canonical: "JavaScript", category: "Frontend" },
  typescript: { canonical: "TypeScript", category: "Frontend" },
  react: { canonical: "React", category: "Frontend" },
  "react.js": { canonical: "React", category: "Frontend" },
  "next.js": { canonical: "Next.js", category: "Frontend" },
  nextjs: { canonical: "Next.js", category: "Frontend" },
  vue: { canonical: "Vue.js", category: "Frontend" },
  "vue.js": { canonical: "Vue.js", category: "Frontend" },
  nuxt: { canonical: "Nuxt", category: "Frontend" },
  angular: { canonical: "Angular", category: "Frontend" },
  svelte: { canonical: "Svelte", category: "Frontend" },
  "react native": { canonical: "React Native", category: "Frontend" },
  "tailwind css": { canonical: "Tailwind CSS", category: "Frontend" },
  tailwind: { canonical: "Tailwind CSS", category: "Frontend" },
  scss: { canonical: "SCSS", category: "Frontend" },
  sass: { canonical: "SCSS", category: "Frontend" },
  zustand: { canonical: "Zustand", category: "Frontend" },
  redux: { canonical: "Redux / RTK", category: "Frontend" },
  rtk: { canonical: "Redux / RTK", category: "Frontend" },
  "tanstack query": { canonical: "TanStack Query", category: "Frontend" },
  "react query": { canonical: "TanStack Query", category: "Frontend" },
  webpack: { canonical: "Webpack", category: "Frontend" },
  vite: { canonical: "Vite", category: "Frontend" },
  ssr: { canonical: "SSR/ISR/SSG", category: "Frontend" },
  isr: { canonical: "SSR/ISR/SSG", category: "Frontend" },
  ssg: { canonical: "SSR/ISR/SSG", category: "Frontend" },

  // Backend
  "node.js": { canonical: "Node.js", category: "Backend" },
  nodejs: { canonical: "Node.js", category: "Backend" },
  "express.js": { canonical: "Express.js", category: "Backend" },
  express: { canonical: "Express.js", category: "Backend" },
  python: { canonical: "Python", category: "Backend" },
  fastapi: { canonical: "FastAPI", category: "Backend" },
  django: { canonical: "Django", category: "Backend" },
  flask: { canonical: "Flask", category: "Backend" },
  graphql: { canonical: "GraphQL", category: "Backend" },
  rest: { canonical: "REST", category: "Backend" },
  "rest api": { canonical: "REST", category: "Backend" },
  "rest apis": { canonical: "REST", category: "Backend" },
  postgresql: { canonical: "PostgreSQL", category: "Backend" },
  postgres: { canonical: "PostgreSQL", category: "Backend" },
  prisma: { canonical: "Prisma", category: "Backend" },
  mongodb: { canonical: "MongoDB", category: "Backend" },
  mongo: { canonical: "MongoDB", category: "Backend" },
  redis: { canonical: "Redis", category: "Backend" },
  golang: { canonical: "Go", category: "Backend" },
  java: { canonical: "Java", category: "Backend" },
  "spring boot": { canonical: "Spring Boot", category: "Backend" },

  // DevOps & Cloud
  docker: { canonical: "Docker", category: "DevOps & Cloud" },
  "ci/cd": { canonical: "CI/CD", category: "DevOps & Cloud" },
  "github actions": { canonical: "GitHub Actions", category: "DevOps & Cloud" },
  gitlab: { canonical: "GitLab", category: "DevOps & Cloud" },
  nginx: { canonical: "Nginx", category: "DevOps & Cloud" },
  cloudflare: { canonical: "Cloudflare", category: "DevOps & Cloud" },
  azure: { canonical: "Azure", category: "DevOps & Cloud" },
  vercel: { canonical: "Vercel", category: "DevOps & Cloud" },
  aws: { canonical: "AWS", category: "DevOps & Cloud" },
  kubernetes: { canonical: "Kubernetes", category: "DevOps & Cloud" },
  k8s: { canonical: "Kubernetes", category: "DevOps & Cloud" },
  terraform: { canonical: "Terraform", category: "DevOps & Cloud" },

  // Integrations & AI / Commerce / Content
  stripe: { canonical: "Stripe", category: "Integrations & AI" },
  "telegram api": { canonical: "Telegram API", category: "Integrations & AI" },
  "medusa.js": { canonical: "Medusa.js", category: "Integrations & AI" },
  medusa: { canonical: "Medusa.js", category: "Integrations & AI" },
  kafka: { canonical: "Kafka", category: "Integrations & AI" },
  microservices: { canonical: "Microservices", category: "Integrations & AI" },
  openai: { canonical: "OpenAI", category: "Integrations & AI" },
  gemini: { canonical: "Gemini", category: "Integrations & AI" },
  contentstack: { canonical: "Contentstack (headless CMS)", category: "Integrations & AI" },
  "headless cms": { canonical: "Contentstack (headless CMS)", category: "Integrations & AI" },
  contentful: { canonical: "Contentful (headless CMS)", category: "Integrations & AI" },
  sanity: { canonical: "Sanity (headless CMS)", category: "Integrations & AI" },
  algolia: { canonical: "Algolia", category: "Integrations & AI" },
  ga4: { canonical: "GA4 / GTM / OneTrust", category: "Integrations & AI" },
  gtm: { canonical: "GA4 / GTM / OneTrust", category: "Integrations & AI" },
  onetrust: { canonical: "GA4 / GTM / OneTrust", category: "Integrations & AI" },
  shopify: { canonical: "Shopify", category: "Integrations & AI" },
  "composable commerce": { canonical: "Medusa.js", category: "Integrations & AI" },

  // Testing & Tools
  git: { canonical: "Git", category: "Testing & Tools" },
  cypress: { canonical: "Cypress", category: "Testing & Tools" },
  "react testing library": { canonical: "React Testing Library", category: "Testing & Tools" },
  storybook: { canonical: "Storybook", category: "Testing & Tools" },
  jest: { canonical: "Jest", category: "Testing & Tools" },
  playwright: { canonical: "Playwright", category: "Testing & Tools" },
  vitest: { canonical: "Vitest", category: "Testing & Tools" },
  mocha: { canonical: "Mocha", category: "Testing & Tools" },
};

export type TechCandidate = { name: string; category: TechCategory };

/**
 * Match a report's extracted keyword list against the dictionary, returning
 * one candidate per DISTINCT canonical skill (dedup — "GA4" and "GTM" in the
 * same JD collapse to one "GA4 / GTM / OneTrust" candidate).
 */
export function matchTechKeywords(keywords: string[]): TechCandidate[] {
  const seen = new Set<string>();
  const out: TechCandidate[] = [];
  for (const raw of keywords) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    const hit = DICTIONARY[needle];
    if (!hit) continue;
    if (seen.has(hit.canonical)) continue;
    seen.add(hit.canonical);
    out.push({ name: hit.canonical, category: hit.category });
  }
  return out;
}

/** Parse the `## Keywords extracted` section of a report body (comma-separated,
 *  per the oferta.md report format) into a flat list of raw keyword strings. */
export function extractReportKeywords(reportBody: string): string[] {
  const m = reportBody.match(/##\s*Keywords extracted\s*\n+([^\n#]+)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

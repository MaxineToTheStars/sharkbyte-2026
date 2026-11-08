import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { careers, type Program } from "./careers.ts";

const ORIGIN = "https://mdc.curricunet.com";

// The value import keeps this module loadable under node --experimental-strip-types.
void careers;

type NavItem = {
  id: number;
  text: string | null;
};

type CatalogPage = {
  page?: {
    id?: number;
    text?: string | null;
    aliaspath?: string | null;
  };
  body?: Array<{
    text?: string | null;
    navlist?: NavItem[];
  }>;
};

type CatalogRow = {
  Id?: number;
  Title?: string | null;
  Active?: number | boolean;
};

export function chooseSequence(input: {
  catalogText: string | null;
  pdfText: string | null;
  snapshotText: string | null;
  sentinel: string | null;
}): { text: string; source: "catalog" | "pdf" | "snapshot" } {
  const sentinel =
    typeof input.sentinel === "string" && input.sentinel.length > 0
      ? input.sentinel
      : null;

  if (sentinel && present(input.catalogText) && input.catalogText.includes(sentinel)) {
    return { text: input.catalogText, source: "catalog" };
  }
  if (present(input.pdfText) && (!sentinel || input.pdfText.includes(sentinel))) {
    return { text: input.pdfText, source: "pdf" };
  }
  if (present(input.snapshotText)) {
    return { text: input.snapshotText, source: "snapshot" };
  }
  throw new Error("No course sequence for this program");
}

export async function loadSequence(program: Program): Promise<{
  text: string;
  source: "catalog" | "pdf" | "snapshot";
  catalogUrl?: string;
  pdfUrl: string;
}> {
  let catalogText: string | null = null;
  let catalogUrl: string | undefined;
  try {
    const catalogId = await activeCatalogId();
    const page = await findProgram(catalogId, program);
    const alias = page?.page?.aliaspath;
    if (alias) catalogUrl = `${ORIGIN}/catalog/iq/${alias}`;
    if (page) catalogText = await readCsg(catalogId, page);
  } catch {
    catalogText = null;
  }

  let pdfText: string | null = null;
  let snapshotText: string | null = null;
  if (!accepted("catalog", catalogText, program.sentinel)) {
    pdfText = await readPdf(program.pdfUrl);
    if (!accepted("pdf", pdfText, program.sentinel)) {
      snapshotText = await readSnapshot(program.id);
    }
  }

  try {
    const chosen = chooseSequence({
      catalogText,
      pdfText,
      snapshotText,
      sentinel: program.sentinel,
    });
    return {
      text: chosen.text,
      source: chosen.source,
      ...(catalogUrl ? { catalogUrl } : {}),
      pdfUrl: program.pdfUrl,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "sequence failed";
    throw new Error(`${program.id}: ${detail}`);
  }
}

function present(text: string | null): text is string {
  return typeof text === "string" && text.trim().length > 0;
}

function accepted(
  source: "catalog" | "pdf",
  text: string | null,
  sentinel: string | null,
): boolean {
  try {
    return (
      chooseSequence({
        catalogText: source === "catalog" ? text : null,
        pdfText: source === "pdf" ? text : null,
        snapshotText: null,
        sentinel,
      }).source === source
    );
  } catch {
    return false;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return (await response.json()) as T;
}

async function activeCatalogId(): Promise<number> {
  const rows = await getJson<CatalogRow[]>(`${ORIGIN}/catalog/_getCatalogs`);
  const match = rows.find(
    (row) =>
      (row.Active === 1 || row.Active === true) &&
      typeof row.Id === "number" &&
      (row.Title ?? "").includes("2026-2028"),
  );
  if (!match || typeof match.Id !== "number") {
    throw new Error("No active 2026-2028 catalog");
  }
  return match.Id;
}

async function getPage(catalogId: number, sectionId: number): Promise<CatalogPage> {
  return getJson<CatalogPage>(
    `${ORIGIN}/catalog/_getPage?catalogId=${catalogId}&id=${sectionId}`,
  );
}

function navItems(page: CatalogPage): NavItem[] {
  return (page.body ?? []).flatMap((block) => block.navlist ?? []);
}

async function findProgram(
  catalogId: number,
  program: Program,
): Promise<CatalogPage | null> {
  if (typeof program.pageHint === "number") {
    try {
      const hinted = await getPage(catalogId, program.pageHint);
      if (hinted.page?.text === program.catalogTitle) return hinted;
    } catch {
      // Hint missed. Walk the Programs tree.
    }
  }

  const nav = await getJson<{ navs?: NavItem[] }>(
    `${ORIGIN}/catalog/_getNavigation?id=${catalogId}&navigationtypeId=1`,
  );
  const programs = nav.navs?.find((item) => item.text === "Programs");
  if (!programs) return null;
  return walk(catalogId, programs.id, program.catalogTitle, new Set());
}

async function walk(
  catalogId: number,
  sectionId: number,
  title: string,
  seen: Set<number>,
): Promise<CatalogPage | null> {
  if (seen.has(sectionId)) return null;
  seen.add(sectionId);
  const page = await getPage(catalogId, sectionId);
  if (page.page?.text === title) return page;

  for (const item of navItems(page)) {
    if (item.text !== title) continue;
    const found = await getPage(catalogId, item.id);
    if (found.page?.text === title) return found;
  }

  for (const item of navItems(page)) {
    if (item.text) continue;
    const found = await walk(catalogId, item.id, title, seen);
    if (found) return found;
  }
  return null;
}

async function readCsg(catalogId: number, page: CatalogPage): Promise<string | null> {
  const csgId = await findCsgId(catalogId, page);
  if (csgId == null) return null;
  const csg = await getPage(catalogId, csgId);
  const html = (csg.body ?? []).map((block) => block.text ?? "").join("\n");
  const text = htmlToText(html).trim();
  return text || null;
}

async function findCsgId(catalogId: number, page: CatalogPage): Promise<number | null> {
  const direct = csgIdIn(page);
  if (direct != null) return direct;
  for (const item of navItems(page)) {
    if (item.text?.includes("Courses In Program")) continue;
    if (item.text && !item.text.includes("Course Sequence Guide")) continue;
    const child = await getPage(catalogId, item.id);
    const id = csgIdIn(child);
    if (id != null) return id;
  }
  return null;
}

function csgIdIn(page: CatalogPage): number | null {
  return navItems(page).find((item) => item.text?.includes("Course Sequence Guide"))?.id ?? null;
}

function htmlToText(html: string): string {
  const broken = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|li|h\d)>/gi, "\n");
  const stripped = broken.replace(/<[^>]*>/g, " ");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/gi, "&");
  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function readPdf(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 5) return null;
    const signature = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
    if (signature !== "%PDF") return null;
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    const text = extracted.text.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function readSnapshot(id: string): Promise<string | null> {
  try {
    const text = await readFile(join(process.cwd(), "data", "csg", `${id}.txt`), "utf8");
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

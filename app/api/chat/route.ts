import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getCareer, getProgram } from "@/lib/careers";
import { loadSequence } from "@/lib/catalog";
import { askGemini } from "@/lib/gemini";

export const maxDuration = 60;

const AUTH_ENV = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "APP_BASE_URL",
] as const;

type RoadmapItem = { name: string; text: string };
type HistoryTurn = { role: "user" | "model"; text: string };

function auth0EnvMissing(): boolean {
  return AUTH_ENV.some((name) => !process.env[name]?.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureText(error: unknown): string {
  const message = error instanceof Error ? error.message : "chat failed";
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!key || !message.includes(key)) return message;
  return message.replaceAll(key, "redacted");
}

function parseRoadmap(value: unknown): RoadmapItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const roadmap: RoadmapItem[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.text !== "string") {
      return undefined;
    }
    roadmap.push({ name: item.name, text: item.text });
  }
  return roadmap;
}

function parseHistory(value: unknown): HistoryTurn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const history: HistoryTurn[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      (item.role !== "user" && item.role !== "model") ||
      typeof item.text !== "string"
    ) {
      return undefined;
    }
    history.push({ role: item.role, text: item.text });
  }
  return history;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question;
  if (typeof question !== "string" || question.length === 0 || question.length > 500) {
    return NextResponse.json(
      { error: "question must be a non-empty string of at most 500 characters" },
      { status: 400 },
    );
  }

  const career = typeof body.careerId === "string" ? getCareer(body.careerId) : undefined;
  const program =
    career && typeof body.programId === "string"
      ? getProgram(career.id, body.programId)
      : undefined;
  if (!career || !program) {
    return NextResponse.json({ error: "Unknown career or program" }, { status: 400 });
  }

  const roadmap = parseRoadmap(body.roadmap);
  if (!roadmap) {
    return NextResponse.json(
      { error: "roadmap must be an array of { name, text } strings" },
      { status: 400 },
    );
  }
  const history = parseHistory(body.history);
  if (!history) {
    return NextResponse.json(
      { error: "history must be an array of { role, text } turns" },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await auth0.getSession();
  } catch (error) {
    if (auth0EnvMissing()) {
      return NextResponse.json({ error: "Auth0 is not configured" }, { status: 500 });
    }
    throw error;
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const sequence = await loadSequence(program);
    const result = await askGemini({
      question,
      sequenceText: sequence.text,
      roadmap,
      history: history.slice(-6),
    });
    return NextResponse.json({ text: result.text, source: result.source });
  } catch (error) {
    return NextResponse.json({ error: failureText(error) }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getCareer, getProgram } from "@/lib/careers";
import { loadSequence } from "@/lib/catalog";
import { applyPace, parseStations } from "@/lib/roadmap-doc";
import { runPathwaySwarm } from "@/lib/swarm";

export const maxDuration = 300;

const AUTH_ENV = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "APP_BASE_URL",
] as const;

function auth0EnvMissing(): boolean {
  return AUTH_ENV.some((name) => !process.env[name]?.trim());
}

function failureText(error: unknown): string {
  const message = error instanceof Error ? error.message : "pathway failed";
  const key = process.env.SWARMS_API_KEY?.trim() ?? "";
  if (!key || !message.includes(key)) return message;
  return message.replaceAll(key, "redacted");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { careerId, programId, pace, start } = body as Record<string, unknown>;
  if (pace !== "full-time" && pace !== "part-time") {
    return NextResponse.json(
      { error: "pace must be full-time or part-time" },
      { status: 400 },
    );
  }
  if (start !== "new" && start !== "some-credits") {
    return NextResponse.json(
      { error: "start must be new or some-credits" },
      { status: 400 },
    );
  }

  const career = typeof careerId === "string" ? getCareer(careerId) : undefined;
  const program =
    career && typeof programId === "string"
      ? getProgram(career.id, programId)
      : undefined;
  if (!career || !program) {
    return NextResponse.json({ error: "Unknown career or program" }, { status: 400 });
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
    const stations = applyPace(parseStations(sequence.text), pace);
    const links = {
      ...(sequence.catalogUrl ? { catalog: sequence.catalogUrl } : {}),
      pdf: sequence.pdfUrl,
    };
    try {
      const swarm = await runPathwaySwarm({
        sequenceText: sequence.text,
        careerLabel: career.label,
        programLabel: program.label,
        pace,
        start,
      });
      return NextResponse.json({
        stations,
        agents: swarm.agents,
        status: swarm.status,
        job_id: swarm.job_id,
        execution_time: swarm.execution_time,
        usage: swarm.usage,
        swarmError: null,
        links,
        source: swarm.fromFixture ? "fixture" : sequence.source,
      });
    } catch (error) {
      return NextResponse.json({
        stations,
        agents: [],
        status: "error",
        job_id: "",
        execution_time: 0,
        usage: null,
        swarmError: failureText(error),
        links,
        source: sequence.source,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: failureText(error) }, { status: 502 });
  }
}

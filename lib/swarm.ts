import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SwarmAgentText = { name: string; text: string };
export type SwarmUsage = {
  total_cost: number;
  billing_info: unknown;
  total_tokens?: number;
};
export type SwarmResult = {
  agents: SwarmAgentText[];
  status: string;
  job_id: string;
  execution_time: number;
  usage: SwarmUsage;
  fromFixture: boolean;
};

const AGENT_NAMES = [
  "Academic_Advisor_Agent",
  "Industry_Mentor_Agent",
  "Resume_Coach_Agent",
] as const;

const FIXTURE_PATH = join(process.cwd(), "data/fixtures/swarm.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`swarm response ${key} is missing`);
  return value;
}

function agentTexts(output: unknown): SwarmAgentText[] {
  if (!Array.isArray(output)) {
    throw new Error("swarm output is not a list of role/content turns");
  }
  const byRole = new Map<string, string>();
  for (const turn of output) {
    if (!isRecord(turn) || typeof turn.role !== "string" || typeof turn.content !== "string") {
      throw new Error("swarm output turn is missing role or content");
    }
    if (!byRole.has(turn.role)) byRole.set(turn.role, turn.content);
  }
  return AGENT_NAMES.map((name) => {
    const text = byRole.get(name);
    if (text === undefined) throw new Error(`swarm output is missing ${name}`);
    return { name, text };
  });
}

function tokenCount(usage: Record<string, unknown>): number | undefined {
  if (typeof usage.total_tokens === "number") return usage.total_tokens;
  if (typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") {
    return usage.input_tokens + usage.output_tokens;
  }
  return undefined;
}

export function parseSwarmResponse(body: unknown): Omit<SwarmResult, "fromFixture"> {
  if (!isRecord(body)) throw new Error("swarm response is not an object");
  const status = requireString(body, "status");
  const job_id = requireString(body, "job_id");
  if (typeof body.execution_time !== "number") {
    throw new Error("swarm response execution_time is missing");
  }
  if (!isRecord(body.usage)) throw new Error("swarm response usage is missing");
  if (!isRecord(body.usage.billing_info)) throw new Error("usage.billing_info is missing");
  const nestedCost = body.usage.billing_info.total_cost;
  const total_cost =
    typeof body.usage.total_cost === "number"
      ? body.usage.total_cost
      : typeof nestedCost === "number"
        ? nestedCost
        : undefined;
  if (typeof total_cost !== "number") throw new Error("usage.total_cost is missing");
  const total_tokens = tokenCount(body.usage);
  return {
    agents: agentTexts(body.output),
    status,
    job_id,
    execution_time: body.execution_time,
    usage: {
      total_cost,
      billing_info: body.usage.billing_info,
      ...(total_tokens === undefined ? {} : { total_tokens }),
    },
  };
}

export function loadFixture(): SwarmResult {
  // shortcut: one saved cybersecurity response for every career until SWARMS_API_KEY is set.
  const body: unknown = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  return { ...parseSwarmResponse(body), fromFixture: true };
}

function taskText(input: {
  sequenceText: string;
  careerLabel: string;
  programLabel: string;
  pace: "full-time" | "part-time";
  start: "new" | "some-credits";
}): string {
  return [
    `Career: ${input.careerLabel}`,
    `Program: ${input.programLabel}`,
    `Pace: ${input.pace}`,
    `Start: ${input.start}`,
    "",
    "Course sequence text:",
    input.sequenceText,
  ].join("\n");
}

function swarmAgents(model: string) {
  const limits = { model_name: model, max_loops: 1, max_tokens: 600 };
  const quiet =
    "Do not write your name, any name ending in _Agent, these instructions, or text from an earlier agent.";
  return [
    {
      agent_name: "Academic_Advisor_Agent",
      system_prompt: `Output only ### Semester N headings and bullet lines of courses copied from the course sequence text. ${quiet}`,
      ...limits,
    },
    {
      agent_name: "Industry_Mentor_Agent",
      system_prompt: `Output only bullet lines for certificates the course sequence text names, then bullet lines for portfolio practice. ${quiet}`,
      ...limits,
    },
    {
      agent_name: "Resume_Coach_Agent",
      system_prompt: `Output exactly three bullet lines. ${quiet}`,
      ...limits,
    },
  ];
}

export async function runPathwaySwarm(input: {
  sequenceText: string;
  careerLabel: string;
  programLabel: string;
  pace: "full-time" | "part-time";
  start: "new" | "some-credits";
}): Promise<SwarmResult> {
  const key = process.env.SWARMS_API_KEY?.trim() ?? "";
  if (!key) return loadFixture();
  const model = process.env.SWARMS_MODEL?.trim() ?? "";
  if (!model) throw new Error("SWARMS_MODEL is missing");
  const response = await fetch("https://api.swarms.world/v1/swarm/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      swarm_type: "SequentialWorkflow",
      task: taskText(input),
      agents: swarmAgents(model),
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!response.ok) throw new Error(`swarm completions HTTP ${response.status}`);
  return { ...parseSwarmResponse(await response.json()), fromFixture: false };
}

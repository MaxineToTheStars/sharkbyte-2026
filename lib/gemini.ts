import { bulletLines, plainReply } from "./roadmap-doc.ts";

const REFUSAL = "I can only talk about courses in this program's sequence.";

export { plainReply };

const COURSE_CODE = /\b[A-Z]{3} \d{4}[A-Z]?\b/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function courseCodesOutsideSequence(reply: string, sequenceText: string): string[] {
  const codes = reply.match(COURSE_CODE) ?? [];
  return codes.filter((code) => !sequenceText.includes(code));
}

export function acceptReply(
  reply: string,
  sequenceText: string,
): { text: string; refused: boolean } {
  if (courseCodesOutsideSequence(reply, sequenceText).length === 0) {
    return { text: reply, refused: false };
  }
  return { text: REFUSAL, refused: true };
}

function instructionText(
  sequenceText: string,
  roadmap: { name: string; text: string }[],
): string {
  const mentor = roadmap.find((agent) => agent.name === "Industry_Mentor_Agent");
  const resume = roadmap.find((agent) => agent.name === "Resume_Coach_Agent");
  return [
    "The course sequence is the authority.",
    sequenceText,
    "Certificates and practice",
    bulletLines(mentor?.text ?? "").slice(0, 3).join("\n"),
    "Resume lines",
    bulletLines(resume?.text ?? "").slice(0, 3).join("\n"),
    "A course code that is not in the sequence text must not be included. Do not invent internships or certificates.",
    "Answer in one or two short sentences. Plain text. No markdown, no headings, no bullets, no asterisks, and no agent names.",
  ].join("\n\n");
}

function modelText(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.candidates)) {
    throw new Error("Gemini response text is missing");
  }
  const candidate = body.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) {
    throw new Error("Gemini response text is missing");
  }
  const parts = candidate.content.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini response text is missing");
  const texts: string[] = [];
  for (const part of parts) {
    if (!isRecord(part) || typeof part.text !== "string") continue;
    texts.push(part.text);
  }
  if (texts.length === 0) throw new Error("Gemini response text is missing");
  return texts.join("");
}

export async function askGemini(input: {
  question: string;
  sequenceText: string;
  roadmap: { name: string; text: string }[];
  history: { role: "user" | "model"; text: string }[];
}): Promise<{ text: string; source: "gemini" | "fixture" }> {
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  // Saved reply until GEMINI_API_KEY is set.
  if (!key) {
    return { text: `Saved reply for "${input.question}"`, source: "fixture" };
  }
  const model = process.env.GEMINI_MODEL?.trim() ?? "";
  if (!model) throw new Error("GEMINI_MODEL is missing");

  const history = input.history.slice(-6).map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text.slice(0, 2000) }],
  }));
  const question = input.question.slice(0, 500);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instructionText(input.sequenceText, input.roadmap) }],
          },
          contents: [...history, { role: "user", parts: [{ text: question }] }],
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Gemini took too long");
    }
    throw error;
  }
  if (!response.ok) {
    let detail = `Gemini generateContent HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
        detail = body.error.message.slice(0, 180);
      }
    } catch {
      // Keep the status line when the body is not JSON.
    }
    if (detail.includes(key)) detail = detail.replaceAll(key, "redacted");
    throw new Error(detail);
  }
  const text = plainReply(modelText(await response.json()));
  return { text: acceptReply(text, input.sequenceText).text, source: "gemini" };
}

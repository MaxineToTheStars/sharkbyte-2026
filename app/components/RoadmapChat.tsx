"use client";

import { useEffect, useState, type FormEvent } from "react";
import { plainReply } from "@/lib/roadmap-doc";

export type ChatMessage = { role: "user" | "model"; text: string };

const starters = [
  "Can I go slower?",
  "What if I fail a class?",
  "What can I do before I finish?",
];

export default function RoadmapChat({
  careerId,
  programId,
  roadmap,
  messages,
  onMessages,
  seed,
  onSeedConsumed,
}: {
  careerId: string;
  programId: string;
  roadmap: { name: string; text: string }[];
  messages: ChatMessage[];
  onMessages: (messages: ChatMessage[]) => void;
  seed: string;
  onSeedConsumed: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seed) return;
    setQuestion(seed);
    onSeedConsumed();
  }, [seed]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (pending || !trimmed) return;
    setPending(true);
    setError(null);
    const next = [...messages, { role: "user" as const, text: trimmed }];
    onMessages(next);
    setQuestion("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          careerId,
          programId,
          roadmap,
          history: messages,
        }),
      });
      const body = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
      onMessages([...next, { role: "model", text: body.text ?? "" }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The conductor did not answer");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="ticket flex flex-col p-4" aria-label="Conductor">
        <h2 className="font-extrabold">The Conductor</h2>
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
          {messages.length === 0 &&
            starters.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="focus-ring rounded-full border-2 border-teal px-3 py-1 text-left text-sm"
                onClick={() => void ask(prompt)}
              >
                {prompt}
              </button>
            ))}
          {messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className={`rounded-2xl border-2 px-3 py-2 text-sm ${
                message.role === "model" ? "border-teal bg-surface" : "border-ink bg-bg"
              }`}
            >
              {message.role === "model" ? plainReply(message.text) : message.text}
            </p>
          ))}
          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="conductor-question">
            Ask the conductor
          </label>
          <input
            id="conductor-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            className="focus-ring min-w-0 flex-1 rounded-full border-2 border-ink bg-bg px-3 py-2"
          />
          <button type="submit" className="press focus-ring px-4 py-2 text-sm font-extrabold" disabled={pending}>
            {pending ? "…" : "Send"}
          </button>
        </form>
    </section>
  );
}

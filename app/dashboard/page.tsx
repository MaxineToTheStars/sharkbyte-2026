"use client";

import { useEffect, useState } from "react";
import RoadmapChat, { type ChatMessage } from "@/app/components/RoadmapChat";
import RoadmapSheet, { type Fare } from "@/app/components/RoadmapSheet";
import SiteHeader from "@/app/components/SiteHeader";
import {
  careers,
  getCareer,
  getProgram,
  lineColor,
  type Career,
  type CareerId,
} from "@/lib/careers";
import {
  AP_CHART_URL,
  apPresets,
  mdcPresets,
  normalizeCourseCode,
  stationsHolding,
  unmatchedCodes,
  type CreditPreset,
} from "@/lib/held-credits";
import { stationCodes, type Station } from "@/lib/roadmap-doc";

type Pace = "full-time" | "part-time";
type StartLevel = "new" | "some-credits";

type Selection = {
  careerId: CareerId;
  programId: string;
  pace: Pace;
  start: StartLevel;
};

type PathwayResponse = {
  stations: Station[];
  agents: { name: string; text: string }[];
  status: string;
  job_id: string;
  execution_time: number;
  usage: { total_cost: number; total_tokens?: number } | null;
  swarmError: string | null;
  links: { catalog?: string; pdf: string };
  source: string;
};

type Ticket = {
  selection: Selection;
  result: PathwayResponse;
  done: string[];
  held: string[];
  chat: ChatMessage[];
  shared: string[];
};

const STORAGE_KEY = "majorly-lost:ticket";

const questions = [
  "Where are you headed?",
  "How fast do you want to ride?",
  "Where are you starting?",
];

function readTicket(): Ticket | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Ticket>;
    if (!parsed.selection || !parsed.result?.stations) return null;
    if (!getCareer(parsed.selection.careerId)) return null;
    if (!getProgram(parsed.selection.careerId, parsed.selection.programId)) return null;
    return {
      selection: parsed.selection,
      result: parsed.result,
      done: parsed.done ?? [],
      held: parsed.held ?? [],
      chat: parsed.chat ?? [],
      shared: parsed.shared ?? [],
    };
  } catch {
    return null;
  }
}

function CreditChip({
  preset,
  held,
  onToggle,
}: {
  preset: CreditPreset;
  held: string[];
  onToggle: (codes: string[]) => void;
}) {
  const pressed = preset.codes.every((code) => held.includes(code));
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`ticket focus-ring px-3 py-2 text-left text-sm font-extrabold ${
        pressed ? "ticket-on" : ""
      }`}
      onClick={() => onToggle(preset.codes)}
    >
      {preset.label}
      <span className="mt-1 block font-mono text-xs font-medium">{preset.codes.join(", ")}</span>
    </button>
  );
}

export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection>({
    careerId: careers[0].id,
    programId: careers[0].programs[0].id,
    pace: "full-time",
    start: "new",
  });
  const [tapped, setTapped] = useState([false, false, false]);
  const [result, setResult] = useState<PathwayResponse | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [shared, setShared] = useState<string[]>([]);
  const [fork, setFork] = useState<Career | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState("");

  useEffect(() => {
    const saved = readTicket();
    if (saved) {
      setSelection(saved.selection);
      setResult(saved.result);
      setDone(saved.done);
      setHeld(saved.held);
      setChat(saved.chat);
      setShared(saved.shared);
    }
    setReady(true);
  }, []);

  function save(next: Ticket) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A full disk should not block the map already on screen.
    }
  }

  async function ride(next: Selection, switching: boolean) {
    setPending(true);
    setError(null);
    setFork(null);
    const previous = switching && result ? stationCodes(result.stations) : [];
    try {
      const response = await fetch("/api/pathway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await response.json()) as PathwayResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
      const kept = next.start === "some-credits" ? held : [];
      const ticket: Ticket = {
        selection: next,
        result: body,
        done: stationsHolding(body.stations, kept),
        held: kept,
        chat: [],
        shared: previous,
      };
      setSelection(next);
      setResult(body);
      setDone(ticket.done);
      setHeld(kept);
      setChat([]);
      setShared(previous);
      save(ticket);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The line did not draw");
    } finally {
      setPending(false);
    }
  }

  function markStep(index: number) {
    setTapped((current) => current.map((value, item) => (item === index ? true : value)));
  }

  function chooseProgram(career: Career, programId: string) {
    setSelection((current) => ({ ...current, careerId: career.id, programId }));
    markStep(0);
  }

  function choosePace(pace: Pace) {
    setSelection((current) => ({ ...current, pace }));
    markStep(1);
  }

  function chooseStart(start: StartLevel) {
    setSelection((current) => ({ ...current, start }));
    if (start === "new") {
      setHeld([]);
      setCodeDraft("");
      setCodeError(null);
    }
    markStep(2);
  }

  function toggleHeld(codes: string[]) {
    setHeld((current) => {
      const hasAll = codes.every((code) => current.includes(code));
      if (hasAll) return current.filter((code) => !codes.includes(code));
      return [...new Set([...current, ...codes])];
    });
  }

  function addHeldCode() {
    const code = normalizeCourseCode(codeDraft);
    if (!code) {
      setCodeError("Use a course code like ENC 1101.");
      return;
    }
    setCodeError(null);
    setCodeDraft("");
    setHeld((current) => (current.includes(code) ? current : [...current, code]));
  }

  function goNext() {
    if (!tapped[step]) return;
    if (step < 2) {
      setStep((value) => value + 1);
      return;
    }
    void ride(selection, false);
  }

  function beginSwitch(id: CareerId) {
    const career = getCareer(id);
    if (!career || pending) return;
    if (career.programs.length > 1) {
      setFork(career);
      return;
    }
    void ride(
      { ...selection, careerId: id, programId: career.programs[0].id },
      true,
    );
  }

  const program = getProgram(selection.careerId, selection.programId);
  const fare: Fare | null = result
    ? {
        status: result.status,
        job_id: result.job_id,
        execution_time: result.execution_time,
        usage: result.usage,
        swarmError: result.swarmError,
        source: result.source,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader mode="app" />
      <main
        className={
          ready && !pending && result && program && fare
            ? "w-full flex-1"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
        }
      >
        {!ready ? null : pending ? (
          <div aria-live="polite">
            <h1 className="text-3xl font-extrabold">Drawing your line.</h1>
            <p className="mt-2 text-muted">
              This can take a couple of minutes. Keep this tab open.
            </p>
            <div className="relative mt-8 max-w-xl pl-10">
              <span
                aria-hidden="true"
                className="route-line absolute top-2 bottom-2 left-[11px] w-1 bg-accent"
              />
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="ticket mb-4 h-16" />
              ))}
            </div>
          </div>
        ) : result && program && fare ? (
          <div>
              <div
                className="mx-auto flex max-w-6xl flex-nowrap items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6"
                role="group"
                aria-label="Switch lines"
              >
                {careers.map((career) => (
                  <button
                    key={career.id}
                    type="button"
                    aria-pressed={career.id === selection.careerId}
                    onClick={() => beginSwitch(career.id)}
                    className={`focus-ring inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold ${
                      career.id === selection.careerId ? "ticket-on" : "bg-surface"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border-2 border-ink"
                      style={{ background: lineColor[career.id] }}
                    />
                    {career.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="focus-ring ml-auto shrink-0 text-sm font-medium underline-offset-4 hover:underline"
                  onClick={() => {
                    setResult(null);
                    setStep(0);
                    setError(null);
                  }}
                >
                  Change route
                </button>
              </div>
              {fork && (
                <div className="mx-auto mb-3 flex max-w-6xl flex-wrap gap-2 px-4 sm:px-6">
                  {fork.programs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={
                        selection.careerId === fork.id && selection.programId === item.id
                      }
                      className={`focus-ring ticket px-4 py-4 text-left text-sm font-extrabold ${
                        selection.careerId === fork.id && selection.programId === item.id
                          ? "ticket-on"
                          : ""
                      }`}
                      onClick={() =>
                        void ride(
                          {
                            ...selection,
                            careerId: fork.id,
                            programId: item.id,
                          },
                          true,
                        )
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="mx-auto mb-3 max-w-6xl px-4 text-sm text-accent sm:px-6">
                  {error}
                </p>
              )}
              <RoadmapSheet
                stations={result.stations}
                agents={result.agents}
                careerId={selection.careerId}
                programTitle={program.catalogTitle}
                note={program.note}
                links={result.links}
                fare={fare}
                shared={shared}
                done={done}
                onToggle={(key) => {
                  const nextDone = done.includes(key)
                    ? done.filter((item) => item !== key)
                    : [...done, key];
                  setDone(nextDone);
                  save({ selection, result, done: nextDone, held, chat, shared });
                }}
                onAsk={(code) => setSeed(`Why does ${code} come here?`)}
              />
            <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
              {selection.start === "some-credits" &&
                unmatchedCodes(result.stations, held).length > 0 && (
                  <p className="mt-4 text-sm">
                    On your record, not on this line:{" "}
                    {unmatchedCodes(result.stations, held).join(", ")}
                  </p>
                )}
              <div className="mt-8">
                <RoadmapChat
                  careerId={selection.careerId}
                  programId={selection.programId}
                  roadmap={result.agents}
                  messages={chat}
                  onMessages={(messages) => {
                    setChat(messages);
                    save({ selection, result, done, held, chat: messages, shared });
                  }}
                  seed={seed}
                  onSeedConsumed={() => setSeed("")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-sm text-muted">
              {step + 1} of {questions.length}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold">{questions[step]}</h1>
            {error && (
              <p role="alert" className="mt-4 text-sm text-accent">
                {error}
              </p>
            )}
            {step > 0 && (
              <button
                type="button"
                className="focus-ring mt-4 text-sm underline-offset-4 hover:underline"
                onClick={() => setStep((value) => value - 1)}
              >
                Back
              </button>
            )}
            {step === 0 && (
              <div className="mt-6 grid gap-3">
                {careers.map((career) => (
                  <div key={career.id} className="ticket overflow-hidden">
                    <div className="flex items-center gap-3 px-4 pt-4 font-extrabold">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-ink"
                        style={{ background: lineColor[career.id] }}
                      />
                      {career.label}
                    </div>
                    <div className="mt-2 flex flex-col border-t-2 border-ink">
                      {career.programs.map((item) => {
                        const pressed =
                          tapped[0] &&
                          selection.careerId === career.id &&
                          selection.programId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={pressed}
                            className={`focus-ring w-full border-t-2 border-ink px-4 py-4 text-left font-extrabold first:border-t-0 ${
                              pressed ? "ticket-on" : ""
                            }`}
                            onClick={() => chooseProgram(career, item.id)}
                          >
                            {item.label}
                            {item.note ? ` — ${item.note}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="mt-6 grid gap-3">
                {(
                  [
                    ["full-time", "Full-time express"],
                    ["part-time", "Part-time local"],
                  ] as const
                ).map(([value, label]) => {
                  const pressed = tapped[1] && selection.pace === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={pressed}
                      className={`ticket focus-ring px-4 py-4 text-left font-extrabold ${
                        pressed ? "ticket-on" : ""
                      }`}
                      onClick={() => choosePace(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {step === 2 && (
              <div className="mt-6 grid gap-3">
                {(
                  [
                    ["new", "New student"],
                    ["some-credits", "Some credits"],
                  ] as const
                ).map(([value, label]) => {
                  const pressed = tapped[2] && selection.start === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={pressed}
                      className={`ticket focus-ring px-4 py-4 text-left font-extrabold ${
                        pressed ? "ticket-on" : ""
                      }`}
                      onClick={() => chooseStart(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {step === 2 && tapped[2] && selection.start === "some-credits" && (
              <div className="mt-6">
                <h2 className="font-extrabold">Already on an MDC transcript</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mdcPresets.map((preset) => (
                    <CreditChip
                      key={preset.label}
                      preset={preset}
                      held={held}
                      onToggle={toggleHeld}
                    />
                  ))}
                </div>
                <h2 className="mt-6 font-extrabold">AP exam, score 3</h2>
                <p className="mt-1 text-sm text-muted">
                  From the{" "}
                  <a className="underline-offset-4 hover:underline" href={AP_CHART_URL}>
                    MDC AP chart
                  </a>
                  . Higher scores are not listed.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {apPresets.map((preset) => (
                    <CreditChip
                      key={preset.label}
                      preset={preset}
                      held={held}
                      onToggle={toggleHeld}
                    />
                  ))}
                </div>
                <form
                  className="mt-6 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addHeldCode();
                  }}
                >
                  <label className="sr-only" htmlFor="held-code">
                    Course code
                  </label>
                  <input
                    id="held-code"
                    value={codeDraft}
                    onChange={(event) => setCodeDraft(event.target.value)}
                    placeholder="ENC 1101"
                    className="focus-ring min-w-0 flex-1 rounded-full border-2 border-ink bg-surface px-4 py-3"
                  />
                  <button type="submit" className="press focus-ring px-4 py-3 text-sm font-extrabold">
                    Add
                  </button>
                </form>
                {codeError && (
                  <p role="alert" className="mt-2 text-sm text-accent">
                    {codeError}
                  </p>
                )}
                {held.length > 0 && (
                  <p className="mt-3 text-sm">{held.join(", ")}</p>
                )}
              </div>
            )}
            <button
              type="button"
              className="press focus-ring mt-6 px-5 py-3 text-base font-extrabold disabled:opacity-40"
              disabled={!tapped[step]}
              onClick={goNext}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

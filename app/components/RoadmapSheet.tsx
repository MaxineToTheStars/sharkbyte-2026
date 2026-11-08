"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { lineColor, type CareerId } from "@/lib/careers";
import { bulletLines, type Station } from "@/lib/roadmap-doc";

export type Fare = {
  status: string;
  job_id: string;
  execution_time: number;
  usage: { total_cost: number; total_tokens?: number } | null;
  swarmError: string | null;
  source: string;
};

function chipLabel(group: Station["groups"][number]): string {
  const first = group.courses[0].code;
  if (group.mode === "one" && group.courses.length > 1) {
    const extra = group.courses.length - 1;
    return `${first}, or ${extra} other${extra === 1 ? "" : "s"}`;
  }
  if (group.courses.length === 1) return first;
  return group.courses.map((course) => course.code).join(" + ");
}

const STEP = 320;
const PAD = 180;

function stationPoints(count: number, height: number) {
  const high = Math.round(height * 0.32);
  const low = Math.round(height * 0.68);
  return Array.from({ length: count }, (_, index) => ({
    x: PAD + index * STEP,
    y: index % 2 === 0 ? high : low,
  }));
}

function wavePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const bend = (previous.x + next.x) / 2;
    path += ` C ${bend} ${previous.y}, ${bend} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export default function RoadmapSheet({
  stations,
  agents,
  careerId,
  programTitle,
  note,
  links,
  fare,
  shared,
  done,
  onToggle,
  onAsk,
}: {
  stations: Station[];
  agents: { name: string; text: string }[];
  careerId: CareerId;
  programTitle: string;
  note?: string;
  links: { catalog?: string; pdf: string };
  fare: Fare;
  shared: string[];
  done: string[];
  onToggle: (key: string) => void;
  onAsk: (code: string) => void;
}) {
  const color = lineColor[careerId];
  const practice = bulletLines(
    agents.find((agent) => agent.name === "Industry_Mentor_Agent")?.text ?? "",
  ).slice(0, 3);
  const resume = bulletLines(
    agents.find((agent) => agent.name === "Resume_Coach_Agent")?.text ?? "",
  ).slice(0, 3);
  const sharedSet = new Set(shared);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(352);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setHeight(node.clientHeight || 352);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const points = stationPoints(stations.length, height);
  const width = PAD * 2 + Math.max(stations.length - 1, 0) * STEP;
  const path = wavePath(points);

  return (
    <div>
      <div className="route-stage">
        <div className="route-scroll" ref={scrollRef}>
          <div className="route-track" style={{ width, height }}>
            <svg
              className="route-wave"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
            >
              <path
                className="route-wave-line"
                pathLength={1}
                d={path}
                stroke={color}
              />
            </svg>
            {path && (
              <span
                className="route-rider"
                style={{ offsetPath: `path('${path}')` }}
              />
            )}
            <ol className="m-0 list-none p-0">
              {stations.map((station, index) => {
                const key = String(index);
                const passed = done.includes(key);
                const point = points[index];
                return (
                  <li
                    key={key}
                    className="route-stop"
                    style={{ left: point.x, top: point.y }}
                  >
                    <button
                      type="button"
                      aria-pressed={passed}
                      onClick={() => onToggle(key)}
                      className="route-dot focus-ring h-6 w-6 rounded-full border-[3px] border-ink"
                      style={{ background: passed ? "#0E8C8A" : "#FFFCF5" }}
                    >
                      <span className="sr-only">
                        {passed ? "Mark not taken" : "Mark already taken"}: {station.label}
                      </span>
                    </button>
                    <article
                      className={`route-card ticket p-3 ${
                        index % 2 === 0 ? "route-card-under" : "route-card-over"
                      }`}
                    >
                      <h2 className="font-extrabold">{station.label}</h2>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {station.groups.map((group) => {
                          const codes = group.courses.map((course) => course.code).join("-");
                          const both = group.courses.some((course) =>
                            sharedSet.has(course.code),
                          );
                          return (
                            <li
                              key={codes}
                              className="flex items-center gap-1 rounded-full border-2 border-ink px-2 py-1 font-mono text-xs"
                            >
                              <span>{chipLabel(group)}</span>
                              {both && (
                                <span className="font-sans font-medium text-teal">both</span>
                              )}
                              <button
                                type="button"
                                className="focus-ring font-sans text-sm font-extrabold"
                                onClick={() => onAsk(group.courses[0].code)}
                              >
                                ?
                                <span className="sr-only"> about {group.courses[0].code}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <button
          type="button"
          className="route-down focus-ring"
          aria-label="Details below"
          onClick={() =>
            document.getElementById("route-detail")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M4 7l5 5 5-5"
              fill="none"
              stroke="#1C1B18"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <section id="route-detail" className="mx-auto mt-8 max-w-6xl px-4 pb-4 sm:px-6">
        <div className="ticket p-4" style={{ borderColor: color }}>
        <h2 className="text-2xl font-extrabold">{programTitle}</h2>
        {note && <p className="mt-2 text-sm">{note}</p>}
        {practice.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {practice.map((line) => (
              <li key={line} className="rounded-full border-2 border-ink px-3 py-1 text-sm">
                {line}
              </li>
            ))}
          </ul>
        )}
        {resume.length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-sm">
            {resume.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
          {links.catalog && (
            <a className="focus-ring underline-offset-4 hover:underline" href={links.catalog}>
              Catalog program
            </a>
          )}
          <a className="focus-ring underline-offset-4 hover:underline" href={links.pdf}>
            Curriculum PDF
          </a>
        </div>
        </div>
        <p className="mt-4 font-mono text-xs text-muted">
          {fare.swarmError
            ? fare.swarmError
            : `${fare.status} · ${fare.execution_time} · ${
                fare.usage ? `$${fare.usage.total_cost}` : "no cost"
              }${fare.usage?.total_tokens ? ` · ${fare.usage.total_tokens} tokens` : ""} · ${fare.job_id || "no job"} · ${fare.source}`}
        </p>
      </section>
    </div>
  );
}

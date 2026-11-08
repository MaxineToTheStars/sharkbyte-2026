"use client";

import { useEffect, useState } from "react";
import { careers, lineColor, type CareerId } from "@/lib/careers";

const origin = { x: 72, y: 200 };

const shortName: Record<CareerId, string> = {
  architecture: "Arch",
  mechanical: "Mech",
  culinary: "Chef",
  cybersecurity: "Cyber",
  it: "IT",
};

export default function LineMap() {
  const [locked, setLocked] = useState<CareerId | null>(null);
  const [hover, setHover] = useState<CareerId | null>(null);
  const [fine, setFine] = useState(false);
  const active = fine ? (hover ?? locked) : locked;

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 640 400"
        className="h-auto min-w-[560px] w-full"
        role="img"
        aria-label="Five career lines leaving Miami Dade College"
      >
        {careers.map((career, index) => {
          const y = 36 + index * 82;
          const dim = active !== null && active !== career.id;
          const lockedOn = locked === career.id;
          return (
            <g
              key={career.id}
              opacity={dim ? 0.3 : 1}
              onMouseEnter={() => {
                if (fine) setHover(career.id);
              }}
              onMouseLeave={() => {
                if (fine) setHover(null);
              }}
              onClick={() => setLocked(career.id)}
              className="cursor-pointer"
            >
              <path
                d={`M ${origin.x} ${origin.y} C 240 ${origin.y}, 300 ${y}, 470 ${y}`}
                fill="none"
                stroke={lineColor[career.id]}
                strokeWidth={active === career.id ? 8 : 4}
                strokeLinecap="round"
                pathLength={1}
                className={lockedOn ? "line-draw" : undefined}
              />
              <circle
                className={lockedOn && fine ? "line-dot station-pop" : "line-dot"}
                cx="470"
                cy={y}
                r="9"
                fill={lineColor[career.id]}
                stroke="#1C1B18"
                strokeWidth="3"
              />
              <text x="488" y={y + 5} fill="#1C1B18" fontSize="16" fontWeight="700">
                {shortName[career.id]}
              </text>
            </g>
          );
        })}
        <circle
          cx={origin.x}
          cy={origin.y}
          r="16"
          fill="#FF5A1F"
          stroke="#1C1B18"
          strokeWidth="3"
        />
        <text x="36" y="236" fill="#1C1B18" fontSize="14" fontWeight="700">
          MDC
        </text>
      </svg>
    </div>
  );
}

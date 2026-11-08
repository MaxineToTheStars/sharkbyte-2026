const CODE = /^[A-Z]{3} \d{4}[A-Z]?$/;
const CODE_IN_TEXT = /[A-Z]{3} \d{4}[A-Z]?/g;
const LEAKED_INSTRUCTION =
  /_Agent\b|output only\b|no introduction\b|no name\b|no rules\b|system prompt\b|these instructions\b|earlier agent\b|^(?:you are|write markdown|do not)\b/i;

export type Course = { code: string; title: string };

export type CourseGroup = {
  label: string | null;
  mode: "one" | "all";
  courses: Course[];
};

export type Station = { label: string; groups: CourseGroup[] };

function isLeaked(line: string): boolean {
  const trimmed = line.trim().replace(/^[-*]\s+/, "").replace(/^#+\s*/, "");
  return trimmed.length > 0 && LEAKED_INSTRUCTION.test(trimmed);
}

function stripMarkdown(line: string): string {
  return line
    .replace(/`+/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripLeakedInstructions(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isLeaked(line))
    .join("\n");
}

export function bulletLines(text: string): string[] {
  return stripLeakedInstructions(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => stripMarkdown(line.replace(/^[-*]\s+/, "")))
    .filter((line) => line.length > 0);
}

export function plainReply(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\b[A-Za-z]+_Agent\b/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/.test(line) && !isLeaked(line))
    .map((line) => stripMarkdown(line.replace(/^[-*]\s+/, "")))
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [];
  const rest = cleaned.replace(/[^.!?]+[.!?]+/g, "").trim();
  const parts = sentences.map((sentence) => sentence.trim());
  if (parts.length < 2 && rest) parts.push(rest);
  return parts.filter(Boolean).slice(0, 2).join(" ");
}

function cleanTitle(line: string): string {
  return line
    .replace(/\s+\(\s*(?:Active|In Review|Historical)\s*\)\s*\*?\s*$/i, "")
    .replace(/\s*\*$/, "")
    .trim();
}

function guideTitle(rest: string): string {
  const withoutNote = rest.replace(/\s+Note:.*$/i, "");
  const withoutReq = withoutNote
    .replace(/\s+Pre\/Corequisite:.*$/i, "")
    .replace(/\s+Prerequisite:.*$/i, "");
  return withoutReq.replace(/\s+\d{1,2}$/, "").trim();
}

function parseGuide(text: string): Station[] {
  const raw = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];
  for (const line of raw) {
    const prev = lines[lines.length - 1];
    if (prev && prev.endsWith(",")) lines[lines.length - 1] = `${prev} ${line}`;
    else lines.push(line);
  }

  const stations: Station[] = [];
  let station: Station | null = null;
  let orNext = false;
  for (const line of lines) {
    const semester = /^Semester (\d+)$/.exec(line);
    if (semester) {
      station = { label: `Semester ${semester[1]}`, groups: [] };
      stations.push(station);
      orNext = false;
      continue;
    }
    if (/^Semester Credits\b/.test(line) || /^Program Total\b/.test(line)) {
      station = null;
      continue;
    }
    if (!station || /^Course ID\b/.test(line)) continue;
    if (/^Prerequisite:/i.test(line) || /^Departmental/i.test(line)) continue;
    if (/^\d+\s/.test(line)) continue;
    if (line === "---OR---") {
      orNext = true;
      continue;
    }

    const lead = /^([A-Z]{3} \d{4}[A-Z]?)\s+(.+)$/.exec(line);
    if (lead) {
      station.groups.push({
        label: null,
        mode: "all",
        courses: [{ code: lead[1], title: guideTitle(lead[2]) }],
      });
      orNext = false;
      continue;
    }

    if (CODE.test(line)) {
      station.groups.push({
        label: null,
        mode: orNext ? "one" : "all",
        courses: [{ code: line, title: line }],
      });
      orNext = false;
      continue;
    }

    const body = line.replace(/\s+Note:.*$/i, "");
    const codes = body.match(CODE_IN_TEXT) ?? [];
    if (codes.length === 0) continue;
    const label = body.slice(0, body.search(CODE_IN_TEXT)).replace(/[, ]+$/, "").trim();
    station.groups.push({
      label: label || null,
      mode: "one",
      courses: codes.map((code) => ({ code, title: code })),
    });
    orNext = false;
  }
  return stations;
}

function parseCatalog(text: string): Station[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const stations: Station[] = [];
  let station: Station | null = null;
  let nextNumber = 1;
  let label: string | null = null;
  let connector: "or" | "and" | null = null;

  function pushCourse(course: Course) {
    if (!station) return;
    const last = station.groups[station.groups.length - 1];
    if (connector && last) {
      last.mode = connector === "or" ? "one" : "all";
      last.courses.push(course);
    } else {
      station.groups.push({
        label,
        mode: "all",
        courses: [course],
      });
      label = null;
    }
    connector = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const numbered = /^Semester (\d+)$/.exec(line);
    if (numbered || line === "Semester") {
      const number = numbered ? Number(numbered[1]) : nextNumber;
      nextNumber = number + 1;
      station = { label: `Semester ${number}`, groups: [] };
      stations.push(station);
      label = null;
      connector = null;
      continue;
    }
    if (!station) continue;
    if (/^Units:/.test(line) || /^Total\s*:/.test(line) || /^\d+\.\d+$/.test(line)) {
      continue;
    }
    if (line === "OR") {
      connector = "or";
      continue;
    }
    if (line === "AND") {
      connector = "and";
      continue;
    }
    if (line.startsWith("*")) continue;
    if (CODE.test(line)) {
      const titleLine = lines[index + 1];
      if (titleLine && !CODE.test(titleLine) && titleLine !== "OR" && titleLine !== "AND") {
        pushCourse({ code: line, title: cleanTitle(titleLine) });
        index += 1;
        if (/^\d+\.\d+$/.test(lines[index + 1] ?? "")) index += 1;
      } else {
        pushCourse({ code: line, title: line });
      }
      continue;
    }
    label = line.replace(/\s*\*$/, "").trim();
  }
  return stations;
}

export function parseStations(text: string): Station[] {
  if (text.includes("COURSE SEQUENCE GUIDE")) return parseGuide(text);
  return parseCatalog(text);
}

export function applyPace(
  stations: Station[],
  pace: "full-time" | "part-time",
): Station[] {
  if (pace === "full-time") return stations;
  const local: Station[] = [];
  for (const station of stations) {
    if (station.groups.length < 2) {
      local.push({ ...station, label: `${station.label} · local` });
      continue;
    }
    const mid = Math.ceil(station.groups.length / 2);
    local.push({
      label: `${station.label} · local`,
      groups: station.groups.slice(0, mid),
    });
    local.push({
      label: `${station.label} · local, continued`,
      groups: station.groups.slice(mid),
    });
  }
  return local;
}

export function stationCodes(stations: Station[]): string[] {
  const codes = stations.flatMap((station) =>
    station.groups.flatMap((group) => group.courses.map((course) => course.code)),
  );
  return [...new Set(codes)];
}

export function sharedCodes(left: Station[], right: Station[]): string[] {
  const other = new Set(stationCodes(right));
  return stationCodes(left).filter((code) => other.has(code));
}

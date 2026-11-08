import { stationCodes, type Station } from "./roadmap-doc.ts";

const CODE = /^[A-Z]{3} \d{4}[A-Z]?$/;

export const AP_CHART_URL =
  "https://www.mdc.edu/media/miami-dade-college/testing-and-assessment/documents/AP_Chart_Effective_112025.pdf";

export type CreditPreset = { label: string; codes: string[] };

export const mdcPresets: CreditPreset[] = [
  { label: "English Composition 1", codes: ["ENC 1101"] },
  { label: "English Composition 2", codes: ["ENC 1102"] },
  { label: "College Algebra", codes: ["MAC 1105"] },
  { label: "Computer Technology", codes: ["CGS 1060C"] },
  { label: "American Government", codes: ["POS 2041"] },
  { label: "Statistical Methods", codes: ["STA 2023"] },
  { label: "First Year Experience", codes: ["SLS 1106"] },
];

// shortcut: score 4 and 5 are omitted, add those rows when a student needs the higher award.
export const apPresets: CreditPreset[] = [
  { label: "AP English Language", codes: ["ENC 1101"] },
  { label: "AP Calculus AB", codes: ["MAC 2311"] },
  { label: "AP Statistics", codes: ["STA 2023"] },
  { label: "AP US Government", codes: ["POS 2041"] },
  { label: "AP Psychology", codes: ["PSY 2012"] },
  { label: "AP Computer Science Principles", codes: ["COP 1000"] },
  { label: "AP Environmental Science", codes: ["EVR 1001"] },
  { label: "AP Macroeconomics", codes: ["ECO 2013"] },
  { label: "AP Microeconomics", codes: ["ECO 2023"] },
  { label: "AP Biology", codes: ["BSC 1005", "BSC 1005L"] },
  { label: "AP Physics 1", codes: ["PHY 2053", "PHY 2053L"] },
  { label: "AP Seminar", codes: ["IDS 1350"] },
  { label: "AP 2-D Art and Design", codes: ["ART 1201"] },
];

export function normalizeCourseCode(raw: string): string | null {
  const tight = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = /^([A-Z]{3})(\d{4}[A-Z]?)$/.exec(tight);
  if (!match) return null;
  const code = `${match[1]} ${match[2]}`;
  return CODE.test(code) ? code : null;
}

export function stationsHolding(stations: Station[], codes: string[]): string[] {
  const held = new Set(codes);
  const marked: string[] = [];
  stations.forEach((station, index) => {
    const hit = station.groups.some((group) =>
      group.courses.some((course) => held.has(course.code)),
    );
    if (hit) marked.push(String(index));
  });
  return marked;
}

export function unmatchedCodes(stations: Station[], codes: string[]): string[] {
  const onRoute = new Set(stationCodes(stations));
  return codes.filter((code) => !onRoute.has(code));
}

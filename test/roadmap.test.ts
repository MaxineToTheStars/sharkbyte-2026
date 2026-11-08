import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyPace,
  bulletLines,
  parseStations,
  sharedCodes,
  stationCodes,
} from "../lib/roadmap-doc.ts";

function readCsg(name: string): string {
  return readFileSync(new URL(`../data/csg/${name}`, import.meta.url), "utf8");
}

test("cyber AS semester 1 keeps ENC 1101, CTS 1134, and one math choice", () => {
  const stations = parseStations(readCsg("cyber-as.txt"));
  const first = stations[0];
  assert.equal(first.label, "Semester 1");
  const codes = stationCodes([first]);
  assert.ok(codes.includes("ENC 1101"));
  assert.ok(codes.includes("CTS 1134"));
  const writing = first.groups.find((group) =>
    group.courses.some((course) => course.code === "ENC 1101"),
  );
  assert.equal(writing?.courses[0].title, "English Composition 1");
  const math = first.groups.find((group) =>
    group.courses.some((course) => course.code === "MAC 1105"),
  );
  assert.equal(math?.mode, "one");
  assert.deepEqual(
    math?.courses.map((course) => course.code),
    ["MAC 1105", "STA 2023"],
  );
});

test("part-time splits four groups and keeps an OR pair together", () => {
  const first = parseStations(readCsg("cyber-as.txt"))[0];
  assert.equal(first.groups.length, 4);
  const local = applyPace([first], "part-time");
  assert.equal(local.length, 2);
  assert.equal(local[0].label, "Semester 1 · local");
  const together = local.find((station) =>
    station.groups.some(
      (group) =>
        group.courses.some((course) => course.code === "MAC 1105") &&
        group.courses.some((course) => course.code === "STA 2023"),
    ),
  );
  assert.ok(together);
  const split = local.filter((station) =>
    station.groups.some(
      (group) =>
        group.courses.some((course) => course.code === "MAC 1105") !==
        group.courses.some((course) => course.code === "STA 2023"),
    ),
  );
  assert.equal(split.length, 0);
});

test("architecture AS guide starts at ARC 1115 and skips the prerequisite line", () => {
  const stations = parseStations(readCsg("arch-as.txt"));
  assert.equal(stations[0].label, "Semester 1");
  assert.equal(stations[0].groups[0].courses[0].code, "ARC 1115");
  assert.equal(stations[0].groups[0].courses[0].title, "Architectural Communications 1");
  const codes = stationCodes(stations);
  assert.equal(codes.includes("MAT 1033"), false);
  assert.equal(codes.filter((code) => code === "ARC 1115").length, 1);
  const last = stations[stations.length - 1];
  const science = last.groups.find((group) =>
    group.courses.some((course) => course.code === "PHY 2053"),
  );
  assert.equal(
    science?.courses.some((course) => course.code === "CGS 1060C"),
    false,
  );
  assert.ok(stationCodes([last]).includes("CGS 1060C"));
});

test("mechanical AA bare Semester header is semester 2", () => {
  const stations = parseStations(readCsg("mech-aa.txt"));
  assert.equal(stations[1].label, "Semester 2");
  assert.ok(stationCodes([stations[1]]).includes("ENC 1102"));
});

test("shared codes are the intersection", () => {
  const cyber = parseStations(readCsg("cyber-as.txt"));
  const it = parseStations(readCsg("it-as.txt"));
  const shared = sharedCodes(cyber, it);
  assert.ok(shared.includes("CTS 1134"));
  assert.ok(shared.includes("ENC 1101"));
});

test("leaked agent transcript keeps only the real bullets", () => {
  const leaked = [
    "Academic_Advisor_Agent",
    "Output only ### Semester N headings and bullet lines of courses from the course sequence text. No name. No rules. No introduction.",
    "",
    "- Academic_Advisor_Agent: Output only the courses",
    "- Linux+ on CTS 1111",
    "- A networking lab from CTS 1134",
    "* **CySA+** on CIS 2350",
  ].join("\n");
  assert.deepEqual(bulletLines(leaked), [
    "Linux+ on CTS 1111",
    "A networking lab from CTS 1134",
    "CySA+ on CIS 2350",
  ]);
});

test("AND keeps both lab and lecture", () => {
  const stations = parseStations(
    [
      "Semester 1",
      "PHY 2053",
      "Physics ( Active )",
      "3.0",
      "AND",
      "PHY 2053L",
      "Physics Lab ( Active )",
      "1.0",
    ].join("\n"),
  );
  assert.equal(stations[0].groups.length, 1);
  assert.equal(stations[0].groups[0].mode, "all");
  assert.deepEqual(
    stations[0].groups[0].courses.map((course) => course.code),
    ["PHY 2053", "PHY 2053L"],
  );
});

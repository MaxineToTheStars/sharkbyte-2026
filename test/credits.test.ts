import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  normalizeCourseCode,
  stationsHolding,
  unmatchedCodes,
} from "../lib/held-credits.ts";
import { parseStations } from "../lib/roadmap-doc.ts";

test("ENC 1101 marks cyber AS semester 1 and ART 1201 marks nothing", () => {
  const text = readFileSync(new URL("../data/csg/cyber-as.txt", import.meta.url), "utf8");
  const stations = parseStations(text);
  assert.deepEqual(stationsHolding(stations, ["ENC 1101"]), ["0"]);
  assert.equal(stations[0].label, "Semester 1");
  assert.deepEqual(stationsHolding(stations, ["ART 1201"]), []);
  assert.deepEqual(unmatchedCodes(stations, ["ART 1201", "ENC 1101"]), ["ART 1201"]);
});

test("a course code needs three letters and four digits", () => {
  assert.equal(normalizeCourseCode("enc1101"), "ENC 1101");
  assert.equal(normalizeCourseCode("CGS 1060C"), "CGS 1060C");
  assert.equal(normalizeCourseCode("nope"), null);
});

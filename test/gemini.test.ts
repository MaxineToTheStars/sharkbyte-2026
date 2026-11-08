import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptReply, plainReply } from "../lib/gemini.ts";

test("acceptReply refuses a course code absent from the sequence", () => {
  const result = acceptReply("Take CIS 9999 next term.", "CTS 1134");
  assert.equal(result.refused, true);
  assert.equal(result.text, "I can only talk about courses in this program's sequence.");
});

test("plainReply keeps two sentences and drops markdown", () => {
  const text = plainReply(
    "# Pace\n\n**Start** with CTS 1134. Then take CIS 1531. Ignore the rest of this.",
  );
  assert.equal(text, "Start with CTS 1134. Then take CIS 1531.");
});

test("acceptReply still refuses a course code hidden in markdown", () => {
  const plain = plainReply("Take **CIS 9999** next. Then CTS 1134.");
  const result = acceptReply(plain, "CTS 1134");
  assert.equal(result.refused, true);
  assert.equal(result.text, "I can only talk about courses in this program's sequence.");
});

test("acceptReply keeps a reply whose only course code is in the sequence", () => {
  const reply = "Start with CTS 1134.";
  const result = acceptReply(reply, "Semester 1 includes CTS 1134.");
  assert.equal(result.refused, false);
  assert.equal(result.text, reply);
});

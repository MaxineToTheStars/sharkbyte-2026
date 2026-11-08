import assert from "node:assert/strict";
import { test } from "node:test";
import { auth0Ready, blockedWithoutAuth } from "../lib/auth-gate.ts";
import { chooseSequence } from "../lib/catalog.ts";
import { loadFixture } from "../lib/swarm.ts";

test("fixture usage.total_cost is 0.0485", () => {
  const result = loadFixture();
  assert.equal(result.usage.total_cost, 0.0485);
  assert.equal(typeof result.usage.billing_info, "object");
  assert.ok(result.usage.billing_info);
});

test("sequence without a sentinel and no snapshot is rejected", () => {
  assert.throws(() =>
    chooseSequence({
      catalogText: "catalog page without the course code",
      pdfText: "pdf extract without the course code",
      snapshotText: null,
      sentinel: "CTS 1134",
    }),
  );
});

test("blank Auth0 env blocks dashboard and /auth only", () => {
  const blank = {
    AUTH0_DOMAIN: " ",
    AUTH0_CLIENT_ID: "",
    AUTH0_CLIENT_SECRET: "id",
    AUTH0_SECRET: "secret",
    APP_BASE_URL: "http://localhost:3000",
  };
  assert.equal(auth0Ready(blank), false);
  assert.equal(auth0Ready({}), false);
  assert.equal(
    auth0Ready({
      AUTH0_DOMAIN: "tenant.auth0.com",
      AUTH0_CLIENT_ID: "id",
      AUTH0_CLIENT_SECRET: "secret",
      AUTH0_SECRET: "key",
      APP_BASE_URL: "http://localhost:3000",
    }),
    true,
  );
  assert.equal(blockedWithoutAuth("/"), false);
  assert.equal(blockedWithoutAuth("/api/pathway"), false);
  assert.equal(blockedWithoutAuth("/dashboard"), true);
  assert.equal(blockedWithoutAuth("/dashboard/plan"), true);
  assert.equal(blockedWithoutAuth("/auth"), true);
  assert.equal(blockedWithoutAuth("/auth/login"), true);
  assert.equal(blockedWithoutAuth("/dashboarding"), false);
  assert.equal(blockedWithoutAuth("/author"), false);
});

test("empty catalog page falls through to the snapshot", () => {
  const snapshotText = "saved course sequence";
  const chosen = chooseSequence({
    catalogText: "",
    pdfText: null,
    snapshotText,
    sentinel: "CTS 1134",
  });
  assert.equal(chosen.source, "snapshot");
  assert.equal(chosen.text, snapshotText);
});

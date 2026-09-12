const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "campaign-admin-polish.js"), "utf8");
const router = fs.readFileSync(path.join(__dirname, "router.js"), "utf8");

test("campaign admin enhancement reuses the base action row", () => {
  assert.match(
    source,
    /querySelector\('\.admin-source-deployment-actions'\)\|\|document\.createElement\('div'\)/
  );
  assert.match(source, /if\(!actions\.isConnected\)depCard\.appendChild\(actions\)/);
});

test("router cache key includes the deduplicated admin build", () => {
  assert.match(router, /campaign-admin-polish\.js\?v=20260912-dedup1/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const frontendRoot = path.join(__dirname, "..");
const repositoryRoot = path.join(frontendRoot, "..");

test("default frontend test command uses cross-platform Node discovery", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(frontendRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.scripts.test, "node --test");
  assert.doesNotMatch(packageJson.scripts.test, /[*?]/);
});

test("local validation invokes the complete frontend test command", () => {
  const script = fs.readFileSync(
    path.join(repositoryRoot, "scripts", "validate.ps1"),
    "utf8",
  );
  assert.match(script, /npmCommand.*"test"/s);
  const testFiles = fs.readdirSync(__dirname).filter((name) => name.endsWith(".test.js"));
  assert.ok(testFiles.length >= 10, "all frontend tests must remain discoverable by node --test");
});

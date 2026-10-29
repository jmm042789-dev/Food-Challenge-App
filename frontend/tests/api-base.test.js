const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  PRODUCTION_API_BASE,
  joinApiPath,
  resolveApiBase,
} = require("../src/apiBase.ts");

const REQUIRED_PRODUCTION_API_BASE = "https://firefeast-backend.onrender.com";
const FORBIDDEN_BACKEND_HOST = "fire-feast-api.onrender.com";
const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("explicit EXPO_PUBLIC_BACKEND_URL wins", () => {
  assert.equal(resolveApiBase({
    explicitUrl: "http://10.0.2.2:9000/",
    expoHostUris: ["192.168.1.160:8081"],
    isDevelopment: true,
  }), "http://10.0.2.2:9000");
});

test("development Metro host resolves to backend port 8000", () => {
  assert.equal(resolveApiBase({
    expoHostUris: ["192.168.1.160:8081"],
    isDevelopment: true,
  }), "http://192.168.1.160:8000");
});

test("Expo scheme host resolves to backend port 8000", () => {
  assert.equal(resolveApiBase({
    expoHostUris: ["exp://192.168.0.43:8081"],
    isDevelopment: true,
  }), "http://192.168.0.43:8000");
});

test("localhost development host resolves safely", () => {
  assert.equal(resolveApiBase({
    expoHostUris: ["http://localhost:8081/status"],
    isDevelopment: true,
  }), "http://localhost:8000");
});

test("malformed development metadata returns a clear configuration error", () => {
  assert.throws(
    () => resolveApiBase({ expoHostUris: ["not a host ::::"], isDevelopment: true }),
    /could not derive the Metro host.*EXPO_PUBLIC_BACKEND_URL/i,
  );
});

test("production backend constant is the canonical Render service", () => {
  assert.equal(PRODUCTION_API_BASE, REQUIRED_PRODUCTION_API_BASE);
});

test("production without an explicit URL uses the canonical Render service", () => {
  assert.equal(resolveApiBase({ isDevelopment: false }), REQUIRED_PRODUCTION_API_BASE);
});

test("production never discovers a private LAN host", () => {
  assert.equal(resolveApiBase({
    expoHostUris: ["192.168.1.160:8081"],
    isDevelopment: false,
  }), REQUIRED_PRODUCTION_API_BASE);
});

test("EAS profiles all target the canonical production backend", () => {
  const eas = JSON.parse(readProjectFile("eas.json"));
  for (const profile of ["development", "preview", "production"]) {
    assert.equal(
      eas.build[profile].env.EXPO_PUBLIC_BACKEND_URL,
      REQUIRED_PRODUCTION_API_BASE,
      `${profile} profile must target the canonical backend`,
    );
  }
});

// Staging guards intentionally retain the legacy hostname; their behavior is tested separately.
function staleBackendReferences(readFile, hasEnvironmentTemplate) {
  const guardedFiles = [
    "eas.json",
    "src/api.ts",
    "DEPLOYMENT.md",
    "app.json",
    "package.json",
  ];
  if (hasEnvironmentTemplate) guardedFiles.push(".env.example");
  return guardedFiles.filter((relativePath) => readFile(relativePath).includes(FORBIDDEN_BACKEND_HOST));
}

test("production routing files do not contain the stale Render hostname", () => {
  const offenders = staleBackendReferences(
    readProjectFile,
    fs.existsSync(path.join(projectRoot, ".env.example")),
  );
  assert.deepEqual(offenders, [], `stale production backend host found in: ${offenders.join(", ")}`);
});

test("optional environment template is scanned when present and not required when absent", () => {
  const read = (relativePath) => {
    if (relativePath === ".env.example") return FORBIDDEN_BACKEND_HOST;
    return "https://example.invalid";
  };
  assert.deepEqual(staleBackendReferences(read, false), []);
  assert.deepEqual(staleBackendReferences(read, true), [".env.example"]);
});

test("missing required routing files still fail the stale-hostname guard", () => {
  assert.throws(() => staleBackendReferences(() => { throw new Error("required routing file missing"); }, false), /required routing file missing/);
});

test("diagnostic profile inherits the production endpoint", () => {
  const eas = JSON.parse(readProjectFile("eas.json"));
  assert.equal(eas.build["production-diagnostic"].extends, "production");
  assert.equal(eas.build["production-diagnostic"].env.EXPO_PUBLIC_BACKEND_URL, undefined);
});

test("API path joining preserves one separator", () => {
  assert.equal(
    joinApiPath(`${REQUIRED_PRODUCTION_API_BASE}/`, "/api/contests"),
    `${REQUIRED_PRODUCTION_API_BASE}/api/contests`,
  );
});
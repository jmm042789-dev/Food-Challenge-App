const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PRODUCTION_API_BASE,
  joinApiPath,
  resolveApiBase,
} = require("../src/apiBase.ts");

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

test("production without an explicit URL always uses Render", () => {
  assert.equal(resolveApiBase({ isDevelopment: false }), PRODUCTION_API_BASE);
});

test("production never discovers a private LAN host", () => {
  assert.equal(resolveApiBase({
    expoHostUris: ["192.168.1.160:8081"],
    isDevelopment: false,
  }), PRODUCTION_API_BASE);
});

test("API path joining preserves one separator", () => {
  assert.equal(
    joinApiPath("https://firefeast-backend.onrender.com/", "/api/contests"),
    "https://firefeast-backend.onrender.com/api/contests",
  );
});

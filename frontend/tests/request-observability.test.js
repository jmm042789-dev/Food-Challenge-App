const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ApiRequestError,
  readResponseRequestId,
  requestIdForError,
} = require("../src/requestDiagnostics.ts");

function responseWith(value) {
  return { headers: { get: () => value } };
}

test("response request ID is captured only when backend format is safe", () => {
  const requestId = "ab".repeat(16);
  assert.equal(readResponseRequestId(responseWith(requestId)), requestId);
  assert.equal(readResponseRequestId(responseWith("bad id/secret")), null);
  assert.equal(readResponseRequestId(responseWith(null)), null);
  assert.equal(readResponseRequestId({ headers: { get: () => { throw new Error("no headers"); } } }), null);
});

test("API error retains status, code, and request ID compatibly", () => {
  const requestId = "cd".repeat(16);
  const error = new ApiRequestError(409, "friendly existing message", "KNOWN_CODE", requestId);
  assert.equal(error.status, 409);
  assert.equal(error.code, "KNOWN_CODE");
  assert.equal(error.requestId, requestId);
  const compatible = new ApiRequestError(400, "legacy constructor");
  assert.equal(compatible.code, null);
  assert.equal(compatible.requestId, null);
});

test("network errors never fabricate a request ID", () => {
  assert.equal(requestIdForError(new TypeError("network unavailable"), null), null);
  assert.equal(requestIdForError({ requestId: "forged/request" }, null), null);
});

test("error serialization does not include credentials", () => {
  const bearer = "secret-bearer-value";
  const error = new ApiRequestError(401, bearer, null, "ef".repeat(16));
  const serialized = JSON.stringify(error);
  assert.doesNotMatch(serialized, /secret-bearer-value/);
  assert.match(serialized, /requestId/);
});

test("development failure metadata includes request ID but excludes sensitive payloads", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
  assert.doesNotMatch(source, /responseBody/);
  const catchStart = source.indexOf("} catch (err: any) {");
  const catchEnd = source.indexOf("} finally {", catchStart);
  const diagnostics = source.slice(catchStart, catchEnd);
  assert.match(diagnostics, /console\.error\("API request failed"/);
  assert.match(diagnostics, /requestId: requestIdForError\(err, requestId\)/);
  assert.doesNotMatch(diagnostics, /responseBody|Authorization|authToken|recovery_nonce|SecureStore/);
});

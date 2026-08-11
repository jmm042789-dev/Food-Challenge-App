const assert = require("node:assert/strict");
const test = require("node:test");
const { pendingSessionDisposition, shouldProbePendingRecovery } = require("../src/guestAuthStartupPolicy.ts");

test("clean install does not probe newly created recovery material", () => {
  assert.equal(shouldProbePendingRecovery({ recoveryNoncePresent: false, recoveryTokenPresent: false }), false);
});

test("only a complete pre-existing recovery artifact is probed", () => {
  assert.equal(shouldProbePendingRecovery({ recoveryNoncePresent: true, recoveryTokenPresent: true }), true);
  assert.equal(shouldProbePendingRecovery({ recoveryNoncePresent: true, recoveryTokenPresent: false }), false);
});

test("pending-session 401 continues bootstrap and transient failures retry", () => {
  assert.equal(pendingSessionDisposition({ authenticated: false, httpStatus: 401 }), "CONTINUE_BOOTSTRAP");
  assert.equal(pendingSessionDisposition({ authenticated: false, httpStatus: 503 }), "RETRY");
  assert.equal(pendingSessionDisposition({ authenticated: false, httpStatus: null }), "RETRY");
});

test("a pending token rotated before a lost response is recovered", () => {
  assert.equal(pendingSessionDisposition({ authenticated: true, httpStatus: 200 }), "RECOVERED");
});

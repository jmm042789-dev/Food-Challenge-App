const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiSource = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");

function functionBody(name, nextName) {
  const start = apiSource.indexOf(`async function ${name}`);
  const end = apiSource.indexOf(`async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return apiSource.slice(start, end);
}

test("recovery nonce and replacement bearer are durable before bootstrap starts", () => {
  const recoverySetup = functionBody("getOrCreateBootstrapRecovery", "clearBootstrapRecoveryState");
  assert.ok(
    recoverySetup.indexOf("AsyncStorage.setItem(BOOTSTRAP_RECOVERY_NONCE_KEY")
      < recoverySetup.indexOf("storage.secureSet("),
    "the nonce must be persisted before secure replacement-token storage",
  );
  const bootstrap = functionBody("loadOrBootstrapCredentials", "ensureGuestCredentials");
  assert.ok(
    bootstrap.indexOf("getOrCreateBootstrapRecovery()")
      < bootstrap.indexOf('"/auth/guest",'),
    "durable recovery state must exist before the first network request",
  );
});

test("SecureStore failure prevents account creation and preserves a retry path", () => {
  const recoverySetup = functionBody("getOrCreateBootstrapRecovery", "clearBootstrapRecoveryState");
  assert.match(recoverySetup, /if \(!stored\) \{[\s\S]*No account was created/);
  assert.match(recoverySetup, /throw authenticationError/);
});

test("restart and lost-response paths authenticate the pending rotated bearer first", () => {
  const bootstrap = functionBody("loadOrBootstrapCredentials", "ensureGuestCredentials");
  assert.ok(
    bootstrap.indexOf("resolvePendingRecoverySession(recovery.authToken)")
      < bootstrap.indexOf('"/auth/guest"'),
    "a restart must test whether a prior recovery succeeded before replaying it",
  );
  assert.match(bootstrap, /GUEST_RECOVERY_USED[\s\S]*resolvePendingRecoverySession/);
});

test("duplicate bootstrap rotates to the pre-persisted bearer and handles expiration", () => {
  const bootstrap = functionBody("loadOrBootstrapCredentials", "ensureGuestCredentials");
  assert.match(bootstrap, /GUEST_BOOTSTRAP_EXISTS/);
  assert.match(bootstrap, /"\/auth\/guest\/recover"/);
  assert.match(bootstrap, /new_auth_token:\s*recovery\.authToken/);
  assert.match(bootstrap, /GUEST_RECOVERY_EXPIRED/);
  assert.match(bootstrap, /Guest account recovery expired before credentials were saved/);
});

test("successful credential persistence cleans local and server recovery state", () => {
  const persistence = functionBody("persistRecoveredCredentials", "resolvePendingRecoverySession");
  assert.ok(
    persistence.indexOf("storeCredentials(credentials)")
      < persistence.indexOf("clearBootstrapRecoveryState()"),
    "recovery state must remain available until bearer credentials are durable",
  );
  assert.match(persistence, /BOOTSTRAP_COMPLETION_PENDING_KEY/);
  assert.match(persistence, /finishBootstrapRecovery\(credentials\)/);
  const completion = functionBody("finishBootstrapRecovery", "persistRecoveredCredentials");
  assert.match(completion, /"\/auth\/guest\/complete"/);
  assert.match(completion, /Authorization: `Bearer \$\{credentials\.authToken\}`/);
});

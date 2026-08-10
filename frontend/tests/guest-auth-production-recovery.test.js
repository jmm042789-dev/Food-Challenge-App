const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  AUTH_DIAGNOSTIC_CODES,
  classifyGuestAuthStorage,
  diagnosticCodeForUnknown,
  diagnosticMessage,
  isResetEligibleAuthCode,
  safeAuthRequestId,
} = require("../src/guestAuthDiagnostics.ts");
const { performLocalGuestReset } = require("../src/guestAuthReset.ts");

const apiSource = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
const startupSource = fs.readFileSync(path.join(__dirname, "../app/index.tsx"), "utf8");
const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../app.json"), "utf8"));
const backendRoot = path.join(__dirname, "../../backend");

function snapshot(overrides = {}) {
  return {
    credentialsPresent: false,
    installationPresent: false,
    legacyPresent: false,
    recoveryNoncePresent: false,
    recoveryTokenPresent: false,
    secureStoreAvailable: true,
    ...overrides,
  };
}

test("storage classifier distinguishes clean, valid, legacy, restored, unavailable, and pending states", () => {
  assert.equal(classifyGuestAuthStorage(snapshot()), "CLEAN_INSTALL");
  assert.equal(classifyGuestAuthStorage(snapshot({ credentialsPresent: true })), "VALID_CURRENT_CREDENTIALS");
  assert.equal(classifyGuestAuthStorage(snapshot({ legacyPresent: true })), "LEGACY_STATE");
  assert.equal(classifyGuestAuthStorage(snapshot({ installationPresent: true })), "INSTALLATION_WITHOUT_CREDENTIALS");
  assert.equal(classifyGuestAuthStorage(snapshot({ secureStoreAvailable: false })), "SECURESTORE_UNAVAILABLE");
  assert.equal(classifyGuestAuthStorage(snapshot({ recoveryNoncePresent: true, recoveryTokenPresent: true })), "PENDING_RECOVERY_READY");
  assert.equal(classifyGuestAuthStorage(snapshot({ recoveryNoncePresent: true })), "PENDING_RECOVERY_TOKEN_MISSING");
});

test("stable diagnostic codes cover all production recovery outcomes", () => {
  for (const code of [
    "AUTH_LEGACY_STATE", "AUTH_SECURESTORE_MISSING", "AUTH_SECURESTORE_UNAVAILABLE",
    "AUTH_BEARER_REJECTED", "AUTH_RECOVERY_INVALID", "AUTH_RECOVERY_EXPIRED",
    "AUTH_RECOVERY_USED", "AUTH_BOOTSTRAP_CONFLICT", "AUTH_NETWORK",
    "AUTH_INVALID_RESPONSE", "AUTH_LOCAL_RESET_FAILED", "AUTH_UNKNOWN",
  ]) {
    assert.ok(AUTH_DIAGNOSTIC_CODES.includes(code));
    assert.ok(diagnosticMessage(code).length > 10);
  }
  assert.equal(diagnosticCodeForUnknown(new TypeError("Network request failed")), "AUTH_NETWORK");
  assert.equal(diagnosticCodeForUnknown({ status: 503 }), "AUTH_NETWORK");
  assert.equal(diagnosticCodeForUnknown({ code: "AUTH_INVALID_RESPONSE" }), "AUTH_INVALID_RESPONSE");
});

test("only unrecoverable credential states offer a local new-guest reset", () => {
  assert.equal(isResetEligibleAuthCode("AUTH_LEGACY_STATE"), true);
  assert.equal(isResetEligibleAuthCode("AUTH_BEARER_REJECTED"), true);
  assert.equal(isResetEligibleAuthCode("AUTH_NETWORK"), false);
  assert.equal(isResetEligibleAuthCode("AUTH_SECURESTORE_UNAVAILABLE"), false);
});

test("successful local reset verifies every storage family", async () => {
  const calls = [];
  const ok = async (name) => { calls.push(name); return true; };
  await performLocalGuestReset({
    clearAsyncKeys: () => ok("clear-async"),
    clearSecureCredentials: () => ok("clear-credentials"),
    clearSecureRecovery: () => ok("clear-recovery"),
    asyncKeysAreClear: () => ok("verify-async"),
    secureCredentialsAreClear: () => ok("verify-credentials"),
    secureRecoveryIsClear: () => ok("verify-recovery"),
  });
  assert.deepEqual(new Set(calls), new Set([
    "clear-async", "clear-credentials", "clear-recovery",
    "verify-async", "verify-credentials", "verify-recovery",
  ]));
});

test("any failed local reset operation prevents bootstrap continuation", async () => {
  let bootstrapCalled = false;
  await assert.rejects(async () => {
    await performLocalGuestReset({
      clearAsyncKeys: async () => true,
      clearSecureCredentials: async () => false,
      clearSecureRecovery: async () => true,
      asyncKeysAreClear: async () => true,
      secureCredentialsAreClear: async () => false,
      secureRecoveryIsClear: async () => true,
    });
    bootstrapCalled = true;
  }, /could not be cleared/i);
  assert.equal(bootstrapCalled, false);
});

test("legacy marker is preserved during startup and removed only by confirmed reset", () => {
  const legacyGuard = apiSource.slice(apiSource.indexOf("if (legacyPlayerId)"), apiSource.indexOf("const installationId = await"));
  assert.match(legacyGuard, /AUTH_LEGACY_STATE/);
  assert.doesNotMatch(legacyGuard, /removeItem|multiRemove/);
  const reset = apiSource.slice(apiSource.indexOf("async function clearLocalGuestAuthenticationForReset"), apiSource.indexOf("async function startNewGuestAccount"));
  assert.match(reset, /LEGACY_PLAYER_ID_KEY/);
});

test("stale bearer is never converted into installation-only authentication", () => {
  const recovery = apiSource.slice(apiSource.indexOf("async function recoverCredentialsAfterUnauthorized"), apiSource.indexOf("async function req"));
  assert.match(recovery, /AUTH_BEARER_REJECTED/);
  assert.doesNotMatch(recovery, /clearLocalGuestData\(\)/);
  assert.match(recovery, /Authorization: `Bearer \$\{rejected\.authToken\}`/);
});

test("pending recovery and backend recovery outcomes have explicit mappings", () => {
  assert.match(apiSource, /resolvePendingRecoverySession\(recovery\.authToken\)/);
  assert.match(apiSource, /GUEST_BOOTSTRAP_EXISTS/);
  assert.match(apiSource, /GUEST_RECOVERY_INVALID[\s\S]*AUTH_RECOVERY_INVALID/);
  assert.match(apiSource, /GUEST_RECOVERY_EXPIRED[\s\S]*AUTH_RECOVERY_EXPIRED/);
  assert.match(apiSource, /GUEST_RECOVERY_USED[\s\S]*AUTH_RECOVERY_USED/);
  assert.match(apiSource, /AUTH_BOOTSTRAP_CONFLICT/);
  assert.match(apiSource, /AUTH_INVALID_RESPONSE/);
});

test("new guest reset verifies the bearer session before returning the player", () => {
  const reset = apiSource.slice(apiSource.indexOf("async function startNewGuestAccount"), apiSource.indexOf("export const api"));
  assert.ok(reset.indexOf("clearLocalGuestAuthenticationForReset()") < reset.indexOf("ensureGuestCredentials()"));
  assert.ok(reset.indexOf('req("/auth/session")') < reset.indexOf('req(`/player/'));
  assert.match(reset, /session\.player_id !== credentials\.playerId/);
});

test("startup reset requires confirmation, supports cancellation, and states server data is not deleted", () => {
  assert.match(startupSource, /Alert\.alert\(/);
  assert.match(startupSource, /Start a new guest account\?/);
  assert.match(startupSource, /style: "cancel"/);
  assert.match(startupSource, /The previous server account is not deleted/);
  assert.match(startupSource, /api\.startNewGuestAccount\(\)/);
});

test("safe request IDs are retained without accepting secret-like values", () => {
  const requestId = "ab".repeat(16);
  assert.equal(safeAuthRequestId({ requestId }), requestId);
  assert.equal(safeAuthRequestId({ requestId: "Bearer secret/value" }), null);
  assert.doesNotMatch(startupSource, /authToken|installationId|recovery_nonce|auth_token/);
});

test("Expo config enables precise SecureStore backup rules and versionCode 3", () => {
  assert.equal(appConfig.expo.version, "1.0.0");
  assert.equal(appConfig.expo.android.package, "com.firefeast.app");
  assert.equal(appConfig.expo.android.versionCode, 3);
  assert.ok(appConfig.expo.plugins.some((plugin) => Array.isArray(plugin)
    && plugin[0] === "expo-secure-store"
    && plugin[1]?.configureAndroidBackup === true));
});

test("reward and account-deletion contracts remain unchanged", () => {
  const config = fs.readFileSync(path.join(backendRoot, "config.py"), "utf8");
  const players = fs.readFileSync(path.join(backendRoot, "services/player_service.py"), "utf8");
  const shop = fs.readFileSync(path.join(backendRoot, "data/shop.py"), "utf8");
  const shopService = fs.readFileSync(path.join(backendRoot, "services/shop_service.py"), "utf8");
  assert.match(config, /DEFAULT_STARTING_COINS = 500/);
  assert.match(players, /WELCOME_REWARD = \{[\s\S]*"coins": 200,[\s\S]*"antacid": 1,[\s\S]*"xp": 50/);
  assert.match(shop, /"coin_reward": 50000/);
  assert.match(shop, /"xp_reward": 5000/);
  assert.match(shopService, /closed_beta_welcome_pack_claimed[\s\S]*\{"\$ne": True\}/);
  assert.match(apiSource, /confirmation: "DELETE"/);
  assert.match(apiSource, /await clearLocalGuestData\(\)/);
});

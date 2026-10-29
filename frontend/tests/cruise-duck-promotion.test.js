const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Cruise Duck redemption uses authenticated API and submits code only", () => {
  const api = read("src/api.ts");
  assert.match(api, /redeemPromotionCode: \(code: string\).*\/promotions\/redeem/s);
  assert.match(api, /body: JSON\.stringify\(\{ code \}\)/);
  const block = api.slice(api.indexOf("redeemPromotionCode"), api.indexOf("getPublicProfile"));
  const requestBody = block.match(/body: JSON\.stringify\((.*?)\)/s)?.[1] ?? "";
  assert.equal(requestBody, "{ code }");
  assert.doesNotMatch(requestBody, /reward|coins|device_id/);
});

test("promotion screen is single-flight and handles safe redemption states", () => {
  const screen = read("app/promotions.tsx");
  assert.match(screen, /if \(inFlight\.current \|\| normalized\.length < 12\) return/);
  assert.match(screen, /inFlight\.current = true/);
  assert.match(screen, /PROMO_INVALID/);
  assert.match(screen, /PROMO_ALREADY_REDEEMED/);
  assert.match(screen, /PROMO_PLAYER_LIMIT/);
  assert.match(screen, /Your code was not lost/);
});

test("Settings and root navigation expose promotions without adding a tab", () => {
  assert.match(read("app/settings.tsx"), /title="CRUISE DUCK BONUS"[\s\S]*router\.push\("\/promotions"/);
  assert.match(read("app/_layout.tsx"), /name="promotions"/);
  assert.doesNotMatch(read("app/(tabs)/_layout.tsx"), /promotions/);
});

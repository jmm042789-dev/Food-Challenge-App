const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {validateDescriptor} = require("../scripts/validation/deployment");
const root = path.resolve(__dirname,"../..");
const source = fs.readFileSync(path.join(root,"render.yaml"),"utf8");
const version = fs.readFileSync(path.join(root,"backend/.python-version"),"utf8");
test("Render blueprint pins one staging worker and protected Mongo configuration", () => {
  assert.equal(validateDescriptor(source, version).services[0].rootDir, "backend");
});
test("unsafe or malformed deployment configuration is rejected", () => {
  for (const [before,after] of [
    ["key: STAGING_MONGO_URL","key: MONGO_URL"],
    ["value: staging","value: production"],
    ["key: STAGING_MONGO_HOST","key: UNREVIEWED_MONGO_HOST"],
    ["numInstances: 1","numInstances: 2"], ["--workers 1","--workers 2"],
    ["value: fire_feast_staging","value: fire_feast_production"],
    ["sync: false","value: forbidden-inline-value"],
    ["healthCheckPath: /api/health/ready","healthCheckPath: /api/health/live"],
    ['value: "3.14.3"','value: "3.13.0"'],
  ]) assert.throws(() => validateDescriptor(source.replace(before,after), version));
  assert.throws(() => validateDescriptor(source+"services: []\n", version));
});

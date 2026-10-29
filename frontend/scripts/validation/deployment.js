const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const YAML = require("yaml"); // Already pinned transitively by package-lock.json.
const root = path.resolve(__dirname, "../../..");
function validateDescriptor(source, pythonVersion) {
  const doc = YAML.parseDocument(source, { uniqueKeys: true });
  assert.equal(doc.errors.length, 0, doc.errors.map(e => e.message).join("\n"));
  const config = doc.toJS();
  assert.deepEqual(Object.keys(config), ["services"]);
  assert.equal(config.services.length, 1);
  const s = config.services[0];
  const expected = {
    type: "web", name: "fire-feast-api-staging", runtime: "python",
    branch: "release-candidate-1", plan: "starter", region: "oregon",
    rootDir: "backend", numInstances: 1, autoDeployTrigger: "off",
    buildCommand: "pip install -r requirements.txt",
    startCommand: "uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1",
    healthCheckPath: "/api/health/ready",
  };
  assert.deepEqual(Object.keys(s).sort(), [...Object.keys(expected), "envVars"].sort());
  for (const [k,v] of Object.entries(expected)) assert.equal(s[k], v, k);
  assert.equal(s.envVars.length, 7);
  const env = Object.fromEntries(s.envVars.map(e => [e.key,e]));
  assert.equal(Object.keys(env).length, s.envVars.length, "Duplicate environment keys");
  assert.deepEqual(env.PYTHON_VERSION, {key:"PYTHON_VERSION",value:pythonVersion.trim()});
  assert.deepEqual(env.FIRE_FEAST_ENV, {key:"FIRE_FEAST_ENV",value:"production"});
  assert.deepEqual(env.PYTHON_DOTENV_DISABLED, {key:"PYTHON_DOTENV_DISABLED",value:"1"});
  assert.deepEqual(env.DB_NAME, {key:"DB_NAME",value:"fire_feast_staging"});
  assert.deepEqual(env.FIRE_FEAST_DEPLOYMENT, {key:"FIRE_FEAST_DEPLOYMENT",value:"staging"});
  assert.deepEqual(env.STAGING_MONGO_HOST, {key:"STAGING_MONGO_HOST",sync:false});
  assert.deepEqual(env.STAGING_MONGO_URL, {key:"STAGING_MONGO_URL",sync:false});
  assert.equal(env.MONGO_URL, undefined, "Staging must not inherit a generic MongoDB URI");
  return config;
}
function main() {
  validateDescriptor(fs.readFileSync(path.join(root,"render.yaml"),"utf8"),
    fs.readFileSync(path.join(root,"backend/.python-version"),"utf8"));
  const tracked = execFileSync("git", ["--no-optional-locks","-c","safe.directory="+root,
    "ls-files","-z"], {cwd:root,encoding:"utf8",windowsHide:true}).split("\0").filter(Boolean);
  const forbidden = p => p.split("/").some(n => n.startsWith(".env") ||
    ["node_modules",".venv","venv","__pycache__",".pytest_cache"].includes(n)) ||
    /\.(pem|key|p8|p12|pfx|jks|keystore)$/i.test(p) ||
    /(^|\/)(credentials\.json|id_rsa|id_ed25519)$/.test(p);
  assert.deepEqual(tracked.filter(forbidden), [], "Excluded files are tracked");
  // Render rootDir excludes root provenance, frontend, legal and validation evidence.
  assert.ok(!tracked.filter(p => p.startsWith("backend/")).some(p =>
    p.includes("PRESERVATION") || p.includes("SNAPSHOT-INVENTORY") || p.includes("npm-cache")));
  console.log("PASS: YAML syntax, staging deployment contract, Python pin, and tracked artifact exclusions.");
  console.log("Local contract check only; no Render API call, resource creation or database access.");
}
if (require.main === module) main();
module.exports = {validateDescriptor};

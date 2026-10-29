// Local evidence only; never starts a service or establishes release acceptance.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(root, '..');
const manifestPath = 'provenance/FRONTEND-PRESERVATION-MANIFEST.txt';
const venvPython = path.join(repositoryRoot, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const pythonCommand = fs.existsSync(venvPython) ? venvPython : 'python';
const manifestHash = 'c204a48505bd3acc9325c75aa0dcf2115a0c3ac82b9d711954af8657a432e584';
function localEnvironment(source = process.env) {
  const allowed = new Set(['systemroot', 'windir', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata', 'programfiles', 'programfiles(x86)', 'programdata', 'pathext', 'path']);
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key.toLowerCase())));
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') env[key] = env[key].split(path.delimiter).filter(p => path.isAbsolute(p)).join(path.delimiter);
  return { ...env, PYTHONDONTWRITEBYTECODE: '1', PYTEST_DISABLE_PLUGIN_AUTOLOAD: '1', PYTHON_DOTENV_DISABLED: '1', FIRE_FEAST_ENV: 'test', EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', EXPO_NO_TYPESCRIPT_SETUP: '1', GIT_OPTIONAL_LOCKS: '0', CI: '1', NO_COLOR: '1' };
}
function redact(text, environment = process.env) {
  let value = String(text);
  for (const [key, secret] of Object.entries(environment)) if (/secret|token|password|credential|api.?key|mongo.*url/i.test(key) && secret && secret.length >= 4) value = value.split(secret).join('[REDACTED]');
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/(^|\r?\n)([ \t]*(?:Cookie|Set-Cookie):)[^\r\n]*/gi, '$1$2 [REDACTED]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=~-]+/gi, '$1 [REDACTED]')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/(["']?(?:password|passwd|secret|token|access_token|refresh_token|api[_-]?key|authorization|cookie|set-cookie)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s&,;\r\n]+)/gi, '$1[REDACTED]');
}
function sanitize(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /(?:^|[_-])(?:password|passwd|secret|token|credential|authorization|cookie|api[_-]?key)(?:$|[_-])/i.test(k) ? '[REDACTED]' : sanitize(v)]));
  return value;
}
function runStage(name, command, args, cwd, execute = cp.spawnSync) {
  const startedUtc = new Date().toISOString();
  let result;
  try { result = execute(command, args, { cwd, env: localEnvironment(), encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024, windowsHide: true }); }
  catch (error) { result = { status: null, error }; }
  const output = (result.stdout || '') + (result.stderr || '');
  const integrityFailure = (result.status !== 0 || !!result.error) && /CRC mismatch|inflate.*error|\bcorrupt(?:ion|ed)?\b|unstable source read|\b(?:EIO|EACCES|ESTALE|ENOSPC|ERROR_CRC)\b|Unexpected token|input\/output error/i.test(output + ' ' + (result.error?.message || '') + ' ' + (result.error?.code || ''));
  return sanitize({ name, command: [command, ...args], cwd, startedUtc, finishedUtc: new Date().toISOString(), status: integrityFailure ? 'FAIL' : result.error?.code === 'ENOENT' ? 'NOT RUN' : result.status === 0 && !result.error ? 'PASS' : 'FAIL', exitCode: result.status ?? null, signal: result.signal ?? null, output, error: result.error ? result.error.code || result.error.name : null, integrityFailure });
}
function plan() {
  const backend = path.resolve(root, '../backend');
  return [
    ['Backend dependencies', pythonCommand, ['-B', path.join(__dirname, 'validation/backend-local.py'), 'dependencies'], root],
    ['Frontend unit/regression suite', process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd test'] : ['test'], root],
    ['Scoped TypeScript', process.execPath, [path.join(__dirname, 'validation/scoped-typescript.js')], root],
    ['Production PNG integrity', process.execPath, [path.join(__dirname, 'check-png-integrity.js')], root],
    ['Backend deterministic tests', pythonCommand, ['-B', path.join(__dirname, 'validation/backend-local.py'), 'tests', backend], backend],
    ['Render staging configuration', process.execPath, [path.join(__dirname, 'validation/deployment.js')], root],
    ['API source contracts', process.execPath, [path.join(__dirname, 'validation/api-contracts.js')], root],
    ['Release integrity baseline (Build 19 historical snapshot)', process.execPath, [path.join(__dirname, 'check-release-integrity.js')], root],
    ['ESLint (no cache/fix)', process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), '.'], root],
    ['Git diff check', 'git', ['--no-optional-locks', '-c', 'safe.directory=' + repositoryRoot, '-c', 'core.safecrlf=false', '-c', 'core.whitespace=cr-at-eol', 'diff', '--check'], root],
  ];
}
// Includes ignored authored files too. Never follows junctions/symlinks.
// Dependency/cache trees and Git internals are excluded, not claimed as qualified.
function snapshot(directory = repositoryRoot) {
  const files = {};
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules', '.expo', 'validation-results', '__pycache__', '.pytest_cache'].includes(entry.name)) continue;
      const rel = relative ? relative + '/' + entry.name : entry.name;
      const full = path.join(directory, rel);
      const before = fs.lstatSync(full);
      if (before.isSymbolicLink()) throw Error('Refusing linked snapshot path: ' + rel);
      if (before.isDirectory()) walk(rel);
      else if (before.isFile()) {
        const bytes = fs.readFileSync(full);
        const after = fs.statSync(full);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== before.size) throw Error('Unstable source read: ' + rel);
        files[rel] = crypto.createHash('sha256').update(bytes).digest('hex');
      } else throw Error('Unsupported snapshot entry: ' + rel);
    }
  }
  walk('');
  const git = (...args) => cp.execFileSync('git', ['--no-optional-locks', '-c', 'safe.directory=' + repositoryRoot, ...args], { cwd: directory, env: localEnvironment(), encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { files, head: git('rev-parse', 'HEAD'), status: git('status', '--short', '--untracked-files=all'), index: git('ls-files', '--stage') };
}
function mutations(before, after) {
  const changes = [];
  for (const name of [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].sort()) {
    if (!(name in before.files)) changes.push('ADDED ' + name);
    else if (!(name in after.files)) changes.push('DELETED ' + name);
    else if (before.files[name] !== after.files[name]) changes.push('MODIFIED ' + name);
  }
  for (const key of ['head', 'status', 'index']) if (before[key] !== after[key]) changes.push('CHANGED Git ' + key);
  return changes;
}
// Injected I/O makes terminal failures and stop ordering testable without mutations.
function validate({ stages = plan(), preflight = () => {}, observe = snapshot, execute = runStage, persist = () => {} } = {}) {
  const report = { startedUtc: new Date().toISOString(), localResult: 'RUNNING', terminal: false, deploymentParity: 'NOT VERIFIED', externalChecks: ['Database integration', 'Staging/live service acceptance', 'Physical Android acceptance', 'Deployment provenance'].map(name => ({ name, status: 'NOT RUN', reason: 'Requires separate authorized environment and evidence; never implied by local results.' })), networkIsolation: 'Python audit hook is process-local; child processes are not sandboxed by this hook.', stages: stages.map(([name, command, args, cwd]) => ({ name, command: [command, ...args], cwd, status: 'NOT RUN', exitCode: null, output: 'Not reached.' })) };
  let evidenceFailed = false;
  function save() {
    try { persist(sanitize(report)); }
    catch (error) { evidenceFailed = true; throw Error('Evidence write failed: ' + redact(error.code || error.message)); }
  }
  try {
    preflight();
    const before = observe();
    report.sourceCommit = before.head;
    report.initialStatus = before.status;
    report.manifestBefore = before.files[manifestPath];
    if (report.manifestBefore !== manifestHash) throw Error('Preservation manifest does not match its trusted hash');
    save();
    let backendReady = false;
    for (let i = 0; i < stages.length; i++) {
      const [name, ...args] = stages[i];
      if (stages.some(s => s[0] === 'Backend dependencies') && !backendReady && ['Backend deterministic tests', 'API source contracts'].includes(name)) {
        report.stages[i].output = 'Backend dependencies did not pass.';
      } else report.stages[i] = execute(name, ...args);
      if (name === 'Backend dependencies') backendReady = report.stages[i].status === 'PASS';
      save();
      if (report.stages[i].integrityFailure) throw Error('Safety stop after integrity/read failure; no final filesystem observation attempted.');
    }
    const after = observe();
    report.mutations = mutations(before, after);
    report.finalStatus = after.status;
    report.manifestAfter = after.files[manifestPath];
    report.localResult = report.stages.length > 0 && report.stages.every(s => s.status === 'PASS') && report.mutations.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    report.localResult = 'FAIL';
    report.failure = redact(error.message || error.name);
  }
  report.terminal = true;
  report.finishedUtc = new Date().toISOString();
  if (!evidenceFailed) {
    try { save(); } catch (error) { report.localResult = 'FAIL'; report.failure = error.message; }
  }
  if (evidenceFailed) { report.localResult = 'FAIL'; report.evidenceStatus = 'FAIL — terminal outcome must be read from console; an earlier disk report may be incomplete.'; }
  return { report: sanitize(report), exitCode: report.localResult === 'PASS' ? 0 : 1 };
}
function writeEvidence(reportPath, report, io = fs) {
  io.mkdirSync(path.dirname(reportPath), { recursive: true });
  const pending = reportPath + '.pending';
  io.writeFileSync(pending, JSON.stringify(sanitize(report), null, 2) + '\n', { encoding: 'utf8' });
  // Same-volume rename publishes only a completely written report. No repair/retry.
  io.renameSync(pending, reportPath);
}
function main() {
  const reportPath = path.resolve(repositoryRoot, 'validation-results/local-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  const result = validate({
    preflight() { if (!fs.existsSync(path.join(repositoryRoot, 'backend/server.py')) || !fs.existsSync(path.join(repositoryRoot, manifestPath))) throw Error('Repository layout or preserved provenance is missing'); },
    persist(report) {
      writeEvidence(reportPath, report);
    },
  });
  console.log(JSON.stringify(result.report, null, 2));
  console.log('Evidence destination: ' + reportPath);
  process.exitCode = result.exitCode;
}
if (require.main === module) main();
module.exports = { pythonCommand, localEnvironment, runStage, plan, redact, sanitize, snapshot, mutations, validate, writeEvidence };

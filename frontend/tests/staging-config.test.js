const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveApiBase, PRODUCTION_API_BASE } = require('../src/apiBase.ts');
const configure = require('../app.config.js');
const root = path.resolve(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
// Synthetic reserved domain only: no approved staging endpoint is implied or contacted.
const valid = 'https://isolated-test.invalid';
function config(profile, url, marker, input = base) {
  const saved = { ...process.env };
  try {
    process.env.EAS_BUILD_PROFILE = profile;
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_BACKEND_URL;
    if (url !== undefined) process.env.EXPO_PUBLIC_BACKEND_URL = url;
    if (marker !== undefined) process.env.EXPO_PUBLIC_APP_ENV = marker;
    return configure({ config: input });
  } finally {
    for (const key of ['EAS_BUILD_PROFILE', 'EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_BACKEND_URL']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}
const rejected = [undefined, '', '   ', 'bad-url', 'http://isolated-test.invalid',
  PRODUCTION_API_BASE, PRODUCTION_API_BASE + '/api',
  'https://fire-feast-api.onrender.com', 'https://fire-feast-api.onrender.com/api',
  'https://FIREFEAST-BACKEND.ONRENDER.COM.:8443/api',
  'https://FIRE-FEAST-API.ONRENDER.COM.:8443/api',
  'https://user:secret@isolated-test.invalid', 'https://isolated-test.invalid/?x=1',
  'https://isolated-test.invalid/#fragment'];
for (const [index, url] of rejected.entries()) {
  test('staging rejects unsafe backend case ' + index + ' at config and runtime', () => {
    assert.throws(() => config('staging', url), /Staging/);
    for (const isDevelopment of [true, false]) {
      assert.throws(() => resolveApiBase({ explicitUrl: url, isDevelopment, isStaging: true,
        expoHostUris: ['localhost:8081'] }), /Staging/);
    }
  });
}
test('explicit staging HTTPS URL is preserved without production fallback', () => {
  assert.equal(resolveApiBase({explicitUrl: valid + '/', isDevelopment: false, isStaging: true}), valid);
  assert.equal(config('staging', valid).extra.releaseEnvironment, 'staging');
});
test('staging marker protects local evaluation without an EAS staging profile', () => {
  assert.throws(() => config('preview', PRODUCTION_API_BASE, 'staging'), /production backend/);
});
test('staging Android identity and updates are isolated even from inherited update configuration', () => {
  const result = config('staging', valid, undefined, { ...base, updates: { enabled: true, url: 'https://updates-test.invalid', checkAutomatically: 'ON_LOAD' } });
  assert.equal(result.android.package, 'com.firefeast.app.staging');
  assert.equal(result.scheme, 'firefeast-staging');
  assert.equal(result.name, 'Fire Feast Staging');
  assert.equal(result.updates.enabled, false);
  assert.equal(result.updates.checkAutomatically, 'NEVER');
  assert.equal(eas.build.staging.channel, 'staging');
});
test('checked-in staging profile fails closed until a backend is approved', () => {
  assert.equal(eas.build.staging.env.EXPO_PUBLIC_APP_ENV, 'staging');
  assert.equal(eas.build.staging.env.EXPO_PUBLIC_BACKEND_URL, '');
  assert.equal(eas.build.staging.extends, undefined);
  assert.throws(() => config('staging', eas.build.staging.env.EXPO_PUBLIC_BACKEND_URL), /Staging/);
});
test('existing build identities and update settings remain unchanged', () => {
  for (const profile of ['development', 'preview', 'production', 'production-diagnostic']) {
    const result = config(profile, PRODUCTION_API_BASE);
    assert.deepEqual(result.android, base.android);
    assert.equal(result.scheme, base.scheme);
    assert.deepEqual(result.updates, base.updates);
    assert.equal(result.extra.releaseEnvironment, undefined);
  }
  assert.equal(resolveApiBase({isDevelopment:false}), PRODUCTION_API_BASE);
  assert.throws(() => config('production', undefined), /Production builds require/);
});

test('actual API initialization recognizes every staging marker and rejects production', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(root, 'src/api.ts'), 'utf8');
  const initialization = source.match(/const BASE = resolveApiBase\(\{[\s\S]*?\n\}\);/)[0];
  const signals = [
    { env: { EXPO_PUBLIC_APP_ENV: 'staging' }, expoConfig: {} },
    { env: {}, expoConfig: { extra: { releaseEnvironment: 'staging' } } },
    { env: {}, expoConfig: { android: { package: 'com.firefeast.app.staging' } } },
  ];
  for (const signal of signals) {
    const context = { resolveApiBase, __DEV__: false,
      process: {env: {...signal.env, EXPO_PUBLIC_BACKEND_URL: PRODUCTION_API_BASE}},
      Constants: {expoConfig: signal.expoConfig}, expoGoConfig: null, classicManifest: null };
    assert.throws(() => vm.runInNewContext(initialization, context), /production backend/);
    delete context.process.env.EXPO_PUBLIC_BACKEND_URL;
    assert.throws(() => vm.runInNewContext(initialization, {...context}), /Staging/);
    context.process.env.EXPO_PUBLIC_BACKEND_URL = valid;
    assert.equal(vm.runInNewContext(initialization + '\nBASE', {...context}), valid);
  }
});

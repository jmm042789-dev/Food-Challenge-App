const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { frontendContracts, compare } = require('../scripts/validation/api-contracts');

const guestBackend = [{
  path: '/api/auth/guest', method: 'POST', model: 'GuestBootstrapRequest',
  fields: ['installation_id', 'recovery_nonce'], required: ['installation_id', 'recovery_nonce'],
}];
const wrapper = `function requestGuestBootstrap(opts: RequestInit) {
  return new Promise(resolve => {
    req('/auth/guest', {...opts, signal: controller.signal}).then(resolve);
  });
}`;
const literal = `{method: 'POST', body: JSON.stringify({installation_id: 'installation', recovery_nonce: 'nonce'})}`;

test('private bootstrap wrapper resolves literal method and body through its callback', () => {
  const contracts = frontendContracts(`${wrapper}\nrequestGuestBootstrap(${literal});`);
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].method, 'POST');
  assert.deepEqual(contracts[0].requiredFields, ['installation_id', 'recovery_nonce']);
  assert.equal(compare(contracts, guestBackend, ['/auth/guest']).status, 'PASS');
});

test('each direct call retains its own method and body without shared analysis state', () => {
  const contracts = frontendContracts(`${wrapper}
    requestGuestBootstrap(${literal});
    requestGuestBootstrap({method: 'DELETE', body: JSON.stringify({other: 1})});`);
  assert.deepEqual(contracts.map(c => c.method), ['POST', 'DELETE']);
  assert.deepEqual(contracts.map(c => c.fields), [['installation_id', 'recovery_nonce'], ['other']]);
  assert.equal(compare(contracts, guestBackend, ['/auth/guest']).status, 'FAIL');
});

test('wrapper method and body after a spread override caller values', () => {
  const [contract] = frontendContracts(`function forward(opts: RequestInit) {
    return req('/auth/guest', {...opts, method: 'POST', body: JSON.stringify({installation_id: 'id', recovery_nonce: 'nonce'})});
  } forward({method: 'DELETE', body: JSON.stringify({wrong: 1})});`);
  assert.equal(contract.method, 'POST');
  assert.deepEqual(contract.fields, ['installation_id', 'recovery_nonce']);
  assert.equal(compare([contract], guestBackend, ['/auth/guest']).status, 'PASS');
});

test('forwarded options after explicit defaults override both method and body', () => {
  const [contract] = frontendContracts(`function forward(opts: RequestInit) {
    return req('/auth/guest', {method: 'GET', body: JSON.stringify({wrong: 1}), ...opts});
  } forward(${literal});`);
  assert.equal(contract.method, 'POST');
  assert.deepEqual(contract.fields, ['installation_id', 'recovery_nonce']);
});

test('unknown spreads preserve uncertainty and known later overrides preserve precedence', () => {
  const contracts = frontendContracts(`${wrapper}
    requestGuestBootstrap({...${literal}, ...unknown});
    requestGuestBootstrap({...unknown, method: 'POST'});
    requestGuestBootstrap({...unknown, ...${literal}});`);
  assert.equal(contracts[0].method, 'UNRESOLVED');
  assert.equal(contracts[0].fields, null);
  assert.equal(contracts[1].method, 'POST');
  assert.equal(contracts[1].fields, null);
  assert.equal(compare([contracts[1]], guestBackend, ['/auth/guest']).status, 'PARTIAL');
  assert.equal(compare([contracts[2]], guestBackend, ['/auth/guest']).status, 'PASS');
});

test('one unknown caller cannot be hidden by another proven caller', () => {
  const contracts = frontendContracts(`${wrapper} requestGuestBootstrap(${literal}); requestGuestBootstrap(unknown);`);
  assert.deepEqual(contracts.map(c => c.method), ['POST', 'UNRESOLVED']);
  assert.equal(compare(contracts, guestBackend, ['/auth/guest']).status, 'PARTIAL');
});

test('forwarding retains optional request-field guarantees from the caller scope', () => {
  const contracts = frontendContracts(`${wrapper}
    function caller(installation_id?: string, recovery_nonce?: string) {
      return requestGuestBootstrap({method: 'POST', body: JSON.stringify({installation_id, recovery_nonce})});
    }`);
  assert.deepEqual(contracts[0].fields, ['installation_id', 'recovery_nonce']);
  assert.deepEqual(contracts[0].requiredFields, []);
  assert.equal(compare(contracts, guestBackend, ['/auth/guest']).status, 'FAIL');
});

test('aliases, exports, reassignment and parameter mutation prevent unproven expansion', () => {
  const cases = [
    `${wrapper} const alias = requestGuestBootstrap; requestGuestBootstrap(${literal});`,
    `export ${wrapper} requestGuestBootstrap(${literal});`,
    `${wrapper} requestGuestBootstrap = other; requestGuestBootstrap(${literal});`,
    `function requestGuestBootstrap(opts: RequestInit) { opts.method = 'DELETE'; return req('/auth/guest', {...opts}); }
      requestGuestBootstrap(${literal});`,
    `function requestGuestBootstrap(opts: RequestInit) { mutate(opts); return req('/auth/guest', opts); }
      requestGuestBootstrap(${literal});`,
  ];
  for (const source of cases) {
    assert.equal(compare(frontendContracts(source), guestBackend, ['/auth/guest']).status, 'PARTIAL');
  }
});

test('shadowed parameters and accessor side effects cannot create a false proof', () => {
  const shadowed = `function forward(opts: RequestInit) {
    return ((opts: RequestInit) => req('/auth/guest', {...opts}))(unknown);
  } forward(${literal});`;
  assert.equal(frontendContracts(shadowed)[0].method, 'UNRESOLVED');
  const accessor = `${wrapper} requestGuestBootstrap({
    get change() { this.method = 'DELETE'; return 1; },
    method: 'POST', body: JSON.stringify({installation_id: 'id', recovery_nonce: 'nonce'})
  });`;
  assert.equal(compare(frontendContracts(accessor), guestBackend, ['/auth/guest']).status, 'PARTIAL');
});

test('simple retry forwarding is resolved only with proven literal route and options', () => {
  const source = `function retry(route: string, opts: RequestInit) { return req(route, opts); }
    retry('/auth/guest', ${literal});`;
  assert.equal(compare(frontendContracts(source), guestBackend, ['/auth/guest']).status, 'PASS');
  assert.equal(compare(frontendContracts(`function retry(route: string, opts: RequestInit) {
    const rewritten = rewrite(route, opts); return req(rewritten.path, rewritten.opts);
  } retry('/auth/guest', ${literal});`), [], []).status, 'PARTIAL');
});

test('unused wrappers and forwarded caller templates remain explicitly unresolved', () => {
  assert.equal(frontendContracts(wrapper)[0].method, 'UNRESOLVED');
  const [contract] = frontendContracts("function retry(route: string, opts: RequestInit) { return req(route, opts); } retry(`/player/${id}`, {});");
  assert.equal(contract.path, null);
  assert.equal(compare([contract], [], []).status, 'PARTIAL');
});

test('literal recovery records preserve forwarded method, body and override precedence', () => {
  const contracts = frontendContracts(`function retry() {
    const rewritten = {path: '/auth/guest', opts: {
      method: 'DELETE', body: JSON.stringify({wrong: 1}), ...${literal}
    }};
    return req(rewritten.path, rewritten.opts, true, false);
  }`);
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].method, 'POST');
  assert.deepEqual(contracts[0].requiredFields, ['installation_id', 'recovery_nonce']);
  assert.equal(compare(contracts, guestBackend, ['/auth/guest']).status, 'PASS');
  const [override] = frontendContracts(`const rewritten = {path: '/auth/guest', opts: {
    ...${literal}, method: 'DELETE', body: JSON.stringify({replacement: 1})
  }}; req(rewritten.path, rewritten.opts);`);
  assert.equal(override.method, 'DELETE');
  assert.deepEqual(override.fields, ['replacement']);
});

test('dynamic recovery helpers, paths and bodies retain partial contracts', () => {
  const sources = [
    `const rewritten = rewriteRequestForRecoveredPlayer(path, opts, oldId, newId); req(rewritten.path, rewritten.opts);`,
    `const rewritten = {path: dynamicPath, opts: ${literal}}; req(rewritten.path, rewritten.opts);`,
    `const rewritten = {path: '/auth/guest', opts: {method: 'POST', body: JSON.stringify(parsedBody)}}; req(rewritten.path, rewritten.opts);`,
    `const rewritten = {path: '/auth/guest', opts: {...${literal}, ...unknown}}; req(rewritten.path, rewritten.opts);`,
  ];
  for (const source of sources) {
    const contracts = frontendContracts(source);
    const known = contracts.filter(c => c.path);
    assert.equal(compare(contracts, known.length ? guestBackend : [], known.length ? ['/auth/guest'] : []).status, 'PARTIAL');
  }
});

test('mutable, escaping, shadowed and accessor request records cannot create false proofs', () => {
  const record = `const rewritten = {path: '/auth/guest', opts: ${literal}};`;
  const sources = [
    `${record} rewritten.opts.method = 'DELETE'; req(rewritten.path, rewritten.opts);`,
    `${record} rewritten.path = '/different'; req(rewritten.path, rewritten.opts);`,
    `${record} mutate(rewritten); req(rewritten.path, rewritten.opts);`,
    `${record} const alias = rewritten; req(rewritten.path, rewritten.opts);`,
    `export ${record} req(rewritten.path, rewritten.opts);`,
    `${record} function retry(rewritten: any) { return req(rewritten.path, rewritten.opts); }`,
    `let rewritten = {path: '/auth/guest', opts: ${literal}}; req(rewritten.path, rewritten.opts);`,
    `const rewritten = {get path() { return '/auth/guest'; }, opts: ${literal}}; req(rewritten.path, rewritten.opts);`,
    `req(rewritten.path, rewritten.opts); ${record}`,
  ];
  for (const source of sources) {
    const [contract] = frontendContracts(source);
    assert.equal(contract.path, null);
    assert.equal(contract.method, 'UNRESOLVED');
    assert.equal(compare([contract], [], []).status, 'PARTIAL');
  }
});

test('real API bootstrap is proved while its dynamic authentication retry stays partial', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8');
  const contracts = frontendContracts(source);
  const guests = contracts.filter(c => c.path === '/auth/guest');
  assert.equal(guests.length, 1);
  assert.equal(compare(guests, guestBackend, ['/auth/guest']).status, 'PASS');
  const unknown = contracts.filter(c => !c.path);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].method, 'UNRESOLVED');
  assert.match(source.split('\n')[unknown[0].line - 1], /req\(rewritten\.path, rewritten\.opts/);
  assert.equal(compare(unknown, [], []).status, 'PARTIAL');
});

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { runStage, pythonCommand } = require('../validate-local-release');
const normalize = route => route.split('?')[0].replace(/\{[^}]*\}/g, '{}');
const priorities = ['/auth/guest', '/auth/guest/recover', '/auth/session', '/player/{}', '/contests', '/match/start', '/match/result', '/match/resume', '/match/receipt', '/daily/status/{}', '/daily/claim', '/player/welcome_reward', '/shop', '/purchase', '/player/equip', '/player/equip-cosmetic', '/social/friends', '/social/friends/request', '/pvp/challenges', '/pvp/attempt/start', '/pvp/result', '/leaderboard', '/leaderboard/contest/{}', '/pvp/quips', '/player/account'];
function frontendContracts(source) {
  const file = ts.createSourceFile('api.ts', source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw Error('Malformed API source: ' + ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, '\n'));
  const found = [];
  const key = prop => prop.name && !ts.isComputedPropertyName(prop.name) ? prop.name.text : null;
  const undefinedType = type => !!type && ([ts.SyntaxKind.UndefinedKeyword, ts.SyntaxKind.AnyKeyword, ts.SyntaxKind.UnknownKeyword].includes(type.kind) || ts.isUnionTypeNode(type) && type.types.some(undefinedType));
  const optional = member => !!member.questionToken || undefinedType(member.type);
  const nodes = [];
  function collect(node) { nodes.push(node); ts.forEachChild(node, collect); }
  collect(file);
  // Only expand private, uniquely named declarations used exclusively as direct
  // calls. Escaping/aliased/exported functions retain their unresolved contract.
  function wrapperContexts(node) {
    let wrapper = node.parent;
    while (wrapper && !ts.isFunctionDeclaration(wrapper)) wrapper = wrapper.parent;
    if (!wrapper?.name || wrapper.name.text === 'req' || wrapper.parent !== file ||
        wrapper.modifiers?.some(m => [ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.DefaultKeyword].includes(m.kind))) return [new Map()];
    const references = nodes.filter(n => ts.isIdentifier(n) && n.text === wrapper.name.text && n !== wrapper.name);
    if (!references.length || references.some(n => !ts.isCallExpression(n.parent) || n.parent.expression !== n)) return [new Map()];
    const safe = declaration => {
      const name = declaration.name;
      if (!ts.isIdentifier(name) || declaration.initializer || declaration.dotDotDotToken) return false;
      const references = nodes.filter(n => ts.isIdentifier(n) && n.text === name.text && n !== name && n.pos >= wrapper.pos && n.end <= wrapper.end);
      return references.every(n =>
        ts.isSpreadAssignment(n.parent) && n.parent.expression === n ||
        ts.isCallExpression(n.parent) && ts.isIdentifier(n.parent.expression) && n.parent.expression.text === 'req' && n.parent.arguments.indexOf(n) >= 0 && n.parent.arguments.indexOf(n) <= 1);
    };
    return references.map(reference => {
      const bindings = new Map();
      wrapper.parameters.forEach((declaration, index) => {
        const expression = reference.parent.arguments[index];
        if (expression && safe(declaration)) bindings.set(declaration, { expression, context: reference.parent });
      });
      return bindings;
    });
  }
  function parameter(name, context) {
    for (let parent = context.parent; parent; parent = parent.parent) {
      if (!ts.isArrowFunction(parent) && !ts.isFunctionDeclaration(parent) && !ts.isFunctionExpression(parent)) continue;
      const result = parent.parameters.find(p => ts.isIdentifier(p.name) && p.name.text === name);
      if (result) return result;
    }
    return null;
  }
  // Prove only local, non-escaping literal request records. A helper call such
  // as rewriteRequestForRecoveredPlayer(...) is not an identity operation:
  // runtime string replacement / JSON parsing must remain unresolved.
  function requestProperty(expr) {
    if (!expr || !ts.isPropertyAccessExpression(expr) || !ts.isIdentifier(expr.expression)) return null;
    const name = expr.expression.text;
    const declarations = nodes.filter(n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name);
    if (declarations.length !== 1) return null;
    const declaration = declarations[0], list = declaration.parent;
    if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const) || declaration.end >= expr.pos ||
        list.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) return null;
    const scope = list.parent.parent;
    for (let ancestor = expr.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor === scope) {
        const references = nodes.filter(n => ts.isIdentifier(n) && n.text === name && n !== declaration.name);
        // Reject aliases, mutation, shadowing and escapes, including nested
        // writes (record.opts.method = ...), rather than trusting const alone.
        if (references.some(n => {
          const access = n.parent, call = access.parent;
          return !ts.isPropertyAccessExpression(access) || access.expression !== n ||
            !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== 'req' ||
            call.arguments.indexOf(access) < 0 || call.arguments.indexOf(access) > 1;
        })) return null;
        const object = declaration.initializer;
        if (!object || !ts.isObjectLiteralExpression(object) ||
            object.properties.some(p => !ts.isPropertyAssignment(p) || !key(p))) return null;
        const property = [...object.properties].reverse().find(p => key(p) === expr.name.text);
        return property?.initializer || null;
      }
    }
    return null;
  }
  function fields(expr, context, bindings = new Map()) {
    if (!expr) return null;
    if (ts.isObjectLiteralExpression(expr)) {
      const result = new Map();
      for (const prop of expr.properties) {
        if (ts.isSpreadAssignment(prop)) {
          const nested = fields(prop.expression, context, bindings);
          if (!nested) return null;
          // Optional spread fields can overwrite previous values with undefined.
          for (const [name, guaranteed] of nested) result.set(name, guaranteed);
        } else {
          const name = key(prop);
          if (!name) return null;
          const value = ts.isPropertyAssignment(prop) ? prop.initializer : ts.isShorthandPropertyAssignment(prop) ? prop.name : null;
          let guaranteed = !!value && value.kind !== ts.SyntaxKind.UndefinedKeyword && value.getText(file) !== 'undefined';
          if (value && ts.isIdentifier(value)) {
            const declaration = parameter(value.text, context);
            if (declaration && optional(declaration)) guaranteed = false;
          }
          if (value && ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression)) {
            const declaration = parameter(value.expression.text, context);
            if (declaration?.type && ts.isTypeLiteralNode(declaration.type)) {
              const member = declaration.type.members.find(m => key(m) === value.name.text);
              if (!member || optional(member)) guaranteed = false;
            }
          }
          result.set(name, guaranteed);
        }
      }
      return result;
    }
    if (ts.isIdentifier(expr)) {
      const declaration = parameter(expr.text, context);
      const bound = bindings.get(declaration);
      if (bound) return fields(bound.expression, bound.context);
      if (declaration?.type && ts.isTypeLiteralNode(declaration.type)) {
        if (declaration.type.members.some(m => !key(m))) return null;
        return new Map(declaration.type.members.map(m => [key(m), !optional(m) && !optional(declaration)]));
      }
    }
    return null;
  }
  function optionsState(options, context, state = { method: 'GET', body: null }, bindings = new Map()) {
    if (!options || options.getText(file) === 'undefined') return state;
    const forwarded = requestProperty(options);
    if (forwarded) return optionsState(forwarded, context, state, bindings);
    if (ts.isIdentifier(options)) {
      const bound = bindings.get(parameter(options.text, context));
      if (bound) return optionsState(bound.expression, bound.context, state);
    }
    if (!ts.isObjectLiteralExpression(options)) return { method: 'UNRESOLVED', body: null };
    // Accessors can mutate other properties while a wrapper spreads the object.
    if (options.properties.some(p => ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p))) return { method: 'UNRESOLVED', body: null };
    for (const prop of options.properties) {
      if (ts.isSpreadAssignment(prop)) {
        state = optionsState(prop.expression, context, state, bindings);
        continue;
      }
      const name = key(prop);
      // A computed property can override either method or body.
      if (!name) { state = { method: 'UNRESOLVED', body: null }; continue; }
      if (name === 'method') state.method = ts.isPropertyAssignment(prop) && (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) ? prop.initializer.text : 'UNRESOLVED';
      if (name === 'body') state.body = ts.isPropertyAssignment(prop) && ts.isCallExpression(prop.initializer) && prop.initializer.expression.getText(file) === 'JSON.stringify' ? fields(prop.initializer.arguments[0], context, bindings) : null;
    }
    return state;
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'req') {
      const [route, options] = node.arguments;
      for (const bindings of wrapperContexts(node)) {
        const boundRoute = route && ts.isIdentifier(route) ? bindings.get(parameter(route.text, node)) : null;
        const recordRoute = requestProperty(route);
        const resolvedRoute = boundRoute ? boundRoute.expression : recordRoute || route;
        let routeText;
        if (resolvedRoute && (ts.isStringLiteral(resolvedRoute) || ts.isNoSubstitutionTemplateLiteral(resolvedRoute))) routeText = resolvedRoute.text;
        // Caller templates need caller-specific expression analysis; keep them
        // unresolved rather than inventing a route from a forwarded parameter.
        else if (!boundRoute && !recordRoute && resolvedRoute && ts.isTemplateExpression(resolvedRoute)) routeText = resolvedRoute.head.text + resolvedRoute.templateSpans.map(span => '{}' + span.literal.text).join('');
        const state = optionsState(options, node, { method: 'GET', body: null }, bindings);
        found.push({ path: routeText ? normalize(routeText) : null, method: state.method, fields: state.body ? [...state.body.keys()] : null, requiredFields: state.body ? [...state.body].filter(([, required]) => required).map(([name]) => name) : null, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}
function compare(frontend, backend, required = priorities) {
  const errors = [], coverage = [];
  for (const client of frontend.filter(c => !c.path)) coverage.push({ ...client, status: 'PARTIAL', note: 'Dynamic route cannot be resolved statically.' });
  for (const route of required) {
    const clients = frontend.filter(c => c.path === route);
    const servers = backend.filter(b => normalize(b.path.replace(/^\/api/, '')) === route);
    if (!clients.length || !servers.length) { errors.push('Missing source route: ' + route); continue; }
    for (const client of clients) {
      const server = servers.find(b => b.method === client.method);
      if (client.method === 'UNRESOLVED') { coverage.push({ ...client, status: 'PARTIAL', note: 'Method/body unresolved; this is not a verified contract.' }); continue; }
      if (!server) { errors.push('Method mismatch: ' + client.method + ' ' + route); coverage.push({ ...client, status: 'FAIL' }); continue; }
      const start = errors.length;
      if (client.fields && server.model) {
        for (const field of server.required) if (!client.fields.includes(field)) errors.push(route + ': missing required request field ' + field);
        else if (client.requiredFields && !client.requiredFields.includes(field)) errors.push(route + ': required request field is optional: ' + field);
        for (const field of client.fields) if (!server.fields.includes(field)) errors.push(route + ': unsupported request field ' + field);
      }
      coverage.push({ ...client, model: server.model, status: errors.length > start ? 'FAIL' : server.model && (!client.fields || !client.requiredFields) ? 'PARTIAL' : 'PASS', note: 'Static route/method and declared request-field coverage only; not runtime values, HTTP, responses, auth, retry, or database qualification.' });
    }
  }
  return { status: errors.length ? 'FAIL' : coverage.some(c => c.status === 'PARTIAL') ? 'PARTIAL' : 'PASS', errors, coverage };
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const backend = path.resolve(root, '../backend');
  const result = runStage('Backend schema extraction', pythonCommand, ['-B', path.join(__dirname, 'backend-local.py'), 'contracts', backend], root);
  if (result.status !== 'PASS') { console.error(JSON.stringify(result)); process.exitCode = 1; }
  else {
    const report = compare(frontendContracts(fs.readFileSync(path.join(root, 'src/api.ts'), 'utf8')), JSON.parse(result.output));
    console.log(JSON.stringify(report, null, 2));
    // A partial source check is useful evidence but is not complete qualification.
    process.exitCode = report.status === 'FAIL' ? 1 : report.status === 'PARTIAL' ? 2 : 0;
  }
}
module.exports = { frontendContracts, compare, normalize, priorities };

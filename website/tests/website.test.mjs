import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const repository = resolve(root, '..');
const dist = join(root, 'dist');
const routes = ['/', '/privacy', '/terms', '/gameplay-disclaimer', '/support', '/delete-account'];
const fileFor = (route) => route === '/' ? join(dist, 'index.html') : join(dist, route.slice(1), 'index.html');
const stripHtml = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<\/(?:h[1-6]|p|li)>/g, ' ').replace(/<[^>]+>/g, '').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replace(/\s+/g, ' ').trim();
const stripMarkdown = (markdown) => markdown.replace(/^#{1,3}\s+/gm, '').replace(/^[-*]\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();

test('all required routes are built', async () => {
  for (const route of routes) assert.ok((await stat(fileFor(route))).isFile(), `${route} is missing`);
});

test('legal pages are synchronized with authoritative Markdown', async () => {
  const mappings = [['privacy', 'privacy-policy.md'], ['terms', 'terms-of-service.md'], ['gameplay-disclaimer', 'gameplay-disclaimer.md']];
  for (const [route, source] of mappings) {
    const markdown = await readFile(join(repository, 'docs', 'legal', source), 'utf8');
    const html = await readFile(fileFor(`/${route}`), 'utf8');
    const article = html.match(/<article>([\s\S]*?)<\/article>/)?.[1];
    assert.ok(article, `${source} article is missing`);
    assert.equal(stripHtml(article), stripMarkdown(markdown), `${source} content is not synchronized`);
  }
});

test('site has no placeholders, task markers, local URLs, or private LAN addresses', async () => {
  const files = await Promise.all(routes.map((route) => readFile(fileFor(route), 'utf8')));
  files.push(await readFile(join(dist, 'robots.txt'), 'utf8'), await readFile(join(dist, 'sitemap.xml'), 'utf8'));
  const content = files.join('\n');
  assert.doesNotMatch(content, /lorem ipsum|placeholder|TODO|FIXME/i);
  assert.doesNotMatch(content, /localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i);
});

test('production domain and support email are correct', async () => {
  const support = await readFile(fileFor('/support'), 'utf8');
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
  assert.match(support, /mailto:support@firefeastgame\.com/);
  assert.match(sitemap, /https:\/\/firefeastgame\.com/);
  assert.doesNotMatch(`${support}\n${sitemap}`, /support@(?!firefeastgame\.com)/);
});

test('every page includes core accessibility and SEO metadata', async () => {
  const titles = new Set();
  for (const route of routes) {
    const html = await readFile(fileFor(route), 'utf8');
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title && !titles.has(title), `${route} requires a unique title`);
    titles.add(title);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main id="main-content"/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /<link rel="canonical"/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<h1[ >]/);
  }
});

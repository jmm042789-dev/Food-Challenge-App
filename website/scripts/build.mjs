import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(root, '..');
const output = join(root, 'dist');
const domain = 'https://firefeastgame.com';
const supportEmail = 'support@firefeastgame.com';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g, '<a href="mailto:$1">$1</a>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').trimEnd().split('\n');
  const html = [];
  let paragraph = [];
  let inList = false;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (inList) html.push('</ul>');
    inList = false;
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^-\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (item) {
      flushParagraph();
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inlineMarkdown(item[1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph(); closeList();
    } else {
      closeList(); paragraph.push(line.trim());
    }
  }
  flushParagraph(); closeList();
  return html.join('\n');
}

const nav = `
  <a class="brand" href="/" aria-label="Fire Feast home"><img src="/assets/logo-horizontal.png" alt="Fire Feast"></a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
  <nav id="site-nav" aria-label="Main navigation">
    <a href="/#features">Features</a><a href="/support">Support</a><a href="/privacy">Privacy</a>
  </nav>`;

const footer = `<footer><div class="footer-inner">
  <a class="footer-brand" href="/"><img src="/assets/logo-compact.png" alt="Fire Feast home"></a>
  <nav aria-label="Legal and support"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/gameplay-disclaimer">Gameplay Disclaimer</a><a href="/support">Support</a><a href="/delete-account">Delete Account</a></nav>
  <p>© ${new Date().getUTCFullYear()} J&amp;B Forge Studios. All rights reserved.</p>
</div></footer>`;

function layout({ title, description, path, body, legal = false }) {
  const canonical = `${domain}${path === '/' ? '/' : path}`;
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png" type="image/png">
  <meta name="theme-color" content="#0f1115"><meta property="og:type" content="website">
  <meta property="og:site_name" content="Fire Feast"><meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${domain}/assets/og-image.png"><meta property="og:image:alt" content="Fire Feast arcade food challenge game logo">
  <link rel="stylesheet" href="/styles.css">
</head><body><a class="skip-link" href="#main-content">Skip to main content</a>
<header>${nav}</header><main id="main-content"${legal ? ' class="legal-page"' : ''}>${body}</main>${footer}
<script>const b=document.querySelector('.nav-toggle'),n=document.querySelector('#site-nav');b.addEventListener('click',()=>{const o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));n.classList.toggle('open',!o)});</script>
</body></html>`;
}

const features = [
  ['Fast arcade gameplay', 'Tap fast, manage the pressure, and chase a bigger score in quick-fire contests.', '⚡'],
  ['Food-themed competition', 'Take on fictional feasts built for playful, over-the-top arcade rivalry.', '🍕'],
  ['Daily Reward Wheel', 'Return each day and spin for a fresh virtual reward.', '🎯'],
  ['Coins and XP', 'Earn virtual coins and XP as you compete and improve.', '🪙'],
  ['Belt progression', 'Climb the ranks and show how far your skills have taken you.', '🥋'],
  ['Antacid strategy', 'Time your Antacid carefully to keep heartburn under control.', '🛡️'],
  ['Backend-authoritative progression', 'Protected online services keep supported balances and progression consistent.', '✓'],
  ['Closed Beta status', 'Fire Feast is preparing for a limited Google Play Closed Beta.', '🔥']
];

const homeBody = `<section class="hero"><div class="hero-copy">
  <p class="eyebrow">Arcade food challenge</p><img class="hero-logo" src="/assets/logo-primary.png" alt="Fire Feast">
  <h1>Master the Heat.</h1><p class="lead">Race through fast, fiery food challenges where sharp timing, quick taps, and smart Antacid strategy separate contenders from champions.</p>
  <div class="availability" aria-label="Release status"><span aria-hidden="true"></span>Coming Soon to Google Play</div>
  <a class="button" href="#features">Discover Fire Feast</a>
</div><div class="hero-art" aria-hidden="true"><div class="heat-ring"></div><img src="/assets/blaze.png" alt=""></div></section>
<section class="ticker" aria-label="Game highlights"><span>Tap fast</span><span>Build combos</span><span>Master heartburn</span><span>Climb the belts</span></section>
<section class="features" id="features"><div class="section-heading"><p class="eyebrow">Bring your appetite</p><h2>Every second counts.</h2><p>Built for short, satisfying sessions with a competitive arcade edge.</p></div>
<div class="feature-grid">${features.map(([title, copy, icon], i) => `<article class="feature-card${i === 0 || i === 7 ? ' featured' : ''}"><span class="feature-icon" aria-hidden="true">${icon}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div></section>
<section class="beta"><div><p class="eyebrow">Closed Beta</p><h2>The kitchen is heating up.</h2><p>Fire Feast is in active testing ahead of its Google Play release. No download is available from this website yet.</p></div><a class="button secondary" href="/support">Contact support</a></section>`;

const supportBody = `<section class="page-hero"><p class="eyebrow">Player support</p><h1>How can we help?</h1><p>Questions about Fire Feast or something not working as expected? Contact J&amp;B Forge Studios.</p><a class="email-link" href="mailto:${supportEmail}">${supportEmail}</a></section>
<section class="content-card"><h2>Reporting a bug</h2><p>Tell us what happened, what you expected to happen, and the steps that led to the issue. Include your device model, operating system version, and Fire Feast app version when available.</p><h2>Request IDs</h2><p>If the Game displays a Request ID with an error, include that ID in your message. It helps us locate the relevant diagnostic event without needing your private credentials.</p><div class="notice"><strong>Keep your account secure.</strong> We will never ask you to send a password, bearer token, guest authentication credential, or account recovery secret by email.</div></section>`;

const deleteBody = `<section class="page-hero"><p class="eyebrow">Account &amp; data</p><h1>Delete your Fire Feast account</h1><p>Fire Feast for Android (<strong>com.firefeast.app</strong>) automatically creates a guest account for the device rather than asking for a username, password, or account email. Use the authenticated in-game control whenever possible.</p></section>
<section class="content-card"><h2>Delete immediately from the Game</h2><ol><li>Open Fire Feast on the device containing your guest account.</li><li>Open the <strong>Profile</strong> screen.</li><li>Under <strong>Account &amp; Data</strong>, choose <strong>Delete Account</strong>.</li><li>Review both warnings and choose <strong>Delete Account Permanently</strong>.</li></ol><p>When the Game reports success, deletion of the active server-side account data is immediate. The Game also attempts to clear the guest credentials and supported guest progression stored on that device. Deletion is permanent and cannot be undone.</p><h2>What is deleted?</h2><p>The authenticated deletion removes the guest profile and authentication record, installation association, gamer name and profile choices, gameplay progress and statistics, virtual coin and Antacid balances, XP and rank, rewards, inventory and equipped gear, active-match information, and the leaderboard entry.</p><h2>What may be retained?</h2><p>The current Fire Feast application database does not retain a separate account history after deletion. Limited operational records, security logs, or backup copies held by hosting and database providers may remain for their normal backup or security cycles, or longer when required by law or needed to investigate fraud, abuse, or security incidents. They are not used to restore the deleted guest account and are removed or anonymized when the applicable retention purpose ends.</p><h2>Can’t access the in-game control?</h2><p>Email <a href="mailto:${supportEmail}?subject=Fire%20Feast%20Account%20Deletion%20Request">${supportEmail}</a> with the subject <strong>Fire Feast Account Deletion Request</strong>. Include your gamer name, device model, country shown on the profile, and an approximate date you last played if known. Do not send a password, bearer token, guest authentication credential, recovery secret, or other sensitive credential.</p><p>Support will explain what is needed to assess whether the guest account can be safely identified and verified. We aim to complete a verifiable support request within 30 days. Because Fire Feast does not collect an account email address and the authentication credential stays on the device, support may be unable to identify or delete a guest account after those device credentials are lost.</p><p>For more detail, read the <a href="/privacy">Fire Feast Privacy Policy</a>. This public page is the account-deletion request resource for Fire Feast and does not expose an unauthenticated deletion endpoint.</p></section>`;

const pages = [
  ['/', 'Fire Feast — Master the Heat', 'Master the heat in Fire Feast, a fast arcade food challenge game coming soon to Google Play.', homeBody, false],
  ['/support', 'Support — Fire Feast', 'Contact Fire Feast support and learn how to submit a useful, secure bug report.', supportBody, false],
  ['/delete-account', 'Delete Account — Fire Feast', 'Learn how to permanently delete your Fire Feast guest account from inside the Game.', deleteBody, false]
];

const legalPages = [
  ['/privacy', 'Privacy Policy — Fire Feast', 'Read the Fire Feast Privacy Policy.', 'privacy-policy.md'],
  ['/terms', 'Terms of Service — Fire Feast', 'Read the Fire Feast Terms of Service.', 'terms-of-service.md'],
  ['/gameplay-disclaimer', 'Gameplay & Health Disclaimer — Fire Feast', 'Read the Fire Feast gameplay and health disclaimer.', 'gameplay-disclaimer.md']
];

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets'), { recursive: true });
for (const [path, title, description, body, legal] of pages) {
  const destination = path === '/' ? join(output, 'index.html') : join(output, path.slice(1), 'index.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, layout({ title, description, path, body, legal }), 'utf8');
}
for (const [path, title, description, filename] of legalPages) {
  const markdown = await readFile(join(repository, 'docs', 'legal', filename), 'utf8');
  const destination = join(output, path.slice(1), 'index.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, layout({ title, description, path, body: `<article>${renderMarkdown(markdown)}</article>`, legal: true }), 'utf8');
}
await cp(join(root, 'src', 'styles.css'), join(output, 'styles.css'));
await cp(join(repository, 'frontend', 'src', 'assets', 'logo', 'fire-feast-logo-primary.png'), join(output, 'assets', 'logo-primary.png'));
await cp(join(repository, 'frontend', 'src', 'assets', 'logo', 'fire-feast-logo-horizontal.png'), join(output, 'assets', 'logo-horizontal.png'));
await cp(join(repository, 'frontend', 'src', 'assets', 'logo', 'fire-feast-logo-compact.png'), join(output, 'assets', 'logo-compact.png'));
await cp(join(repository, 'frontend', 'src', 'assets', 'characters', 'blaze.png'), join(output, 'assets', 'blaze.png'));
await cp(join(repository, 'frontend', 'assets', 'images', 'favicon.png'), join(output, 'favicon.png'));
await cp(join(repository, 'frontend', 'assets', 'images', 'app-image.png'), join(output, 'assets', 'og-image.png'));
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`, 'utf8');
await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/privacy', '/terms', '/gameplay-disclaimer', '/support', '/delete-account'].map((path) => `  <url><loc>${domain}${path}</loc></url>`).join('\n')}\n</urlset>\n`, 'utf8');
await writeFile(join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`, 'utf8');
console.log(`Built ${pages.length + legalPages.length} pages in ${output}`);

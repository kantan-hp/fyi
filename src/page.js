// kantan panel pages — vanilla HTML/CSS/JS, no framework. Deliberately minimal.
import { t, languageSwitcher, stringsFor } from './i18n.js';

const BASE = `:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0; background: #faf9f7; color: #1a1a1a; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  /* Sticky footer: the panel pins its footer to the viewport bottom on short
     pages and keeps it at the content bottom on long ones, so the language
     switcher sits at the same height on every page. */
  display: flex; flex-direction: column; min-height: 100vh;
}
a { color: #1a1a1a; }
.wrap { max-width: 680px; margin: 0 auto; padding: 2rem 1.25rem 4rem; flex: 1 0 auto; width: 100%; }
.btn {
  display: inline-block; font: inherit; font-size: .95rem; font-weight: 600;
  padding: .65rem 1.3rem; border-radius: 999px; border: 1px solid #1a1a1a;
  background: #fff; color: #1a1a1a; cursor: pointer; text-decoration: none;
}
.btn:hover { background: #f4f3f0; }
.btn.active { background: #1a1a1a; color: #fff; }
.btn.active:hover { opacity: .9; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn.danger { color: #b3261e; border-color: #b3261e; background: #fff; }
.btn.danger:hover { background: #fdecea; }
input[type="email"], input[type="text"], input[type="password"] {
  font: inherit; font-size: .95rem; width: 100%; padding: .6rem .8rem;
  border: 1px solid #d4d2cd; border-radius: 10px; background: #fff;
}
select { font: inherit; font-size: .9rem; padding: .5rem .7rem; border: 1px solid #d4d2cd; border-radius: 10px; background: #fff; }
.muted { color: #777; }
.err { color: #b3261e; }
.ok { color: #157f3d; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
.brand { display: inline-flex; align-items: center; gap: .45rem; font-weight: 700; font-size: 1.05rem; text-decoration: none; letter-spacing: -.01em; }
.brand-logo { width: 1.2rem; height: 1.2rem; display: block; flex-shrink: 0; }
.brand span { color: #9a9a9a; font-weight: 500; }
.card { background: #fff; border: 1px solid #e8e6e1; border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
.card h2 { font-size: 1rem; margin: 0; display: flex; align-items: center; gap: .6rem; }
.card p { font-size: .88rem; color: #555; margin: 0; }
/* Spacing scaffold: every card surface (welcome "How it works", the wizard
   steps, the login form, …) leans on one consistent vertical rhythm — a fixed
   gap between a card's direct children, tighter under the heading — instead of
   ad-hoc per-element margins. Forms get the same rhythm between their fields. */
.card > * + * { margin-top: .75rem; }
.card > h2 + * { margin-top: .4rem; }
form > * + * { margin-top: .75rem; }
/* A label directly above its control sits tight against it (not the full
   .75rem rhythm). */
.card label + select,
.card label + input[type="text"],
.card label + input[type="password"],
.card label + input[type="file"] { margin-top: .25rem; }
/* Collapse empty status/result/progress containers so they never leave a
   phantom gap before their JS fills them. */
#status:empty, #cf-status:empty, #result:empty, #progress:empty { display: none; }
.num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.5rem; border-radius: 50%;
  background: #1a1a1a; color: #fff; font-size: .78rem; flex-shrink: 0;
}
#step2, #step3, #wizard-submit { opacity: .45; pointer-events: none; transition: opacity .2s; }
#step2.enabled, #step3.enabled, #wizard-submit.enabled { opacity: 1; pointer-events: auto; }
.hidden { display: none; }
.status { font-size: .85rem; }
code { background: #f0efec; padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
ul.steps { list-style: none; padding: 0; margin: .75rem 0 0; font-size: .85rem; }
ul.steps li { padding: .15rem 0; }
table.sites { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .92rem; }
table.sites th, table.sites td { text-align: left; padding: .6rem .4rem; border-bottom: 1px solid #eee; overflow-wrap: anywhere; }
table.sites th:first-child, table.sites td:first-child { width: 60%; }
table.sites th:nth-child(2), table.sites td:nth-child(2) { width: 20%; }
table.sites th:last-child, table.sites td:last-child { width: 20%; }
table.sites th { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #999; }
.result { margin-top: .75rem; padding: .75rem 1rem; background: #f0f9f2; border: 1px solid #c8e6cf; border-radius: 10px; font-size: .85rem; }
.pbar { height: 8px; background: #eee; border-radius: 999px; overflow: hidden; margin: .75rem 0 .25rem; display: none; }
.pbar.visible { display: block; }
.pbar-fill { height: 100%; width: 0; background: #1a1a1a; border-radius: 999px; transition: width .35s ease; }
.pbar-fill.ok { background: #157f3d; }
.pbar-fill.err { background: #b3261e; }
.badge { display: inline-block; font-size: .72rem; font-weight: 600; padding: .14rem .5rem; border-radius: 999px; letter-spacing: .02em; }
.badge.uptodate { background: #e6f4ea; color: #157f3d; border: 1px solid #c8e6cf; }
.badge.update { background: #fff4e0; color: #8a5a00; border: 1px solid #f0d9a8; }
.badge.baseline { background: #f0efec; color: #555; border: 1px solid #ddd; }
.badge.dirty { background: #fdecea; color: #b3261e; border: 1px solid #f5c6c1; }
.btn.info-glyph { width: 1.9rem; height: 1.9rem; padding: 0; font-size: 1rem; font-weight: 700; line-height: 1; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; }
table.sites th:last-child { text-align: right; }
.ver { font-size: .78rem; color: #999; font-family: ui-monospace, SFMono-Regular, monospace; }
.ver.sha { word-break: break-all; }
.statusline { font-size: .85rem; margin-top: .5rem; }
ul.drift, ul.changes { list-style: none; padding: 0; margin: .4rem 0 0; font-size: .82rem; }
ul.drift li, ul.changes li { padding: .12rem 0; font-family: ui-monospace, SFMono-Regular, monospace; }
ul.drift li::before { content: "✗ "; color: #b3261e; }
ul.changes li.modified::before { content: "~ "; color: #8a5a00; }
ul.changes li.added::before { content: "+ "; color: #157f3d; }
ul.changes li.deleted::before { content: "- "; color: #b3261e; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: none; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal-backdrop.open { display: flex; }
.modal { background: #fff; border-radius: 16px; max-width: 560px; width: 100%; max-height: 85vh; overflow: auto; padding: 1.5rem; }
.modal h3 { margin: 0 0 .6rem; }
.modal .actions { display: flex; gap: .6rem; margin-top: 1.1rem; flex-wrap: wrap; }
tr.site-detail.hidden { display: none; }
tr.site-detail td { padding: 0; }
.detail-wrap { background: #faf9f7; border-top: 1px solid #eee; padding: .8rem 1.4rem 1rem; font-size: .88rem; }
.detail-row { display: flex; align-items: center; gap: .8rem; padding: .3rem 0; }
.detail-row .muted { width: 7.5rem; flex-shrink: 0; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
.upg .badge { margin-left: 0; }
.detail-reason { font-size: .8rem; color: #555; padding: .3rem 0 0 8.3rem; }
.detail-reason .err { display: block; }
.panel-footer { border-top: 1px solid #e8e6e1; padding: 1rem 1.25rem 1.5rem; flex-shrink: 0; }
.panel-footer .foot { max-width: 680px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
.gh-link { color: #777; display: inline-flex; align-items: center; transition: color .15s ease; }
.gh-link:hover { color: #1a1a1a; }
.lang-switch { position: relative; font-size: .85rem; }
.lang-toggle {
  display: inline-flex; align-items: center; gap: .4rem;
  font: inherit; font-size: .85rem; font-weight: 600; color: #1a1a1a;
  background: #fff; border: 1px solid #d4d2cd; border-radius: 999px;
  padding: .3rem .75rem; cursor: pointer;
}
.lang-toggle:hover { border-color: #1a1a1a; }
.lang-caret { font-size: .7rem; color: #777; transition: transform .15s ease; }
.lang-toggle[aria-expanded='true'] .lang-caret { transform: rotate(180deg); }
.lang-list {
  list-style: none; margin: 0; padding: .35rem;
  position: absolute; right: 0; bottom: calc(100% + .5rem);
  background: #fff; border: 1px solid #e8e6e1; border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,.08); min-width: 9rem; z-index: 60;
}
.lang-list li { margin: 0; }
.lang-list a { display: block; padding: .35rem .7rem; border-radius: 6px; color: #1a1a1a; text-decoration: none; }
.lang-list a:hover { background: #f4f3f0; }
.lang-list a[aria-current='true'] { font-weight: 600; }`;

// The kantan logo mark (a 32×32 PNG), inlined as a data URI so the panel serves
// it without any static asset. Used for the <link rel="icon">, the header
// brand lockup, and (via the /logo.png route in index.js) the magic-link email.
export const LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAC2VBMVEXxbD3xbj/xaTnwZTT7///xbT/xazvxbT7xbD7xazzxaDfxaDj6///xb0HxajrwYzHwZDPxbkDxajvwYjDxbDzxc0byfVPxb0DxZzfxcEPwZzfyglrwZTPxcELxZzbwYi/waDf3zb7xckXwZDL6/PzwYzLxcUPwaTn0pYj6+PfxZDPwajvxZjXwZjXyelD58Oz56ePyd0vxYzL44Nb3zLzzkG3xcUX3x7fxcUTyg1z30cLyflX439b3yrrxdEjyfVT3x7bygVn6+vnzimXzkm/1qY76+Pb69vT43NLygFjxdkr2vqrwXSrzkGz418rxc0f1pYj69fPyeU/yfFP31MfwYS7429Dyc0b1tJ3xdEfyf1byfFL58e30lnX2uqT1tZ71ooX40cP0lnTwajn6+/vzjmr42c71rpX1qY/42Mz3y7z0pIjzknD429HzjWjyc0fyeU758e769/X40sX3yLfyhF32vqn4z8H0qo/58O3xajz6+fjyfVLzlnXxckT6+fn67Of67ej3xrTxaTjwaDj1q5Hzj2v55NzwbT/68O3xbkHwZzjwbkDzl3byf1f0r5b42s755d767un45Nz408bxaTr0k3LwZzbwXyv2wa7zkG71oIP1sZnziGPziWTxYzD1uqT2uqXye1HzimbzhV73xLL3y7vxdUnwYC369/b0nX/yimX2uKLye1LyckX0q5D6+PX3zsDzh2HydUj54Nb69fTydEj67+rzlnT2wrD1sZj0nn/wXSnydkv2van0oYL43NP0nH3xb0L59PH0pYn0oIPxZTT7/v7wYzD56uT1rZT55t/69/T1qpD1pYr43tTziWP1rJL439X68u/6+ffwXin6+Pj2s5v449r43dT549v408f57enwXCj6//72x7b0n4H44tnzkW/0oYT45N368/H69PP0nX76/f32vafydkr57ur6+vj318r1n4H44dj3ybj45+D449vA7JDnAAAACXBIWXMAAAPoAAAD6AG1e1JrAAACbklEQVQ4y2NgIBGwMhKQl5LhwCfPyJ+awI1VhSArhOa0tRJgB7PYUezi5JcC8VmZ21iadMAKGJkEENIcfJFxSUZAcUYZFxZXZpBhHMKWGpwIBWySiZoaXEAGp6jDNOYuIK2QERMmgjCCncksjSebi51DUJhJRECXgZ2zgiUzmpMDWYVFlmKdCJPMEue5i+exM4t1lufLsaP4X51JkF1rtqI7C4vKVu/l2n0dTKyo/mRn52NbuNJtmcNSYx4Wv7Xz2dlRJEE83jU8+quYhX08L97iMVnHx87KyAj3hAQXG6/8ap5AU1U2XlmFqy7XnA5yCXYr67JCHSgp7Sg7XW0fj6uR0KYtl68zqN3mucQuIF2bxywE9ghnSbWTh3/wlSf+3Be2u91geXD3EctNOd9JPJrxvKDAEmEvq5+4QCzo6Scl7hCWXRa2vqGPWR5yOffb6EewQwKaqcZwhYDjm/fi3B7PDh1jVg6+o3KESU5eXFaADepMpqm8nGqKry2ZX/J47w3yus8SosTEKMjJxoHwJ4O48nOWD6GvzrMEuh++52fNzYuWHtiFhM3evninamd+8rTN0W1cDPycKCHNqCM2Z7P9R5VTbD6qwif2cAsZtipxI6lgZbZun6zH73mAxerc2YDdG2fy21cWi3LBVbCzFRgb2HELKojuPMNynGWDQW8zn2mRiSQ8vhn50wtLmRkZWIUEdgTsXz+rp4WBlT8nJVYLniw5w/XAbmIXl/daNEOqCsRMjhJlQziCD5bW2aZMYGOFhJ+EEEqEQ+V5Gxt4oRpZsWUPDi7zXD58OYtdQkyaix2vCm11dvy5lx1dHgDfoYlzFjxwegAAAABJRU5ErkJggg==';

// The kantan logo mark as a BIMI-compliant SVG (SVG Tiny 1.2), a run-length
// vector trace of the 32×32 PNG. Served at /logo.svg for the self-asserted BIMI
// record (default._bimi). Gmail ignores it without a VMC, but Apple Mail,
// Fastmail and Yahoo show the mark.
export const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" width="32" height="32" viewBox="0 0 32 32"><title>kantan</title><path fill="#f16c3d" d="M0,0h32v1h-32zM0,1h32v1h-32zM0,2h32v1h-32zM0,3h32v1h-32zM0,4h15v1h-15zM17,4h15v1h-15zM0,5h15v1h-15zM17,5h15v1h-15zM0,6h6v1h-6zM7,6h8v1h-8zM16,6h16v1h-16zM0,7h6v1h-6zM8,7h7v1h-7zM16,7h8v1h-8zM26,7h6v1h-6zM0,8h7v1h-7zM9,8h14v1h-14zM25,8h7v1h-7zM0,9h8v1h-8zM10,9h12v1h-12zM24,9h8v1h-8zM0,10h13v1h-13zM20,10h12v1h-12zM0,11h11v1h-11zM21,11h11v1h-11zM0,12h10v1h-10zM13,12h6v1h-6zM22,12h10v1h-10zM0,13h10v1h-10zM12,13h8v1h-8zM22,13h10v1h-10zM0,14h9v1h-9zM11,14h4v1h-4zM18,14h2v1h-2zM23,14h9v1h-9zM0,15h3v1h-3zM7,15h2v1h-2zM11,15h3v1h-3zM18,15h3v1h-3zM23,15h2v1h-2zM29,15h3v1h-3zM0,16h3v1h-3zM7,16h2v1h-2zM11,16h2v1h-2zM16,16h1v1h-1zM18,16h3v1h-3zM23,16h3v1h-3zM29,16h3v1h-3zM0,17h9v1h-9zM11,17h2v1h-2zM15,17h5v1h-5zM22,17h10v1h-10zM0,18h9v1h-9zM11,18h2v1h-2zM16,18h3v1h-3zM22,18h10v1h-10zM0,19h10v1h-10zM12,19h2v1h-2zM21,19h11v1h-11zM0,20h10v1h-10zM12,20h3v1h-3zM19,20h13v1h-13zM0,21h8v1h-8zM9,21h2v1h-2zM13,21h19v1h-19zM0,22h7v1h-7zM9,22h3v1h-3zM15,22h4v1h-4zM21,22h2v1h-2zM25,22h7v1h-7zM0,23h6v1h-6zM8,23h5v1h-5zM20,23h4v1h-4zM26,23h6v1h-6zM0,24h6v1h-6zM7,24h18v1h-18zM26,24h6v1h-6zM0,25h32v1h-32zM0,26h15v1h-15zM17,26h15v1h-15zM0,27h15v1h-15zM17,27h15v1h-15zM0,28h15v1h-15zM17,28h15v1h-15zM0,29h32v1h-32zM0,30h32v1h-32zM0,31h32v1h-32z"/><path fill="#ffffff" d="M15,4h2v1h-2zM15,5h2v1h-2zM6,6h1v1h-1zM15,6h1v1h-1zM6,7h2v1h-2zM15,7h1v1h-1zM24,7h2v1h-2zM7,8h2v1h-2zM23,8h2v1h-2zM8,9h2v1h-2zM22,9h2v1h-2zM13,10h7v1h-7zM11,11h10v1h-10zM10,12h3v1h-3zM19,12h3v1h-3zM10,13h2v1h-2zM20,13h2v1h-2zM9,14h2v1h-2zM15,14h3v1h-3zM20,14h3v1h-3zM3,15h4v1h-4zM9,15h2v1h-2zM14,15h4v1h-4zM21,15h2v1h-2zM25,15h4v1h-4zM3,16h4v1h-4zM9,16h2v1h-2zM13,16h3v1h-3zM17,16h1v1h-1zM21,16h2v1h-2zM26,16h3v1h-3zM9,17h2v1h-2zM13,17h2v1h-2zM20,17h2v1h-2zM9,18h2v1h-2zM13,18h3v1h-3zM19,18h3v1h-3zM10,19h2v1h-2zM14,19h7v1h-7zM10,20h2v1h-2zM15,20h4v1h-4zM8,21h1v1h-1zM11,21h2v1h-2zM7,22h2v1h-2zM12,22h3v1h-3zM19,22h2v1h-2zM23,22h2v1h-2zM6,23h2v1h-2zM13,23h7v1h-7zM24,23h2v1h-2zM6,24h1v1h-1zM25,24h1v1h-1zM15,26h2v1h-2zM15,27h2v1h-2zM15,28h2v1h-2z"/></svg>';

function shell(title, body, extraHead = '', { locale = 'en', pathname = '/' } = {}) {
  return `<!doctype html>
<html lang="${locale}" data-panel-lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — kantan</title>
<link rel="icon" type="image/png" href="data:image/png;base64,${LOGO_B64}" />
<style>${BASE}</style>
${extraHead}
</head>
<body>
${body}
<footer class="panel-footer"><div class="foot"><a class="gh-link" href="https://github.com/kantan-hp" target="_blank" rel="noopener" aria-label="GitHub" title="kantan-hp on GitHub"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></a>${languageSwitcher(locale, pathname)}</div></footer>
<script>
   // Logout is a POST (not a GET <a> link) so a cross-site <a>/<img> can't
   // CSRF-clear the victim's session (SameSite=Lax allows top-level GETs).
   function panelLogout() {
     fetch('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
       .then(function () { location.href = '/'; });
   }
   function wizardDisconnect() {
     fetch('/api/wizard/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
       .then(function () { location.href = '/app'; });
   }
   // Collapsed language switcher: click the toggle to expand all languages
  // (upward), click a language to navigate (full reload collapses it again),
  // click elsewhere to close.
  (function () {
    var list = document.getElementById('lang-list');
    var toggle = document.querySelector('.lang-toggle');
    if (!list || !toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = toggle.getAttribute('aria-expanded') === 'true';
      list.classList.toggle('hidden', open);
      toggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function () {
      if (!list.classList.contains('hidden')) {
        list.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  })();
</script>
</body>
</html>`;
}

// Embed the current locale's string table for the page's client-side script.
// JSON.stringify does not escape `<`, so a future translation containing
// `</script>` would terminate the block and run arbitrary JS — escape `<` (and
// U+2028/U+2029) so the payload can never break out of the inline <script>.
function i18nScript(locale) {
  const json = JSON.stringify(stringsFor(locale)).replace(/</g, '\\u003c');
  return `<script>window.I18N = ${json};</script>`;
}

function turnstileWidget(sitekey) {
  if (!sitekey) return '';
  // appearance=interaction-only: hidden by default; only rendered when
  // Cloudflare decides an interaction (challenge) is required. onTurnstileExpired
  // re-runs the check when the 300-s token lapses.
  return '<div class="cf-turnstile" data-sitekey="' + sitekey + '" data-appearance="interaction-only" data-callback="onTurnstileSuccess" data-error-callback="onTurnstileError" data-expired-callback="onTurnstileExpired" data-theme="light"></div>';
}

function turnstileScript(sitekey) {
  if (!sitekey) return '';
  return '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></scr' + 'ipt>';
}

export function welcomePage({ email }, { locale = 'en', pathname = '/' } = {}) {
  const cta = email
    ? `<a class="btn" href="/app">${t(locale, 'welcomeOpen')}</a>`
    : `<a class="btn" href="/login">${t(locale, 'welcomeGetStarted')}</a>`;
  return shell(
    t(locale, 'welcomeTitle'),
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/"><img class="brand-logo" src="data:image/png;base64,${LOGO_B64}" alt="" aria-hidden="true" />kantan<span> かんたん</span></a>
        ${email ? `<div style="font-size:.85rem" class="muted">${esc(email)} &nbsp;<a href="#" onclick="panelLogout()">${t(locale, 'navLogout')}</a></div>` : ''}
      </header>
      <h1 style="font-size:2.4rem; line-height:1.15; margin:2.5rem 0 .5rem; letter-spacing:-.02em">
        ${t(locale, 'welcomeH1')}
      </h1>
      <p style="font-size:1.1rem; color:#555; max-width:34rem">
        ${t(locale, 'welcomeIntro')}
      </p>
      <p style="margin:1.5rem 0 3rem">${cta}</p>
      <section class="card"><h2>${t(locale, 'welcomeHow')}</h2>
        <ol style="font-size:.95rem; margin-bottom:0; padding-left:1.1rem; color:#333">
          ${[1, 2, 3]
            .map((i) => {
              // "Title — description": bold only the title (before the em-dash).
              const [lead, rest] = t(locale, `welcomeStep${i}`).split(' — ');
              return `<li><strong>${lead}</strong>${rest ? ` — ${rest}` : ''}</li>`;
            })
            .join('')}
        </ol>
      </section>
      <section class="card"><h2>${t(locale, 'welcomeKeys')}</h2>
        <p>
          ${t(locale, 'welcomeKeysBody')}
        </p>
      </section>
    </main>`,
    '',
    { locale, pathname },
  );
}

export function loginPage({ error } = {}, { turnstileSitekey, locale = 'en', pathname = '/' } = {}) {
  return shell(
    t(locale, 'loginTitle'),
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/"><img class="brand-logo" src="data:image/png;base64,${LOGO_B64}" alt="" aria-hidden="true" />kantan<span> かんたん</span></a>
        <a class="muted" style="font-size:.85rem" href="/">${t(locale, 'navBack')}</a>
      </header>
      <div class="card">
        <h2>${t(locale, 'signIn')}</h2>
        <p>${t(locale, 'signInBody')}</p>
        <form id="login">
          <input type="email" id="email" placeholder="${t(locale, 'emailPlaceholder')}" required autofocus />
          ${turnstileWidget(turnstileSitekey)}
          <button class="btn" type="submit">${t(locale, 'emailMeLink')}</button>
        </form>
        <div class="status" id="status">${error ? `<span class="err">${error}</span>` : ''}</div>
      </div>
    </main>
    <script>
      const form = document.getElementById('login');
      const status = document.getElementById('status');
      const loginBtn = form.querySelector('button');
      const tsWidget = document.querySelector('.cf-turnstile');
      let turnstileOk = !tsWidget;
      const updateLoginBtn = () => { if (loginBtn) loginBtn.disabled = !turnstileOk; };
      // Escape HTML in dynamic text interpolated into status.innerHTML — the
      // server-returned error / devLink and the I18N strings flow into markup.
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const rerunTurnstile = () => {
        if (tsWidget && window.turnstile) {
          window.turnstile.reset(tsWidget);
          window.turnstile.execute(tsWidget);
          turnstileOk = false;
          updateLoginBtn();
        }
      };
      window.onTurnstileSuccess = () => { turnstileOk = true; updateLoginBtn(); };
      window.onTurnstileError = () => {
        turnstileOk = false;
        updateLoginBtn();
        status.innerHTML = '<span class="err">' + esc(window.I18N.verifFailed) + '</span>';
      };
      window.onTurnstileExpired = () => rerunTurnstile();
      updateLoginBtn();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginBtn;
        if (tsWidget && !turnstileOk) {
          status.innerHTML = '<span class="err">' + esc(window.I18N.completeVerification) + '</span>';
          return;
        }
        btn.disabled = true;
        status.innerHTML = '<span class="muted">' + esc(window.I18N.sending) + '</span>';
        const r = await fetch('/api/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            turnstile: (document.querySelector('input[name="cf-turnstile-response"]') || {}).value || '',
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          status.innerHTML = '<span class="err">' + esc(data.error || window.I18N.couldNotSend) + '</span>';
          rerunTurnstile();
          if (!(tsWidget && window.turnstile)) btn.disabled = false;
          return;
        }
        status.innerHTML = '<span class="ok">' + esc(window.I18N.checkInbox) + '</span>';
        btn.textContent = window.I18N.loginLinkSent;
        if (data.devLink) {
          status.insertAdjacentHTML('beforeend',
            '<br><span class="muted" style="font-size:.8rem">' + esc(window.I18N.devModeLink) + '</span>' +
            '<br><a href="' + esc(data.devLink) + '">' + esc(data.devLink) + '</a>');
        }
        // The link has been sent and the turnstile token is single-use. Leave
        // the button disabled and do NOT re-run the widget — re-running would
        // bounce the captcha straight back to "pending verification".
      });
    </script>`,
    i18nScript(locale) + turnstileScript(turnstileSitekey),
    { locale, pathname },
  );
}

// Escape HTML in dynamic page text. messagePage receives untrusted input (the
// worker's catch-all reflects err.message), so title/text are escaped here —
// never interpolate raw user/error content into the page.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escape a value for interpolation inside a single-quoted JS string that itself
 *  lives inside a double-quoted HTML attribute (e.g. onclick="fn('…')").
 *  esc() alone is not enough: &#39; is decoded back to ' by the HTML parser
 *  before the JS engine runs, so a ' would break the JS string. This escapes
 *  \ and ' for the JS layer first, then HTML-escaps the result for the
 *  attribute layer. Safe today (origin is URL-charset-constrained), but this
 *  closes the class so a future charset widening can't reintroduce it. */
function jsStr(s) {
  return esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

export function messagePage(title, text, { locale = 'en', pathname = '/' } = {}) {
  return shell(
    esc(title),
    `<main class="wrap"><div class="card">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <p><a class="btn" href="/">${t(locale, 'backToKantan')}</a></p>
    </div></main>`,
    '',
    { locale, pathname },
  );
}

export function appPage({ email, sites, hasSites }, { turnstileSitekey, locale = 'en', pathname = '/' } = {}) {
  const table = hasSites
    ? `<section class="card" id="sites-card">
        <h2>${t(locale, 'yourSites')}</h2>
        <table class="sites">
          <thead><tr><th>${t(locale, 'thSite')}</th><th>${t(locale, 'thCreated')}</th><th></th></tr></thead>
          <tbody>
            ${sites
              .map(
                (s) =>
                  `<tr class="site-row" data-origin="${s.origin}">
                    <td><a href="${s.origin}" target="_blank" rel="noopener" class="site-link">${s.origin.replace('https://', '')}</a>
                      <div class="muted" style="font-size:.72rem; margin-top:.1rem">${s.repo}</div>
                    </td>
                    <td class="muted">${new Date(s.created_at).toLocaleDateString(locale)}</td>
                    <td style="text-align:right; white-space:nowrap"><button class="btn info-glyph" title="${t(locale, 'moreInfo')}" aria-label="${t(locale, 'moreInfo')}" data-more="${s.origin}">i</button></td>
                  </tr>
                  <tr class="site-detail hidden" data-detail="${s.origin}">
                    <td colspan="3">
                      <div class="detail-wrap">
                        <div class="detail-row"><span class="muted">${t(locale, 'editorLabel')}</span> <a href="${s.origin}/admin" target="_blank" rel="noopener">${s.origin.replace('https://', '')}/admin</a></div>
                        <div class="detail-row"><span class="muted">${t(locale, 'upgradable')}</span> <span class="upg" data-upg="${s.origin}"><button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="${s.origin}">${t(locale, 'check')}</button></span></div>
                        <div class="detail-reason" data-reason="${s.origin}"></div>
                        <div class="detail-row"><button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-export="${s.origin}">${t(locale, 'exportContent')}</button> <button class="btn danger" style="padding:.3rem .7rem; font-size:.8rem" data-delete="${s.origin}" data-name="${s.project}">${t(locale, 'deleteSite')}</button></div>
                      </div>
                    </td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <button class="btn" id="new-site">${t(locale, 'createAnotherSite')}</button>
      </section>`
    : '';
  const wizardHidden = hasSites ? 'hidden' : '';
  return shell(
    t(locale, 'dashboardTitle'),
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/"><img class="brand-logo" src="data:image/png;base64,${LOGO_B64}" alt="" aria-hidden="true" />kantan<span> かんたん</span></a>
        <div style="font-size:.85rem" class="muted">${esc(email)} &nbsp;<a href="#" onclick="panelLogout()">${t(locale, 'navLogout')}</a></div>
      </header>

      ${table}

      <div id="wizard" class="${wizardHidden}">
      <section class="card">
        <h2><span class="num">1</span> ${t(locale, 'step1Title')}</h2>
        <p>${t(locale, 'step1Body')}</p>
        <div id="gh-logged-out">
          <button class="btn" onclick="localStorage.setItem('kantan-wizard-open','1'); location.href='/auth/github'">${t(locale, 'connectGithub')}</button>
        </div>
        <div id="gh-logged-in" class="hidden">
          <div class="status ok">✓ ${t(locale, 'connectedAs')} <strong id="gh-login"></strong>
            &nbsp;<a href="#" onclick="wizardDisconnect()" class="muted" style="font-size:.8rem">${t(locale, 'switchAccount')}</a>
          </div>
        </div>
      </section>

      <section class="card" id="step2">
        <h2><span class="num">2</span> ${t(locale, 'step2Title')}</h2>
        <p>${t(locale, 'step2Body')}</p>
        <input type="password" id="cf-token" placeholder="${t(locale, 'cfTokenPlaceholder')}" autocomplete="off" />
        <button class="btn" id="cf-verify">${t(locale, 'verifyToken')}</button>
        <div id="cf-account-picker" class="hidden">
          <label style="font-size:.8rem; color:#555" for="cf-account">${t(locale, 'cfAccount')}</label>
          <select id="cf-account" style="width:100%; font:inherit; font-size:.9rem; padding:.5rem .7rem; border:1px solid #d4d2cd; border-radius:10px; background:#fff; margin-top:.25rem"></select>
        </div>
        <div id="cf-account-id-field" class="hidden">
          <label style="font-size:.8rem; color:#555" for="cf-account-id">${t(locale, 'cfAccountId')}</label>
          <input type="text" id="cf-account-id" placeholder="e.g. 685065f0bb97a19eb21d063f9d5efdc6" autocomplete="off" style="margin-top:.25rem" />
          <p class="muted" style="font-size:.75rem; margin:.3rem 0 0">
            ${t(locale, 'cfAccountIdHint')}
          </p>
        </div>
        <div class="status" id="cf-status"></div>
      </section>

      <section class="card" id="step3">
        <h2><span class="num">3</span> ${t(locale, 'step3Title')}</h2>
        <p>${t(locale, 'step3Body').replace('<name>', '&lt;name&gt;')}</p>
        <input type="text" id="site-name" placeholder="${t(locale, 'siteNamePlaceholder')}" autocomplete="off" />
        <label style="font-size:.85rem; color:#555; display:flex; align-items:flex-start; gap:.5rem">
          <input type="checkbox" id="site-public" style="margin-top:.3rem" />
          <span style="display:block">
            ${t(locale, 'makePublic')}
            <span class="muted" style="display:block; font-size:.78rem">${t(locale, 'publicHint')}</span>
          </span>
        </label>
        <label style="font-size:.85rem; color:#555; display:flex; align-items:flex-start; gap:.5rem">
          <input type="checkbox" id="site-branded" checked style="margin-top:.3rem" />
          <span style="display:block">
            ${t(locale, 'assignBranded').replace('<name>', '<code>&lt;name&gt;</code>')}
            <span class="muted" style="display:block; font-size:.78rem">${t(locale, 'brandedHint')}</span>
          </span>
        </label>
        <div class="muted hidden" style="font-size:.78rem" id="branded-fallback-hint"></div>
        <label style="font-size:.85rem; color:#555; display:flex; align-items:center; gap:.5rem">
          <span style="min-width:5rem">${t(locale, 'languageLabel')}</span>
          <select id="site-lang" style="flex:1">
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-Hant">繁體中文</option>
            <option value="zh-Hans">简体中文</option>
          </select>
        </label>
        <label style="font-size:.85rem; color:#555; display:flex; align-items:flex-start; gap:.5rem">
          <input type="checkbox" id="bring-content" style="margin-top:.3rem" />
          <span style="display:block">
            ${t(locale, 'bringContent')}
            <span class="muted" style="display:block; font-size:.78rem">${t(locale, 'bringContentHint')}</span>
          </span>
        </label>
      </section>

      <section class="card hidden" id="step4">
        <h2><span class="num">4</span> ${t(locale, 'step4Title')}</h2>
        <p>${t(locale, 'step4Body')}</p>
        <label style="font-size:.85rem; color:#555; display:block">${t(locale, 'contentFromSite')}</label>
        <select id="content-source" style="width:100%; font:inherit; font-size:.9rem; padding:.5rem .7rem; border:1px solid #d4d2cd; border-radius:10px">
          <option value="">${t(locale, 'contentNone')}</option>
          ${sites.map((s) => `<option value="${s.origin}">${s.origin.replace('https://', '')}</option>`).join('')}
        </select>
        <label class="muted" style="display:block; font-size:.75rem">${t(locale, 'contentUploadBundle')}</label>
        <input type="file" id="content-bundle" accept=".zip" style="width:100%" />
      </section>

      <section class="card" id="wizard-submit">
        <h2><span class="num" id="submit-step">4</span> ${t(locale, 'stepConfirmTitle')}</h2>
        ${turnstileWidget(turnstileSitekey)}
        <button class="btn" id="create" disabled>${t(locale, 'createSite')}</button>
        <div class="pbar" id="pbar"><div class="pbar-fill" id="pbar-fill"></div></div>
        <ul class="steps" id="progress"></ul>
        <div id="result"></div>
      </section>
      </div>
    </main>

    <div class="modal-backdrop" id="update-modal">
      <div class="modal">
        <h3 id="um-title">${t(locale, 'update')}</h3>
        <div id="um-body"></div>
        <div class="actions" id="um-actions"></div>
      </div>
    </div>

    <script>
      const $ = (id) => document.getElementById(id);
      let cfToken = null, cfAccountId = null, ghConnected = false;
      const tsWidget = document.querySelector('.cf-turnstile');
      let turnstileOk = !tsWidget;

      // Pre-select the site language from the panel's current language
      // (window.I18N is the server-resolved locale's string table, but the
      // language itself comes from a data attribute set server-side).
      const selLang = document.getElementById('site-lang');
      if (selLang) selLang.value = document.documentElement.getAttribute('data-panel-lang') || 'en';

      window.onTurnstileSuccess = () => { turnstileOk = true; refreshCreateButton(); };
      window.onTurnstileError = () => {
        turnstileOk = false;
        refreshCreateButton();
        const result = $('result');
        if (result) {
          result.innerHTML = '<div class="status err">' + esc(window.I18N.verifFailed) + '</div>';
        }
      };
      window.onTurnstileExpired = () => resetTurnstile();

      const wizard = $('wizard');
      const newSite = $('new-site');
      if (newSite) newSite.onclick = () => {
        const nowHidden = wizard.classList.toggle('hidden');
        newSite.classList.toggle('active', !nowHidden);
      };

      function refreshCreateButton() {
        $('create').disabled = !(ghConnected && cfToken && cfAccountId && $('site-name').value.trim() && turnstileOk);
      }

      const resetTurnstile = () => {
        if (tsWidget && window.turnstile) {
          window.turnstile.reset(tsWidget);
          window.turnstile.execute(tsWidget);
          turnstileOk = false;
          refreshCreateButton();
        }
      };

      // Read the optional content bundle file as a base64 string (the data-URL
      // prefix is stripped) for the provision POST.
      const readBundle = () =>
        new Promise((resolve) => {
          const input = $('content-bundle');
          const file = input && input.files && input.files[0];
          if (!file) return resolve('');
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || '').split(',')[1] || '');
          fr.onerror = () => resolve('');
          fr.readAsDataURL(file);
        });

      async function init() {
        const r = await fetch('/api/wizard/me');
        if (r.ok) {
          const me = await r.json();
          ghConnected = true;
          $('gh-login').textContent = '@' + me.login;
          $('gh-logged-out').classList.add('hidden');
          $('gh-logged-in').classList.remove('hidden');
          $('step2').classList.add('enabled');
          refreshCreateButton();
        }
      }

      $('cf-verify').onclick = async () => {
        const token = $('cf-token').value.trim();
        const st = $('cf-status');
        if (!token) { st.className = 'status err'; st.textContent = window.I18N.pasteTokenFirst; return; }
        st.className = 'status muted'; st.textContent = window.I18N.checking;
        const r = await fetch('/api/cf/accounts', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await r.json();
        if (!r.ok) {
          st.className = 'status err';
          st.textContent = '✗ ' + (data.error || window.I18N.tokenRejected);
          return;
        }
        cfToken = token;
        $('cf-account-id-field').classList.add('hidden');
        $('cf-account-picker').classList.add('hidden');
        if (data.accounts.length === 1) {
          cfAccountId = data.accounts[0].id;
          st.className = 'status ok';
          st.textContent = '✓ ' + window.I18N.tokenWorksAccount + ' ' + data.accounts[0].name;
        } else if (data.accounts.length > 1) {
          cfAccountId = null;
          const sel = $('cf-account');
          sel.innerHTML = data.accounts
            .map((a) => '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>')
            .join('');
          sel.onchange = () => { cfAccountId = sel.value; refreshCreateButton(); };
          $('cf-account-picker').classList.remove('hidden');
          st.className = 'status ok';
          st.textContent = '✓ ' + window.I18N.tokenWorksAccount + ' ' + data.accounts.length + ' ' + window.I18N.accountsFound;
        } else {
          cfAccountId = null;
          const idInput = $('cf-account-id');
          idInput.value = '';
          idInput.oninput = () => { cfAccountId = idInput.value.trim() || null; refreshCreateButton(); };
          $('cf-account-id-field').classList.remove('hidden');
          st.className = 'status muted';
          st.textContent = window.I18N.tokenCantList;
        }
        $('step3').classList.add('enabled');
        $('wizard-submit').classList.add('enabled');
        refreshCreateButton();
      };

      const updateBrandedHint = () => {
        const name = $('site-name').value.trim();
        const hint = $('branded-fallback-hint');
        if ($('site-branded').checked && name.length > 0 && name.length < 4) {
          hint.textContent = window.I18N.tooShortBranded;
          hint.classList.remove('hidden');
        } else {
          hint.classList.add('hidden');
        }
      };
      $('site-name').oninput = () => { refreshCreateButton(); updateBrandedHint(); };
      $('site-branded').onchange = () => { updateBrandedHint(); };

      // Step 4 is conditional: it only appears when the user opts in to bringing
      // a previous site's content over (checkbox in step 3). Unchecking clears
      // any source/bundle the user already picked, so a stale selection can
      // never ride along on the provision POST after a final opt-out. The final
      // "Confirm creation" step renumbers (4 ⇄ 5) to match the visible steps.
      const step4 = $('step4');
      const submitStep = $('submit-step');
      const bringContent = $('bring-content');
      const syncStepNumber = () => {
        if (submitStep) submitStep.textContent = bringContent && bringContent.checked ? '5' : '4';
      };
      if (bringContent && step4) bringContent.onchange = () => {
        const show = bringContent.checked;
        step4.classList.toggle('hidden', !show);
        syncStepNumber();
        if (!show) {
          const src = $('content-source');
          if (src) src.value = '';
          const bundle = $('content-bundle');
          if (bundle) bundle.value = '';
        }
      };
      syncStepNumber();

      const pbar = $('pbar'), pfill = $('pbar-fill');
      let barAnim = null;
      const setBar = (width, cls) => {
        pfill.classList.remove('ok', 'err');
        if (cls) pfill.classList.add(cls);
        pfill.style.width = width;
      };
      const stopBar = () => { if (barAnim) clearInterval(barAnim); barAnim = null; };

      $('create').onclick = async () => {
        $('create').disabled = true;
        $('result').innerHTML = '';
        const prog = $('progress');
        prog.innerHTML = '';
        pbar.classList.add('visible');
        setBar('5%', null);
        const start = Date.now();
        const DURATION = 40000;
        barAnim = setInterval(() => {
          const t = Math.min(1, (Date.now() - start) / DURATION);
          pfill.style.width = (5 + 80 * t) + '%';
        }, 250);
        const addStep = (s) => {
          const li = document.createElement('li');
          li.textContent = (s.ok ? '✓ ' : '✗ ') + s.name + (s.detail ? ' — ' + s.detail : '');
          li.className = s.ok ? 'ok' : 'err';
          prog.appendChild(li);
        };
        let data;
        try {
          if ($('site-branded').checked && $('site-name').value.trim().length < 4) {
            $('site-branded').checked = false;
            updateBrandedHint();
          }
          const contentBundle = bringContent && bringContent.checked ? await readBundle() : '';
          const r = await fetch('/api/provision', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteName: $('site-name').value,
              cfToken, cfAccountId,
              public: $('site-public').checked,
              branded: $('site-branded').checked,
              lang: selLang ? selLang.value : 'en',
              contentSource: bringContent && bringContent.checked ? (($('content-source') || {}).value || '') : '',
              contentBundle,
              turnstile: (document.querySelector('input[name="cf-turnstile-response"]') || {}).value || '',
            }),
          });
          data = await r.json();
        } catch (err) {
          stopBar();
          setBar('85%', 'err');
          const div = document.createElement('div');
          div.className = 'status err';
          div.style.marginTop = '.5rem';
          div.textContent = window.I18N.provisioningFailed +
            ((err && err.message) ? err.message : window.I18N.couldNotReach) +
            window.I18N.partialCreate;
          $('result').appendChild(div);
          $('create').disabled = false;
          resetTurnstile();
          return;
        }
        stopBar();
        (data.steps || []).forEach(addStep);
        if (data.ok) {
          setBar('100%', 'ok');
          const meanwhile = (data.site.pagesDevUrl && data.site.pagesDevUrl !== data.site.url)
            ? '<br>' + esc(window.I18N.meanwhileLive) + ' <a href="' + esc(data.site.pagesDevUrl) + '" target="_blank" rel="noopener">' + esc(data.site.pagesDevUrl.replace('https://', '')) + '</a>'
            : '';
          $('result').innerHTML =
            '<div class="result"><strong>' + esc(window.I18N.yourSiteBuilding) + '</strong><br>' +
            esc(window.I18N.repo) + ' <a href="' + esc(data.site.repo) + '" target="_blank" rel="noopener">' + esc(data.site.repo.replace('https://github.com/', '')) + '</a><br>' +
            esc(window.I18N.site) + ' <a href="' + esc(data.site.url) + '" target="_blank" rel="noopener">' + esc(data.site.url.replace('https://', '')) + '</a>' + meanwhile + '<br>' +
            esc(window.I18N.editor) + ' <a href="' + esc(data.site.admin) + '" target="_blank" rel="noopener">' + esc(data.site.admin.replace('https://', '')) + '</a><br>' +
            '<span class="muted">' + esc(data.site.note) + '</span></div>';
          setTimeout(() => { location.href = '/app'; }, 2500);
        } else {
          setBar('85%', 'err');
          const div = document.createElement('div');
          div.className = 'status err';
          div.style.marginTop = '.5rem';
          div.textContent = data.error || window.I18N.provisioningFailed;
          $('result').appendChild(div);
          $('create').disabled = false;
          resetTurnstile();
        }
      };

      init();

      const modal = $('update-modal');
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const shortSha = (s) => s ? s.slice(0, 7) : '';
      const openModal = (title, body, actions) => {
        $('um-title').textContent = title;
        $('um-body').innerHTML = body;
        $('um-actions').innerHTML = actions;
        modal.classList.add('open');
      };
      const closeModal = () => modal.classList.remove('open');
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      const errorModal = (msg) => {
        openModal(window.I18N.somethingWentWrong, '<p class="err">' + esc(msg || window.I18N.couldNotReachPanel) + '</p>', '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
      };

      const apiPost = async (path, body) => {
        let r;
        try {
          r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) {
          errorModal(window.I18N.couldNotReachPanel + ((err && err.message) || err) + '.');
          return null;
        }
        if (r.status === 401) {
          const d = await r.json().catch(() => ({}));
          if (d.connectUrl) return { connectUrl: d.connectUrl };
          errorModal(window.I18N.notSignedIn);
          return null;
        }
        const data = await r.json().catch(() => ({}));
        if (!r.ok && !data.blocked) { errorModal(data.error || window.I18N.requestFailed.replace('{n}', r.status)); return null; }
        return data;
      };

      const REASON_TEXT = {
        dirty: window.I18N.reasonDirty,
        collision: window.I18N.reasonCollision,
        ci: window.I18N.reasonCi,
        legacy: window.I18N.reasonLegacy,
        unreadable: window.I18N.reasonUnreadable,
      };

      const upgHtml = (up) => {
        const s = up && up.upgradeable;
        const cls = s === 'yes' ? 'update' : s === 'no' ? 'uptodate' : 'dirty';
        const label = s === 'yes' ? window.I18N.yes : s === 'no' ? window.I18N.no : window.I18N.na;
        return '<span class="badge ' + esc(cls) + '">' + esc(label) + '</span>';
      };

      const toggleDetail = (origin) => {
        const detail = document.querySelector('[data-detail="' + origin + '"]');
        const btn = document.querySelector('[data-more="' + origin + '"]');
        if (detail) {
          const nowHidden = detail.classList.toggle('hidden');
          if (btn) btn.classList.toggle('active', !nowHidden);
        }
      };
      document.querySelectorAll('[data-more]').forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); toggleDetail(btn.dataset.more); };
      });
      document.querySelectorAll('.site-row').forEach((row) => {
        row.onclick = () => toggleDetail(row.dataset.origin);
      });
      document.querySelectorAll('.site-link').forEach((a) => {
        a.onclick = (e) => e.stopPropagation();
      });

      const renderCheck = (origin, data) => {
        const upgCell = document.querySelector('[data-upg="' + origin + '"]');
        const reasonCell = document.querySelector('[data-reason="' + origin + '"]');
        if (!upgCell) return;
        if (data && data.upgradeable) {
          upgCell.innerHTML = upgHtml(data);
          const reason = REASON_TEXT[data.reason];
          reasonCell.innerHTML = reason ? '<span class="err">' + esc(reason) + '</span>' : '';
          if (data.reason === 'legacy') {
            reasonCell.insertAdjacentHTML('beforeend', ' <button class="btn" data-baseline="' + esc(origin) + '" style="padding:.3rem .7rem; font-size:.8rem">' + esc(window.I18N.setBaseline) + '</button>');
          }
          if (data.upgradeable === 'yes') {
            upgCell.insertAdjacentHTML('beforeend', ' <button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-upgrade="' + esc(origin) + '">' + esc(window.I18N.update) + '</button>');
            upgCell.querySelector('[data-upgrade]').onclick = () => openUpdateModal(origin);
          }
        } else {
          upgCell.innerHTML = '<button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="' + esc(origin) + '">' + esc(window.I18N.check) + '</button>';
          upgCell.querySelector('[data-check]').onclick = () => runCheck(origin);
        }
      };

      const renderCheckButton = (origin, reason) => {
        const upgCell = document.querySelector('[data-upg="' + origin + '"]');
        const reasonCell = document.querySelector('[data-reason="' + origin + '"]');
        if (reasonCell) reasonCell.innerHTML = reason ? '<span class="err">' + esc(reason) + '</span>' : '';
        if (upgCell) {
          upgCell.innerHTML = '<button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="' + esc(origin) + '">' + esc(window.I18N.check) + '</button>';
        }
      };

      const runCheck = async (origin, { fromReturn = false } = {}) => {
        const upgCell = document.querySelector('[data-upg="' + origin + '"]');
        if (upgCell) upgCell.innerHTML = '<span class="muted" style="font-size:.8rem">' + esc(window.I18N.checking) + '</span>';
        const data = await apiPost('/api/sites/check', { origin });
        if (!data) {
          renderCheckButton(origin, window.I18N.couldNotCheck);
          return;
        }
        if (data.connectUrl) {
          if (fromReturn) {
            renderCheckButton(origin, window.I18N.ghConnectCancelled);
            return;
          }
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        renderCheck(origin, data);
      };

      (function returnToSite() {
        const pending = localStorage.getItem('kantan-check-site');
        if (!pending) return;
        localStorage.removeItem('kantan-check-site');
        const detail = document.querySelector('[data-detail="' + pending + '"]');
        if (detail) {
          detail.classList.remove('hidden');
          const btn = document.querySelector('[data-more="' + pending + '"]');
          if (btn) btn.classList.add('active');
        }
        runCheck(pending, { fromReturn: true });
      })();

      (function returnToWizard() {
        if (!localStorage.getItem('kantan-wizard-open')) return;
        localStorage.removeItem('kantan-wizard-open');
        if (wizard && wizard.classList.contains('hidden')) {
          wizard.classList.remove('hidden');
          if (newSite) newSite.classList.add('active');
        }
      })();

      window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        document.querySelectorAll('[data-upg]').forEach((cell) => {
          if (cell.textContent.includes(window.I18N.checking)) {
            renderCheckButton(cell.getAttribute('data-upg'), null);
          }
        });
      });

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-check]');
        if (btn) { e.stopPropagation(); runCheck(btn.dataset.check); return; }
        const baseline = e.target.closest('[data-baseline]');
        if (baseline) { e.stopPropagation(); runBaseline(baseline.dataset.baseline); return; }
        const del = e.target.closest('[data-delete]');
        if (del) { e.stopPropagation(); openDeleteModal(del.dataset.delete, del.dataset.name); return; }
        const exp = e.target.closest('[data-export]');
        if (exp) { e.stopPropagation(); exportContent(exp.dataset.export); }
      });

      async function exportContent(origin) {
        let r;
        try {
          r = await fetch('/api/sites/export', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ origin }),
          });
        } catch (err) {
          errorModal(window.I18N.couldNotReachPanel + ((err && err.message) || err) + '.');
          return;
        }
        if (r.status === 401) {
          const d = await r.json().catch(() => ({}));
          if (d.connectUrl) { localStorage.setItem('kantan-check-site', origin); location.href = d.connectUrl; return; }
          errorModal(window.I18N.notSignedIn);
          return;
        }
        if (!r.ok) { errorModal(window.I18N.exportFailed + ' (' + r.status + ')'); return; }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = origin.replace('https://', '') + '-content.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }

      function startFreshWithContent(origin) {
        closeModal();
        if (wizard) wizard.classList.remove('hidden');
        if (newSite) newSite.classList.add('active');
        if (bringContent) bringContent.checked = true;
        if (step4) step4.classList.remove('hidden');
        syncStepNumber();
        const sel = $('content-source');
        if (sel) sel.value = origin;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      async function runBaseline(origin) {
        const data = await apiPost('/api/sites/baseline', { origin });
        if (!data) return;
        if (data.connectUrl) {
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        if (data.ok) {
          renderCheckButton(origin, null);
          const cell = document.querySelector('[data-reason="' + origin + '"]');
          if (cell) cell.innerHTML = '<span class="ok">' + esc(window.I18N.baselineComplete) + '</span>';
        }
      }

      function openDeleteModal(origin, name) {
        openModal(
          window.I18N.deleteConfirmTitle,
          '<p class="err">' + esc(window.I18N.deleteConfirmBody) + '</p>' +
          '<label style="font-size:.85rem; display:block; margin:.25rem 0">' + esc(window.I18N.deleteCfToken) + '</label>' +
          '<input type="password" id="del-cf-token" placeholder="' + esc(window.I18N.cfTokenPlaceholder) + '" autocomplete="off" style="width:100%; font:inherit; font-size:.9rem; padding:.5rem .7rem; border:1px solid #d4d2cd; border-radius:10px" />' +
          '<label style="font-size:.85rem; display:block; margin:.5rem 0 .25rem">' + esc(window.I18N.deleteTypeName) + ' <code>' + esc(name) + '</code></label>' +
          '<input type="text" id="del-confirm" autocomplete="off" style="width:100%; font:inherit; font-size:.9rem; padding:.5rem .7rem; border:1px solid #d4d2cd; border-radius:10px" />',
          '<button class="btn danger" id="del-go">' + esc(window.I18N.deleteConfirm) + '</button>' +
          '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.deleteCancel) + '</button>',
        );
        $('del-go').onclick = () => doDelete(origin);
      }

      async function doDelete(origin) {
        const cfToken = ($('del-cf-token') || {}).value || '';
        const confirm = ($('del-confirm') || {}).value || '';
        openModal(window.I18N.deleting, '<p class="muted">' + esc(window.I18N.deleting) + '</p>', '');
        const data = await apiPost('/api/sites/delete', { origin, cfToken, confirm });
        if (!data) return;
        if (data.connectUrl) {
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        if (data.ok) {
          openModal(window.I18N.deleteComplete, '<p>' + esc(window.I18N.deleteComplete) + '</p>', '<button class="btn" onclick="location.href=\\'/app\\'">' + esc(window.I18N.done) + '</button>');
        } else {
          const remaining = data.remaining && data.remaining.length
            ? '<p class="err">' + esc(window.I18N.deleteRemaining) + '</p><ul>' + data.remaining.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>'
            : '';
          openModal(window.I18N.deleteFailed, '<p class="err">' + esc(data.error || window.I18N.deleteFailed) + '</p>' + remaining, '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
        }
      }

      async function openUpdateModal(origin) {
        openModal(window.I18N.checking, '<p class="muted">' + esc(window.I18N.comparing) + '</p>', '');
        const data = await apiPost('/api/sites/check', { origin });
        if (!data) return;
        if (data.connectUrl) {
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        if (data.upgradeable === 'no') {
          openModal(window.I18N.upToDate, '<p>' + esc(window.I18N.upToDateBody) + '</p>', '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
          renderCheck(origin, data);
          return;
        }
        if (data.upgradeable === 'N/A') {
          const reason = REASON_TEXT[data.reason] || window.I18N.updateNotAvailable;
          const escape = data.reason === 'dirty'
            ? '<button class="btn" onclick="startFreshWithContent(\\'' + jsStr(origin) + '\\')">' + esc(window.I18N.startFreshBringContent) + '</button>'
            : '';
          openModal(window.I18N.updateNotAvailable, '<p class="err">' + esc(reason) + '</p>' + (data.drifted && data.drifted.length ? '<p class="muted">' + esc(window.I18N.filesBlocking) + '</p><ul class="drift">' + data.drifted.map((d) => '<li>' + esc(d.path) + '</li>').join('') + '</ul>' : ''), escape + '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
          renderCheck(origin, data);
          return;
        }
        const changes = data.changes || [];
        const list = changes.slice(0, 30).map((c) => '<li class="' + esc(c.status) + '">' + esc(c.path) + '</li>').join('');
        const extra = changes.length > 30 ? '<p class="muted">' + esc(window.I18N.moreFiles.replace('{n}', String(changes.length - 30))) + '</p>' : '';
        let gates = '';
        if (data.majorBumps && data.majorBumps.length) gates += '<p class="err"><strong>' + window.I18N.majorBump.replace('{deps}', esc(data.majorBumps.join(', '))) + '</strong></p>';
        const body = '<p>' + window.I18N.updateFromTo.replace('{origin}', esc(origin)).replace('{from}', esc(shortSha(data.from))).replace('{to}', esc(shortSha(data.to))) + '</p>' +
          '<p>' + esc(window.I18N.filesNeverTouched) + '</p>' +
          '<ul class="changes">' + (list || '<li>' + esc(window.I18N.noCoreChanges) + '</li>') + '</ul>' + extra + gates;
        openModal(window.I18N.updateAvailable, body,
          '<button class="btn" id="update-go" data-origin="' + esc(origin) + '">' + window.I18N.updateTo.replace('{to}', esc(shortSha(data.to))) + '</button>' +
          '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
        $('update-go').onclick = () => doUpdate(origin, data.majorBumps && data.majorBumps.length > 0);
      }

      async function doUpdate(origin, major) {
        openModal(window.I18N.updating, '<p class="muted">' + esc(window.I18N.applyingUpdate) + '</p>', '');
        const data = await apiPost('/api/sites/update', { origin, confirmMajor: !!major });
        if (!data) return;
        if (data.ok) {
          openModal(window.I18N.updateComplete, '<p>' + window.I18N.updateCompleteBody.replace('{to}', esc(shortSha(data.to))).replace('{n}', String(data.changed)) + '</p><p><a href="' + esc(data.deployUrl) + '" target="_blank" rel="noopener">' + esc(window.I18N.viewBuild) + '</a></p>', '<button class="btn" onclick="location.href=\\'/app\\'">' + esc(window.I18N.done) + '</button>');
          renderCheck(origin, { upgradeable: 'no' });
        } else {
          let body = '<p class="err">' + esc(data.error || window.I18N.updateFailed) + '</p>';
          if (data.blocked === 'major') body = '<p>' + window.I18N.majorConfirmBody.replace('{deps}', esc((data.majorBumps || []).join(', '))) + '</p><p class="err">' + esc(window.I18N.majorConfirmPrompt) + '</p>';
          openModal(window.I18N.updateFailed, body, (data.blocked === 'major'
            ? '<button class="btn" onclick="doUpdate(\\'' + jsStr(origin) + '\\', true)">' + esc(window.I18N.confirmAnyway) + '</button>'
            : '') + '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">' + esc(window.I18N.close) + '</button>');
        }
      }
    </script>`,
    i18nScript(locale) + turnstileScript(turnstileSitekey),
    { locale, pathname },
  );
}

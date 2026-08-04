// kantan panel pages — vanilla HTML/CSS/JS, no framework. Deliberately minimal.

const BASE = `:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0; background: #faf9f7; color: #1a1a1a; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: #1a1a1a; }
.wrap { max-width: 680px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.btn {
  display: inline-block; font: inherit; font-size: .95rem; font-weight: 600;
  padding: .65rem 1.3rem; border-radius: 999px; border: 1px solid #1a1a1a;
  background: #fff; color: #1a1a1a; cursor: pointer; text-decoration: none;
}
.btn:hover { background: #f4f3f0; }
.btn.active { background: #1a1a1a; color: #fff; }
.btn.active:hover { opacity: .9; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
input[type="email"], input[type="text"], input[type="password"] {
  font: inherit; font-size: .95rem; width: 100%; padding: .6rem .8rem;
  border: 1px solid #d4d2cd; border-radius: 10px; background: #fff;
}
.muted { color: #777; }
.err { color: #b3261e; }
.ok { color: #157f3d; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
.brand { font-weight: 700; font-size: 1.05rem; text-decoration: none; letter-spacing: -.01em; }
.brand span { color: #9a9a9a; font-weight: 500; }
.card { background: #fff; border: 1px solid #e8e6e1; border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
.card h2 { font-size: 1rem; margin: 0 0 .4rem; display: flex; align-items: center; gap: .6rem; }
.card p { font-size: .88rem; color: #555; margin: .2rem 0 .8rem; }
.num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.5rem; border-radius: 50%;
  background: #1a1a1a; color: #fff; font-size: .78rem; flex-shrink: 0;
}
#step2, #step3 { opacity: .45; pointer-events: none; transition: opacity .2s; }
#step2.enabled, #step3.enabled { opacity: 1; pointer-events: auto; }
.hidden { display: none; }
.status { font-size: .85rem; margin-top: .5rem; }
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
.detail-reason .err { display: block; }`;

function shell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — kantan</title>
<style>${BASE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function welcomePage({ email }) {
  const cta = email
    ? `<a class="btn" href="/app">Open your dashboard</a>`
    : `<a class="btn" href="/login">Get started</a>`;
  return shell(
    'kantan — publish a blog in minutes',
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/">kantan<span> かんたん</span></a>
        ${email ? `<a class="muted" style="font-size:.85rem" href="/app">Dashboard</a>` : ''}
      </header>
      <h1 style="font-size:2.4rem; line-height:1.15; margin:2.5rem 0 .5rem; letter-spacing:-.02em">
        A free blog you can <em>actually</em> publish to in minutes.
      </h1>
      <p style="font-size:1.1rem; color:#555; max-width:34rem">
        kantan (かんたん) means <strong>simple</strong>. Sign in with just your email,
        and kantan wires up your GitHub repo, hosting, and editor for you.
      </p>
      <p style="margin:1.5rem 0 3rem">${cta}</p>
      <section class="card"><h2>How it works</h2>
        <ol style="font-size:.95rem; margin:.5rem 0 0; padding-left:1.1rem; color:#333">
          <li><strong>Sign in with your email</strong> — no passwords, no GitHub login for the panel.</li>
          <li><strong>Connect GitHub + Cloudflare</strong> — one paste of a Cloudflare token; kantan creates everything.</li>
          <li><strong>Write & publish</strong> — edit posts in a friendly editor; every save rebuilds your site.</li>
        </ol>
      </section>
      <section class="card"><h2>Your keys stay yours</h2>
        <p style="margin-bottom:0">
          kantan never stores your GitHub or Cloudflare credentials. They are used for the
          seconds it takes to create your site, written into <strong>your own repository</strong>
          as deployment secrets, and discarded. You can revoke or rotate them any time.
        </p>
      </section>
    </main>`,
  );
}

export function loginPage({ error } = {}) {
  return shell(
    'Sign in — kantan',
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/">kantan<span> かんたん</span></a>
        <a class="muted" style="font-size:.85rem" href="/">Back</a>
      </header>
      <div class="card" style="max-width:420px">
        <h2>Sign in</h2>
        <p>Enter your email and we'll send you a one-time login link.</p>
        <form id="login">
          <input type="email" id="email" placeholder="you@example.com" required autofocus />
          <button class="btn" type="submit" style="margin-top:.75rem; width:100%">Email me a login link</button>
        </form>
        <div class="status" id="status">${error ? `<span class="err">${error}</span>` : ''}</div>
      </div>
    </main>
    <script>
      const form = document.getElementById('login');
      const status = document.getElementById('status');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        btn.disabled = true;
        status.innerHTML = '<span class="muted">Sending…</span>';
        const r = await fetch('/api/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('email').value }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          status.innerHTML = '<span class="err">' + (data.error || 'Could not send the link.') + '</span>';
          btn.disabled = false;
          return;
        }
        status.innerHTML = '<span class="ok">✓ Check your inbox — the link expires in 15 minutes.</span>';
        if (data.devLink) {
          status.insertAdjacentHTML('beforeend',
            '<br><span class="muted" style="font-size:.8rem">No email provider configured (dev mode). Link:</span>' +
            '<br><a href="' + data.devLink + '">' + data.devLink + '</a>');
        }
      });
    </script>`,
  );
}

export function messagePage(title, text) {
  return shell(
    title,
    `<main class="wrap"><div class="card">
      <h2>${title}</h2>
      <p>${text}</p>
      <p><a class="btn" href="/">Back to kantan</a></p>
    </div></main>`,
  );
}

export function appPage({ email, sites, hasSites }) {
  const table = hasSites
    ? `<section class="card" id="sites-card">
        <h2>Your sites</h2>
        <table class="sites">
          <thead><tr><th>Site</th><th>Created</th><th></th></tr></thead>
          <tbody>
            ${sites
              .map(
                (s) =>
                  `<tr class="site-row" data-origin="${s.origin}">
                    <td><a href="${s.origin}" target="_blank" rel="noopener" class="site-link">${s.origin.replace('https://', '')}</a>
                      <div class="muted" style="font-size:.72rem; margin-top:.1rem">${s.repo}</div>
                    </td>
                    <td class="muted">${new Date(s.created_at).toLocaleDateString()}</td>
                    <td style="text-align:right; white-space:nowrap"><button class="btn info-glyph" title="More info" aria-label="More info" data-more="${s.origin}">i</button></td>
                  </tr>
                  <tr class="site-detail hidden" data-detail="${s.origin}">
                    <td colspan="3">
                      <div class="detail-wrap">
                        <div class="detail-row"><span class="muted">Editor</span> <a href="${s.origin}/admin" target="_blank" rel="noopener">${s.origin.replace('https://', '')}/admin</a></div>
                        <div class="detail-row"><span class="muted">Upgradable</span> <span class="upg" data-upg="${s.origin}"><button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="${s.origin}">check</button></span></div>
                        <div class="detail-reason" data-reason="${s.origin}"></div>
                      </div>
                    </td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <button class="btn" id="new-site" style="margin-top:.75rem">Create another site</button>
      </section>`
    : '';
  const wizardHidden = hasSites ? 'hidden' : '';
  return shell(
    'Dashboard — kantan',
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/">kantan<span> かんたん</span></a>
        <div style="font-size:.85rem" class="muted">${email} &nbsp;<a href="/api/logout">logout</a></div>
      </header>

      ${table}

      <div id="wizard" class="${wizardHidden}">
      <section class="card">
        <h2><span class="num">1</span> Connect GitHub</h2>
        <p>Your site lives in a new repository in your GitHub account. We ask for
           <code>repo</code> access so we can create it and set it up for you.</p>
        <div id="gh-logged-out">
          <button class="btn" onclick="localStorage.setItem('kantan-wizard-open','1'); location.href='/auth/github'">Connect GitHub</button>
        </div>
        <div id="gh-logged-in" class="hidden">
          <div class="status ok">✓ Connected as <strong id="gh-login"></strong>
            &nbsp;<a href="/api/wizard/logout" class="muted" style="font-size:.8rem">switch account</a>
          </div>
        </div>
      </section>

      <section class="card" id="step2">
        <h2><span class="num">2</span> Connect Cloudflare</h2>
        <p>Paste an API token with <strong>Cloudflare Pages: Edit</strong> and
           <strong>Account Settings: Read</strong>
           (<a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">create one</a> →
           "Create Custom Token" → add both permissions). Account Settings: Read lets us
           detect your account automatically; the token is used once to create your site
           and is never stored here.</p>
        <input type="password" id="cf-token" placeholder="Cloudflare API token" autocomplete="off" />
        <button class="btn" id="cf-verify">Verify token</button>
        <div id="cf-account-picker" class="hidden" style="margin:.5rem 0">
          <label style="font-size:.8rem; color:#555" for="cf-account">Cloudflare account</label>
          <select id="cf-account" style="width:100%; font:inherit; font-size:.9rem; padding:.5rem .7rem; border:1px solid #d4d2cd; border-radius:10px; background:#fff; margin-top:.25rem"></select>
        </div>
        <div id="cf-account-id-field" class="hidden" style="margin:.5rem 0">
          <label style="font-size:.8rem; color:#555" for="cf-account-id">Cloudflare account ID</label>
          <input type="text" id="cf-account-id" placeholder="e.g. 685065f0bb97a19eb21d063f9d5efdc6" autocomplete="off" style="margin-top:.25rem" />
          <p class="muted" style="font-size:.75rem; margin:.3rem 0 0">
            This token can't list accounts, so enter the account ID it belongs to
            (dash.cloudflare.com → select the account → it's in the URL), or add
            <em>Account Settings: Read</em> to the token and re-verify.
          </p>
        </div>
        <div class="status" id="cf-status"></div>
      </section>

      <section class="card" id="step3">
        <h2><span class="num">3</span> Name your site</h2>
        <p>This becomes your repository name and your free address:
           <code>&lt;name&gt;.pages.dev</code></p>
        <input type="text" id="site-name" placeholder="my-blog" autocomplete="off" />
        <label style="font-size:.85rem; color:#555; display:flex; align-items:center; gap:.5rem; margin:.1rem 0 .8rem">
          <input type="checkbox" id="site-public" /> Make this repository public
          <span class="muted" style="font-size:.78rem">(your site itself is always public)</span>
        </label>
        <label style="font-size:.85rem; color:#555; display:flex; align-items:center; gap:.5rem; margin:.1rem 0 .8rem">
          <input type="checkbox" id="site-branded" checked /> Assign me <code>&lt;name&gt;.kantan-hp.fyi</code> too
          <span class="muted" style="font-size:.78rem">(a branded address on kantan-hp.fyi; uncheck for pages.dev only)</span>
        </label>
        <div class="muted hidden" style="font-size:.78rem; margin:-.4rem 0 .8rem" id="branded-fallback-hint"></div>
        <button class="btn" id="create" disabled>Create my website</button>
        <div class="pbar" id="pbar"><div class="pbar-fill" id="pbar-fill"></div></div>
        <ul class="steps" id="progress"></ul>
        <div id="result"></div>
      </section>
      </div>
    </main>

    <div class="modal-backdrop" id="update-modal">
      <div class="modal">
        <h3 id="um-title">Update</h3>
        <div id="um-body"></div>
        <div class="actions" id="um-actions"></div>
      </div>
    </div>

    <script>
      const $ = (id) => document.getElementById(id);
      let cfToken = null, cfAccountId = null, ghConnected = false;

      const wizard = $('wizard');
      const newSite = $('new-site');
      if (newSite) newSite.onclick = () => {
        const nowHidden = wizard.classList.toggle('hidden');
        newSite.classList.toggle('active', !nowHidden);
      };

      function refreshCreateButton() {
        $('create').disabled = !(ghConnected && cfToken && cfAccountId && $('site-name').value.trim());
      }

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
        if (!token) { st.className = 'status err'; st.textContent = 'Paste a token first.'; return; }
        st.className = 'status muted'; st.textContent = 'Checking…';
        const r = await fetch('/api/cf/accounts', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await r.json();
        if (!r.ok) {
          st.className = 'status err';
          st.textContent = '✗ ' + (data.error || 'Token rejected. Needs "Cloudflare Pages: Edit".');
          return;
        }
        cfToken = token;
        $('cf-account-id-field').classList.add('hidden');
        $('cf-account-picker').classList.add('hidden');
        if (data.accounts.length === 1) {
          cfAccountId = data.accounts[0].id;
          st.className = 'status ok';
          st.textContent = '✓ Token works — account: ' + data.accounts[0].name;
        } else if (data.accounts.length > 1) {
          cfAccountId = null;
          const sel = $('cf-account');
          sel.innerHTML = data.accounts
            .map((a) => '<option value="' + a.id + '">' + a.name + '</option>')
            .join('');
          sel.onchange = () => { cfAccountId = sel.value; refreshCreateButton(); };
          $('cf-account-picker').classList.remove('hidden');
          st.className = 'status ok';
          st.textContent = '✓ Token works — ' + data.accounts.length +
            ' accounts found. Select the one to use:';
        } else {
          cfAccountId = null;
          const idInput = $('cf-account-id');
          idInput.value = '';
          idInput.oninput = () => { cfAccountId = idInput.value.trim() || null; refreshCreateButton(); };
          $('cf-account-id-field').classList.remove('hidden');
          st.className = 'status muted';
          st.textContent = '✓ Token authenticates, but cannot list accounts. ' +
            'Enter the Cloudflare account ID it belongs to, or add "Account Settings: Read".';
        }
        $('step3').classList.add('enabled');
        refreshCreateButton();
      };

      // Short names can't carry a branded address. Show a live hint while
      // typing, but only act on the FINAL submitted name (in the create handler
      // below) so a name that grows to >=4 chars keeps the default-checked box.
      const updateBrandedHint = () => {
        const name = $('site-name').value.trim();
        const hint = $('branded-fallback-hint');
        if ($('site-branded').checked && name.length > 0 && name.length < 4) {
          hint.textContent = 'Too short for a branded address — will use pages.dev only.';
          hint.classList.remove('hidden');
        } else {
          hint.classList.add('hidden');
        }
      };
      $('site-name').oninput = () => { refreshCreateButton(); updateBrandedHint(); };
      $('site-branded').onchange = () => { updateBrandedHint(); };

      // Progress bar: simulated advance while the single provisioning POST runs
      // (there is no per-step streaming yet), then snap to 100% (ok) or 85% (err).
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
        const DURATION = 40000; // provisioning typically takes tens of seconds
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
          // Fall back to pages.dev-only for names too short to carry a branded
          // address, evaluated on the FINAL name so a box the user left checked
          // doesn't hard-fail (and never silently unchecks a name that grew).
          if ($('site-branded').checked && $('site-name').value.trim().length < 4) {
            $('site-branded').checked = false;
            updateBrandedHint();
          }
          const r = await fetch('/api/provision', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteName: $('site-name').value,
              cfToken, cfAccountId,
              public: $('site-public').checked,
              branded: $('site-branded').checked,
            }),
          });
          data = await r.json();
        } catch (err) {
          stopBar();
          setBar('85%', 'err');
          const div = document.createElement('div');
          div.className = 'status err';
          div.style.marginTop = '.5rem';
          div.textContent = 'Provisioning failed: ' +
            ((err && err.message) ? err.message : 'could not reach the server') +
            '. Your site may be partially created; check GitHub and retry.';
          $('result').appendChild(div);
          $('create').disabled = false;
          return;
        }
        stopBar();
        (data.steps || []).forEach(addStep);
        if (data.ok) {
          setBar('100%', 'ok');
          const meanwhile = (data.site.pagesDevUrl && data.site.pagesDevUrl !== data.site.url)
            ? '<br>Meanwhile it\'s live at: <a href="' + data.site.pagesDevUrl + '" target="_blank" rel="noopener">' + data.site.pagesDevUrl.replace('https://', '') + '</a>'
            : '';
          $('result').innerHTML =
            '<div class="result"><strong>Your site is being built.</strong><br>' +
            'Repo: <a href="' + data.site.repo + '" target="_blank" rel="noopener">' + data.site.repo.replace('https://github.com/', '') + '</a><br>' +
            'Site: <a href="' + data.site.url + '" target="_blank" rel="noopener">' + data.site.url.replace('https://', '') + '</a>' + meanwhile + '<br>' +
            'Editor: <a href="' + data.site.admin + '" target="_blank" rel="noopener">' + data.site.admin.replace('https://', '') + '</a><br>' +
            '<span class="muted">' + data.site.note + '</span></div>';
          setTimeout(() => { location.href = '/app'; }, 2500);
        } else {
          setBar('85%', 'err');
          const div = document.createElement('div');
          div.className = 'status err';
          div.style.marginTop = '.5rem';
          div.textContent = data.error || 'Provisioning failed.';
          $('result').appendChild(div);
          $('create').disabled = false;
        }
      };

      init();

      // ---- More info slide-down + upgrade check flow --------------------
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
        openModal('Something went wrong', '<p class="err">' + esc(msg || 'The panel could not be reached.') + '</p>', '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">Close</button>');
      };

      const apiPost = async (path, body) => {
        let r;
        try {
          r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) {
          errorModal('Could not reach the panel: ' + ((err && err.message) || err) + '. Try again.');
          return null;
        }
        if (r.status === 401) {
          const d = await r.json().catch(() => ({}));
          if (d.connectUrl) return { connectUrl: d.connectUrl };
          errorModal('Not signed in.');
          return null;
        }
        const data = await r.json().catch(() => ({}));
        // 409 {blocked:...} is a handled state (e.g. major-bump confirm), not a
        // generic error — let it through so the caller can act on data.blocked.
        if (!r.ok && !data.blocked) { errorModal(data.error || ('Request failed (' + r.status + ').')); return null; }
        return data;
      };

      const REASON_TEXT = {
        dirty: 'Your site has core files that differ from the template — updates are blocked so your changes are never overwritten.',
        collision: 'The template now adds files that already exist in your site — the update would overwrite them.',
        ci: 'The template is not passing its own CI right now — updates are held until it is green.',
        legacy: 'This site was created before version tracking existed. Upgrades are not offered for it yet.',
        unreadable: 'The site repo could not be read (private, deleted, or no access).',
      };

      const upgHtml = (up) => {
        const s = up && up.upgradeable;
        const cls = s === 'yes' ? 'update' : s === 'no' ? 'uptodate' : 'dirty';
        const label = s === 'yes' ? 'Yes' : s === 'no' ? 'No' : 'N/A';
        return '<span class="badge ' + cls + '">' + label + '</span>';
      };

      // Row click / More info toggles the slide-down. The site link itself keeps
      // navigating directly (stopPropagation on the anchor). While open, the
      // More info button flips to the filled style (same as 'Create another
      // site').
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
          if (data.upgradeable === 'yes') {
            upgCell.insertAdjacentHTML('beforeend', ' <button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-upgrade="' + esc(origin) + '">Update</button>');
            upgCell.querySelector('[data-upgrade]').onclick = () => openUpdateModal(origin);
          }
        } else {
          upgCell.innerHTML = '<button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="' + esc(origin) + '">check</button>';
          upgCell.querySelector('[data-check]').onclick = () => runCheck(origin);
        }
      };

      // Render the idle [check] button for a site's upgradable cell, optionally
      // with a reason (e.g. a cancelled connect or a failed fetch).
      const renderCheckButton = (origin, reason) => {
        const upgCell = document.querySelector('[data-upg="' + origin + '"]');
        const reasonCell = document.querySelector('[data-reason="' + origin + '"]');
        if (reasonCell) reasonCell.innerHTML = reason ? '<span class="err">' + esc(reason) + '</span>' : '';
        if (upgCell) {
          upgCell.innerHTML = '<button class="btn" style="padding:.3rem .7rem; font-size:.8rem" data-check="' + esc(origin) + '">check</button>';
        }
      };

      const runCheck = async (origin, { fromReturn = false } = {}) => {
        const upgCell = document.querySelector('[data-upg="' + origin + '"]');
        if (upgCell) upgCell.innerHTML = '<span class="muted" style="font-size:.8rem">Checking…</span>';
        const data = await apiPost('/api/sites/check', { origin });
        if (!data) {
          // Fetch failed (network / 500): settle back to the check button instead
          // of leaving the cell stuck on "Checking…" forever.
          renderCheckButton(origin, 'Could not check — click check to retry.');
          return;
        }
        if (data.connectUrl) {
          if (fromReturn) {
            // We just came back from the OAuth round-trip and still have no
            // token (the user cancelled or the flow failed). Reset to the check
            // state instead of looping back into /auth/github.
            renderCheckButton(origin, 'GitHub connect was cancelled or failed — click check to retry.');
            return;
          }
          // No active GitHub connect: remember which site to re-check on return.
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        renderCheck(origin, data);
      };

      // Return-to-site: after the /auth/github round-trip the panel reloads at
      // /app; reopen the site we were checking and run the check in place.
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

      // Return-to-wizard: the wizard's Connect GitHub button stores this flag
      // before navigating; on return /app otherwise re-hides the wizard (because
      // the user has sites). Reopen it so the three steps stay visible.
      (function returnToWizard() {
        if (!localStorage.getItem('kantan-wizard-open')) return;
        localStorage.removeItem('kantan-wizard-open');
        if (wizard && wizard.classList.contains('hidden')) {
          wizard.classList.remove('hidden');
          if (newSite) newSite.classList.add('active');
        }
      })();

      // If the page is restored from the back/forward cache (refresh/back while
      // a check was mid-flight), the DOM comes back with the cell stuck on
      // "Checking…" and the script does not re-run. Reset only cells that are
      // still pending — completed results (yes/no/N-A + Update button) survive
      // the restore untouched.
      window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        document.querySelectorAll('[data-upg]').forEach((cell) => {
          if (cell.textContent.includes('Checking…')) {
            renderCheckButton(cell.getAttribute('data-upg'), null);
          }
        });
      });

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-check]');
        if (btn) { e.stopPropagation(); runCheck(btn.dataset.check); }
      });

      async function openUpdateModal(origin) {
        openModal('Checking…', '<p class="muted">Comparing your site against the template…</p>', '');
        const data = await apiPost('/api/sites/check', { origin });
        if (!data) return;
        if (data.connectUrl) {
          localStorage.setItem('kantan-check-site', origin);
          location.href = data.connectUrl;
          return;
        }
        if (data.upgradeable === 'no') {
          openModal('Up to date', '<p>Your site already runs the current template core.</p>', '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">Close</button>');
          renderCheck(origin, data);
          return;
        }
        if (data.upgradeable === 'N/A') {
          const reason = REASON_TEXT[data.reason] || 'This site cannot be updated right now.';
          openModal('Update not available', '<p class="err">' + esc(reason) + '</p>' + (data.drifted && data.drifted.length ? '<p class="muted">Files that block the update:</p><ul class="drift">' + data.drifted.map((d) => '<li>' + esc(d.path) + '</li>').join('') + '</ul>' : ''), '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">Close</button>');
          renderCheck(origin, data);
          return;
        }
        // yes: diff summary + gates, then confirm.
        const changes = data.changes || [];
        const list = changes.slice(0, 30).map((c) => '<li class="' + esc(c.status) + '">' + esc(c.path) + '</li>').join('');
        const extra = changes.length > 30 ? '<p class="muted">…and ' + (changes.length - 30) + ' more</p>' : '';
        let gates = '';
        if (data.majorBumps && data.majorBumps.length) gates += '<p class="err"><strong>Major version bump:</strong> ' + esc(data.majorBumps.join(', ')) + '. This can change the look or break customizations — review before updating.</p>';
        const body = '<p>Updating <code>' + esc(origin) + '</code> from template <code>' + shortSha(data.from) + '</code> to <code>' + shortSha(data.to) + '</code>.</p>' +
          '<p>Your posts, images and settings are never touched. Files that change:</p>' +
          '<ul class="changes">' + (list || '<li>no core file changes</li>') + '</ul>' + extra + gates;
        openModal('Update available', body,
          '<button class="btn" id="update-go" data-origin="' + esc(origin) + '">Update to ' + shortSha(data.to) + '</button>' +
          '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">Close</button>');
        $('update-go').onclick = () => doUpdate(origin, data.majorBumps && data.majorBumps.length > 0);
      }

      async function doUpdate(origin, major) {
        openModal('Updating…', '<p class="muted">Applying the update and rebuilding your site. This takes a minute or two.</p>', '');
        const data = await apiPost('/api/sites/update', { origin, confirmMajor: !!major });
        if (!data) return;
        if (data.ok) {
          openModal('Update complete', '<p>Your site is updated to template <code>' + shortSha(data.to) + '</code> (' + data.changed + ' file(s) changed). The deploy has been triggered — it takes a minute or two to go live.</p><p><a href="' + esc(data.deployUrl) + '" target="_blank" rel="noopener">View the build</a></p>', '<button class="btn" onclick="location.href=\\'/app\\'">Done</button>');
          renderCheck(origin, { upgradeable: 'no' });
        } else {
          let body = '<p class="err">' + esc(data.error || 'Update failed.') + '</p>';
          if (data.blocked === 'major') body = '<p>This update bumps a major version (<code>' + esc((data.majorBumps || []).join(', ')) + '</code>). It can change the look or break customizations.</p><p class="err">Confirm to continue, or cancel.</p>';
          openModal('Update failed', body, (data.blocked === 'major'
            ? '<button class="btn" onclick="doUpdate(\\'' + esc(origin) + '\\', true)">Confirm &amp; update anyway</button>'
            : '') + '<button class="btn" onclick="document.getElementById(\\'update-modal\\').classList.remove(\\'open\\')">Close</button>');
        }
      }
    </script>`,
  );
}

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
  background: #1a1a1a; color: #fff; cursor: pointer; text-decoration: none;
}
.btn:hover { opacity: .9; }
.btn.secondary { background: #fff; color: #1a1a1a; }
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
table.sites { width: 100%; border-collapse: collapse; font-size: .92rem; }
table.sites th, table.sites td { text-align: left; padding: .6rem .4rem; border-bottom: 1px solid #eee; }
table.sites th { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #999; }
.result { margin-top: .75rem; padding: .75rem 1rem; background: #f0f9f2; border: 1px solid #c8e6cf; border-radius: 10px; font-size: .85rem; }
.pbar { height: 8px; background: #eee; border-radius: 999px; overflow: hidden; margin: .75rem 0 .25rem; display: none; }
.pbar.visible { display: block; }
.pbar-fill { height: 100%; width: 0; background: #1a1a1a; border-radius: 999px; transition: width .35s ease; }
.pbar-fill.ok { background: #157f3d; }
.pbar-fill.err { background: #b3261e; }`;

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
      <p><a class="btn secondary" href="/">Back to kantan</a></p>
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
                  `<tr>
                    <td><a href="${s.origin}" target="_blank" rel="noopener">${s.origin.replace('https://', '')}</a></td>
                    <td class="muted">${new Date(s.created_at).toLocaleDateString()}</td>
                    <td><a href="${s.origin}/admin" target="_blank" rel="noopener" style="font-size:.85rem">editor</a></td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <button class="btn secondary" id="new-site" style="margin-top:.75rem">Create another site</button>
      </section>`
    : '';
  const wizardHidden = hasSites ? ' hidden' : '';
  return shell(
    'Dashboard — kantan',
    `<main class="wrap">
      <header class="topbar">
        <a class="brand" href="/">kantan<span> かんたん</span></a>
        <div style="font-size:.85rem" class="muted">${email} &nbsp;<a href="/api/logout">logout</a></div>
      </header>

      ${table}

      <section class="card" id="wizard${wizardHidden}">
        <h2><span class="num">1</span> Connect GitHub</h2>
        <p>Your site lives in a new repository in your GitHub account. We ask for
           <code>repo</code> access so we can create it and set it up for you.</p>
        <div id="gh-logged-out">
          <button class="btn" onclick="location.href='/auth/github'">Connect GitHub</button>
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
        <button class="btn secondary" id="cf-verify">Verify token</button>
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
        <button class="btn" id="create" disabled>Create my website</button>
        <div class="pbar" id="pbar"><div class="pbar-fill" id="pbar-fill"></div></div>
        <ul class="steps" id="progress"></ul>
        <div id="result"></div>
      </section>
    </main>

    <script>
      const $ = (id) => document.getElementById(id);
      let cfToken = null, cfAccountId = null, ghConnected = false;

      const wizard = $('wizard');
      const newSite = $('new-site');
      if (newSite) newSite.onclick = () => {
        wizard.classList.remove('hidden');
        newSite.classList.add('hidden');
        wizard.scrollIntoView({ behavior: 'smooth' });
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

      $('site-name').oninput = refreshCreateButton;

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
          const r = await fetch('/api/provision', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteName: $('site-name').value,
              cfToken, cfAccountId,
              public: $('site-public').checked,
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
          $('result').innerHTML =
            '<div class="result"><strong>Your site is being built.</strong><br>' +
            'Repo: <a href="' + data.site.repo + '" target="_blank" rel="noopener">' + data.site.repo.replace('https://github.com/', '') + '</a><br>' +
            'Site: <a href="' + data.site.url + '" target="_blank" rel="noopener">' + data.site.url.replace('https://', '') + '</a><br>' +
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
    </script>`,
  );
}

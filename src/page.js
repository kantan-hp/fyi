// The wizard UI. Deliberately minimal: one page, three steps, no framework.

export function wizardPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>kantan panel</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    margin: 0; background: #fafafa; color: #1a1a1a; line-height: 1.5;
  }
  main { max-width: 620px; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .sub { color: #666; font-size: .9rem; margin-bottom: 2rem; }
  .card {
    background: #fff; border: 1px solid #e5e5e5; border-radius: 10px;
    padding: 1.25rem 1.5rem; margin-bottom: 1rem;
  }
  .card h2 { font-size: 1rem; margin: 0 0 .5rem; display: flex; align-items: center; gap: .5rem; }
  .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.4rem; height: 1.4rem; border-radius: 50%;
    background: #1a1a1a; color: #fff; font-size: .8rem; flex-shrink: 0;
  }
  .card p { font-size: .85rem; color: #555; margin: .25rem 0 .75rem; }
  button {
    font: inherit; font-size: .9rem; padding: .55rem 1.1rem; border-radius: 8px;
    border: 1px solid #1a1a1a; background: #1a1a1a; color: #fff; cursor: pointer;
  }
  button.secondary { background: #fff; color: #1a1a1a; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  input[type="text"], input[type="password"] {
    font: inherit; font-size: .9rem; width: 100%; padding: .5rem .7rem;
    border: 1px solid #ccc; border-radius: 8px; margin-bottom: .6rem;
  }
  .status { font-size: .85rem; margin-top: .5rem; }
  .ok { color: #157f3d; }
  .err { color: #b3261e; }
  .muted { color: #888; }
  a { color: #1a1a1a; }
  ul.steps { list-style: none; padding: 0; margin: .75rem 0 0; font-size: .85rem; }
  ul.steps li { padding: .15rem 0; }
  ul.sites { list-style: none; padding: 0; margin: .5rem 0 0; font-size: .9rem; }
  ul.sites li { padding: .4rem 0; border-top: 1px solid #eee; }
  ul.sites .meta { font-size: .78rem; color: #888; }
  .result { margin-top: .75rem; padding: .75rem 1rem; background: #f0f9f2; border: 1px solid #c8e6cf; border-radius: 8px; font-size: .85rem; }
  code { background: #f0f0f0; padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
  #step2, #step3 { opacity: .45; pointer-events: none; transition: opacity .2s; }
  #step2.enabled, #step3.enabled { opacity: 1; pointer-events: auto; }
  .hidden { display: none; }
</style>
</head>
<body>
<main>
  <h1>kantan panel <span class="muted" style="font-weight:normal">(poc)</span></h1>
  <div class="sub">Create your own kantan-hp website in about a minute.</div>

  <div class="card" id="step1">
    <h2><span class="num">1</span> Connect GitHub</h2>
    <p>Your site lives in a new repository in your GitHub account. We ask for
       <code>repo</code> access so we can create it and set it up for you.</p>
    <div id="gh-logged-out">
      <button onclick="location.href='/auth/github'">Login with GitHub</button>
    </div>
    <div id="gh-logged-in" class="hidden">
      <div class="status ok">✓ Connected as <strong id="gh-login"></strong>
        &nbsp;<a href="/api/logout" class="muted" style="font-size:.8rem">switch account</a>
      </div>
    </div>
  </div>

  <div class="card" id="step2">
    <h2><span class="num">2</span> Connect Cloudflare</h2>
    <p>Paste an API token with the <strong>Cloudflare Pages: Edit</strong> permission
       (<a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">create one</a> →
       "Create Custom Token"). It is used once to create your site and is never stored here.</p>
    <input type="password" id="cf-token" placeholder="Cloudflare API token" autocomplete="off" />
    <button class="secondary" id="cf-verify">Verify token</button>
    <div class="status" id="cf-status"></div>
  </div>

  <div class="card" id="step3">
    <h2><span class="num">3</span> Name your site</h2>
    <p>This becomes your repository name and your free address:
       <code>&lt;name&gt;.pages.dev</code></p>
    <input type="text" id="site-name" placeholder="my-blog" autocomplete="off" />
    <button id="create" disabled>Create my website</button>
    <ul class="steps" id="progress"></ul>
    <div id="result"></div>
  </div>

  <div class="card hidden" id="sites-card">
    <h2>Your sites</h2>
    <ul class="sites" id="sites"></ul>
  </div>
</main>

<script>
const $ = (id) => document.getElementById(id);
let cfToken = null, cfAccountId = null, loggedIn = false;

function refreshCreateButton() {
  $('create').disabled = !(loggedIn && cfToken && $('site-name').value.trim());
}

async function init() {
  const r = await fetch('/api/me');
  if (r.ok) {
    const me = await r.json();
    loggedIn = true;
    $('gh-login').textContent = '@' + me.login;
    $('gh-logged-out').classList.add('hidden');
    $('gh-logged-in').classList.remove('hidden');
    $('step2').classList.add('enabled');
    loadSites();
  }
}

async function loadSites() {
  const r = await fetch('/api/sites');
  if (!r.ok) return;
  const { sites } = await r.json();
  if (!sites.length) return;
  $('sites-card').classList.remove('hidden');
  $('sites').innerHTML = sites.map(s =>
    '<li><a href="' + s.origin + '" target="_blank" rel="noopener">' + s.origin.replace('https://', '') + '</a>' +
    ' · <a href="' + s.origin + '/admin" target="_blank" rel="noopener">admin</a>' +
    '<div class="meta">repo ' + s.repo + ' · created ' + new Date(s.createdAt).toLocaleString() + '</div></li>'
  ).join('');
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
  if (data.accounts.length === 1) {
    cfAccountId = data.accounts[0].id;
    st.className = 'status ok';
    st.textContent = '✓ Token works — account: ' + data.accounts[0].name;
  } else {
    cfAccountId = null;
    st.className = 'status ok';
    st.textContent = '✓ Token works. Multiple accounts found; the first will be used (POC).';
  }
  $('step3').classList.add('enabled');
  refreshCreateButton();
};

$('site-name').oninput = refreshCreateButton;

$('create').onclick = async () => {
  $('create').disabled = true;
  $('result').innerHTML = '';
  const prog = $('progress');
  prog.innerHTML = '';
  const addStep = (s) => {
    const li = document.createElement('li');
    li.textContent = (s.ok ? '✓ ' : '✗ ') + s.name + (s.detail ? ' — ' + s.detail : '');
    li.className = s.ok ? 'ok' : 'err';
    prog.appendChild(li);
  };
  const r = await fetch('/api/provision', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteName: $('site-name').value, cfToken, cfAccountId }),
  });
  const data = await r.json();
  (data.steps || []).forEach(addStep);
  if (data.ok) {
    $('result').innerHTML =
      '<div class="result"><strong>Your site is being built.</strong><br>' +
      'Repo: <a href="' + data.site.repo + '" target="_blank" rel="noopener">' + data.site.repo.replace('https://github.com/', '') + '</a><br>' +
      'Site: <a href="' + data.site.url + '" target="_blank" rel="noopener">' + data.site.url.replace('https://', '') + '</a><br>' +
      'Editor: <a href="' + data.site.admin + '" target="_blank" rel="noopener">' + data.site.admin.replace('https://', '') + '</a><br>' +
      '<span class="muted">' + data.site.note + '</span></div>';
    loadSites();
  } else {
    const div = document.createElement('div');
    div.className = 'status err';
    div.style.marginTop = '.5rem';
    div.textContent = data.error || 'Provisioning failed.';
    $('result').appendChild(div);
    $('create').disabled = false;
  }
};

init();
</script>
</body>
</html>`;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUserDataPath,
  CONFIG_YML_PATH,
  normalizeConfigYml,
  treeToBlobMap,
  classifyFitness,
  diffCoreTrees,
  reinjectConfigBackend,
  majorOf,
  astroMajorOf,
  sveltiaMajorOf,
  detectMajorBumps,
} from '../src/lib.js';

test('isUserDataPath covers the user data contract', () => {
  assert.equal(isUserDataPath('src/config.json'), true);
  assert.equal(isUserDataPath('src/content/blog/welcome.md'), true);
  assert.equal(isUserDataPath('src/content/pages/about.md'), true);
  assert.equal(isUserDataPath('public/images/photo.png'), true);
  assert.equal(isUserDataPath('src/config.json/sub'), false);
  assert.equal(isUserDataPath('package.json'), false);
  assert.equal(isUserDataPath('src/components/Header.astro'), false);
  assert.equal(isUserDataPath('src/config.ts'), false);
  assert.equal(isUserDataPath(CONFIG_YML_PATH), false);
});

test('normalizeConfigYml strips site-specific backend lines', () => {
  const site = `backend:
  name: github
  repo: alice/my-blog
  branch: main
  base_url: https://kantan-hp.fyi
  auth_endpoint: /api/decap/auth
`;
  const tpl = `backend:
  name: github
  repo: kantan-hp/template
  branch: main
`;
  assert.equal(normalizeConfigYml(site), normalizeConfigYml(tpl));
});

test('treeToBlobMap keeps only blobs keyed by path', () => {
  const tree = [
    { path: 'package.json', type: 'blob', sha: 'a' },
    { path: 'src', type: 'tree', sha: 'dir' },
    { path: 'src/config.json', type: 'blob', sha: 'b' },
  ];
  assert.deepEqual(treeToBlobMap(tree), { 'package.json': 'a', 'src/config.json': 'b' });
});

const TEMPLATE_TREE = [
  { path: 'package.json', type: 'blob', sha: 'tpl-pkg' },
  { path: 'astro.config.mjs', type: 'blob', sha: 'tpl-astro' },
  { path: 'src/components/Header.astro', type: 'blob', sha: 'tpl-header' },
  { path: 'src/content/blog/welcome.md', type: 'blob', sha: 'tpl-welcome' },
  { path: 'src/config.json', type: 'blob', sha: 'tpl-config' },
  { path: CONFIG_YML_PATH, type: 'blob', sha: 'tpl-cfgyml' },
];

const SITE_CLEAN = [
  { path: 'package.json', type: 'blob', sha: 'tpl-pkg' },
  { path: 'astro.config.mjs', type: 'blob', sha: 'tpl-astro' },
  { path: 'src/components/Header.astro', type: 'blob', sha: 'tpl-header' },
  // user data differs freely and is ignored:
  { path: 'src/content/blog/welcome.md', type: 'blob', sha: 'edited-welcome' },
  { path: 'src/config.json', type: 'blob', sha: 'edited-config' },
  { path: CONFIG_YML_PATH, type: 'blob', sha: 'site-cfgyml' },
];

const CONFIG_TPL = 'backend:\n  name: github\n  repo: kantan-hp/template\n  branch: main\n';
const CONFIG_SITE = 'backend:\n  name: github\n  repo: alice/blog\n  branch: main\n  base_url: https://kantan-hp.fyi\n  auth_endpoint: /api/decap/auth\n';

test('classifyFitness: clean site (additions + user-data edits tolerated)', () => {
  const fit = classifyFitness({ templateTree: TEMPLATE_TREE, siteTree: SITE_CLEAN, templateConfigYml: CONFIG_TPL, siteConfigYml: CONFIG_SITE });
  assert.equal(fit.clean, true);
  assert.deepEqual(fit.drifted, []);
});

test('classifyFitness: modified core file marks dirty', () => {
  const site = [...SITE_CLEAN];
  site[0] = { path: 'package.json', type: 'blob', sha: 'changed-pkg' };
  const fit = classifyFitness({ templateTree: TEMPLATE_TREE, siteTree: site, templateConfigYml: CONFIG_TPL, siteConfigYml: CONFIG_SITE });
  assert.equal(fit.clean, false);
  assert.deepEqual(fit.drifted, [{ path: 'package.json', kind: 'modified' }]);
});

test('classifyFitness: deleted core file marks dirty', () => {
  const site = SITE_CLEAN.filter((e) => e.path !== 'src/components/Header.astro');
  const fit = classifyFitness({ templateTree: TEMPLATE_TREE, siteTree: site, templateConfigYml: CONFIG_TPL, siteConfigYml: CONFIG_SITE });
  assert.equal(fit.clean, false);
  assert.deepEqual(fit.drifted, [{ path: 'src/components/Header.astro', kind: 'deleted' }]);
});

test('classifyFitness: edited non-backend config.yml marks dirty', () => {
  const editedSiteConfig = CONFIG_SITE + 'collections: []\n';
  const fit = classifyFitness({ templateTree: TEMPLATE_TREE, siteTree: SITE_CLEAN, templateConfigYml: CONFIG_TPL, siteConfigYml: editedSiteConfig });
  assert.equal(fit.clean, false);
  assert.deepEqual(fit.drifted, [{ path: CONFIG_YML_PATH, kind: 'modified' }]);
});

test('diffCoreTrees: only core changes, user data excluded', () => {
  const from = TEMPLATE_TREE;
  const to = [
    { path: 'package.json', type: 'blob', sha: 'new-pkg' },
    { path: 'astro.config.mjs', type: 'blob', sha: 'tpl-astro' },
    { path: 'src/components/New.astro', type: 'blob', sha: 'added' },
    { path: 'src/components/Header.astro', type: 'blob', sha: 'tpl-header' },
    { path: 'src/content/blog/welcome.md', type: 'blob', sha: 'tpl-welcome' },
    { path: 'src/content/blog/new-post.md', type: 'blob', sha: 'whatever' },
    { path: 'src/config.json', type: 'blob', sha: 'tpl-config' },
    { path: CONFIG_YML_PATH, type: 'blob', sha: 'tpl-cfgyml' },
  ];
  const changes = diffCoreTrees({ fromTree: from, toTree: to, fromConfigYml: CONFIG_TPL, toConfigYml: CONFIG_TPL });
  assert.deepEqual(changes, [
    { path: 'package.json', status: 'modified' },
    { path: 'src/components/New.astro', status: 'added' },
  ]);
});

test('diffCoreTrees: config.yml change reported as modified', () => {
  const changes = diffCoreTrees({ fromTree: TEMPLATE_TREE, toTree: TEMPLATE_TREE, fromConfigYml: 'a: 1', toConfigYml: 'a: 2' });
  assert.ok(changes.some((c) => c.path === CONFIG_YML_PATH && c.status === 'modified'));
});

test('reinjectConfigBackend: injects site repo + base_url/auth_endpoint', () => {
  const newTpl = 'backend:\n  name: github\n  repo: kantan-hp/template\n  branch: main\n\ncollections: []\n';
  const out = reinjectConfigBackend(newTpl, CONFIG_SITE);
  assert.match(out, /repo: alice\/blog/);
  assert.match(out, /base_url: https:\/\/kantan-hp\.fyi/);
  assert.match(out, /auth_endpoint: \/api\/decap\/auth/);
  assert.match(out, /collections: \[\]/);
});

test('reinjectConfigBackend: no base_url in site -> nothing injected', () => {
  const siteNoBase = 'backend:\n  name: github\n  repo: alice/blog\n  branch: main\n';
  const newTpl = 'backend:\n  name: github\n  repo: kantan-hp/template\n  branch: main\n';
  const out = reinjectConfigBackend(newTpl, siteNoBase);
  assert.match(out, /repo: alice\/blog/);
  assert.doesNotMatch(out, /base_url:/);
});

test('reinjectConfigBackend: template has base_url but no auth_endpoint -> auth_endpoint re-inserted', () => {
  // Template@N+1 ships a base_url line but no auth_endpoint; the site's
  // auth_endpoint (shared proxy) must survive the re-injection.
  const site = 'backend:\n  name: github\n  repo: alice/blog\n  branch: main\n  base_url: https://kantan-hp.fyi\n  auth_endpoint: /api/decap/auth\n';
  const newTpl = 'backend:\n  name: github\n  repo: kantan-hp/template\n  branch: main\n  base_url: https://new.template\n';
  const out = reinjectConfigBackend(newTpl, site);
  assert.match(out, /base_url: https:\/\/kantan-hp\.fyi/);
  assert.match(out, /auth_endpoint: \/api\/decap\/auth/);
});

test('majorOf / astroMajorOf / sveltiaMajorOf', () => {
  assert.equal(majorOf('7.1.6'), 7);
  assert.equal(majorOf('v2.0'), 2);
  assert.equal(majorOf(''), null);
  assert.equal(astroMajorOf('{"dependencies":{"astro":"7.1.6"}}'), 7);
  assert.equal(astroMajorOf('{}'), null);
  assert.equal(sveltiaMajorOf('<script src="https://unpkg.com/@sveltia/cms@0.178.0/dist/sveltia-cms.js"></script>'), 0);
  assert.equal(sveltiaMajorOf('no cms here'), null);
});

test('majorOf parses semver ranges and comparators', () => {
  assert.equal(majorOf('^7.1.6'), 7);
  assert.equal(majorOf('~7.0.0'), 7);
  assert.equal(majorOf('>=7.0.0'), 7);
  assert.equal(majorOf('^7'), 7);
  assert.equal(majorOf('7.x'), 7);
  assert.equal(majorOf('*'), null);
  assert.equal(majorOf('latest'), null);
  assert.equal(majorOf('workspace:*'), null);
});

test('detectMajorBumps finds astro and sveltia bumps', () => {
  const bumps = detectMajorBumps({
    fromPackageJson: '{"dependencies":{"astro":"6.0.0"}}',
    toPackageJson: '{"dependencies":{"astro":"7.1.6"}}',
    fromAdminHtml: '@sveltia/cms@0.178.0',
    toAdminHtml: '@sveltia/cms@1.0.0',
  });
  assert.ok(bumps.some((b) => b.startsWith('Astro')));
  assert.ok(bumps.some((b) => b.startsWith('Sveltia')));
});

test('detectMajorBumps empty when majors unchanged', () => {
  const bumps = detectMajorBumps({
    fromPackageJson: '{"dependencies":{"astro":"7.0.0"}}',
    toPackageJson: '{"dependencies":{"astro":"7.1.6"}}',
    fromAdminHtml: '@sveltia/cms@0.178.0',
    toAdminHtml: '@sveltia/cms@0.180.0',
  });
  assert.deepEqual(bumps, []);
});

// Panel i18n — the four README locales (English, 日本語, 繁體中文, 简体中文).
// The panel is server-rendered per page, so the language is resolved per
// request: `kantan_lang` cookie (set by the footer switcher) > the browser's
// Accept-Language > English.

export const LOCALES = ['en', 'ja', 'zh-Hant', 'zh-Hans'];
export const DEFAULT_LOCALE = 'en';
export const LANG_COOKIE = 'kantan_lang';

export const nativeNames = {
  en: 'English',
  ja: '日本語',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // malformed percent-encoding (e.g. a bare %): keep the raw value rather
      // than throwing — a hostile cookie must never 500 the panel.
    }
    out[name] = value;
  }
  return out;
}

// Map a browser Accept-Language code to one of our locales.
function browserLocaleToLocale(code) {
  const c = code.toLowerCase();
  if (c === 'ja' || c.startsWith('ja-')) return 'ja';
  if (c.startsWith('zh-hant') || c.startsWith('zh-tw') || c.startsWith('zh-hk') || c.startsWith('zh-mo')) return 'zh-Hant';
  if (c.startsWith('zh-hans') || c.startsWith('zh-cn') || c.startsWith('zh-sg')) return 'zh-Hans';
  if (c.startsWith('zh')) return 'zh-Hans';
  if (c === 'en' || c.startsWith('en-')) return 'en';
  return null;
}

// Resolve the request's language: cookie > Accept-Language > en. Accept-Language
// q-values are honored (an entry with q=0 is explicitly excluded).
export function resolveLocale(request) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  if (isLocale(cookies[LANG_COOKIE])) return cookies[LANG_COOKIE];
  const header = request.headers.get('accept-language') || '';
  const entries = header
    .split(',')
    .map((part) => {
      const [code, ...params] = part.split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.split('=')[1]) : 1;
      return { code: code.trim(), q: Number.isNaN(q) ? 0 : q };
    })
    .sort((a, b) => b.q - a.q);
  for (const { code, q } of entries) {
    if (q <= 0) continue;
    const locale = browserLocaleToLocale(code);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

// Panel UI strings, keyed by locale. `{x}` tokens are interpolated by t().
const ui = {
  en: {
    navDashboard: 'Dashboard',
    navLogout: 'logout',
    navBack: 'Back',
    backToKantan: 'Back to kantan',
    switchLanguage: 'Change language',
    dashboardTitle: 'Dashboard — kantan',
    moreInfo: 'More info',
    yourSites: 'Your sites',
    thSite: 'Site',
    thCreated: 'Created',
    editorLabel: 'Editor',
    upgradable: 'Upgradable',
    check: 'check',
    checking: 'Checking…',
    update: 'Update',
    close: 'Close',
    createAnotherSite: 'Create another site',
    yes: 'Yes',
    no: 'No',
    na: 'N/A',
    languageLabel: 'Language',

    welcomeTitle: 'kantan — publish a blog in minutes',
    welcomeOpen: 'Go to my dashboard',
    welcomeGetStarted: 'Get started',
    welcomeH1: 'A free blog that goes live in minutes.',
    welcomeIntro:
      'kantan (かんたん) means simple. Sign in with just your email, and kantan sets up your GitHub repo, hosting, and editor for you.',
    welcomeHow: 'How it works',
    welcomeStep1: 'Sign in with your email — no passwords, no GitHub login.',
    welcomeStep2: 'Connect GitHub and Cloudflare — paste one token and kantan does the rest.',
    welcomeStep3: 'Write and publish — edit posts in a friendly editor. Every save goes live.',
    welcomeKeys: 'Your keys stay yours',
    welcomeKeysBody:
      'kantan never stores your GitHub or Cloudflare credentials. They are used for the seconds it takes to create your site, written into your own repository as deployment secrets, and discarded. You can revoke or rotate them any time.',

    loginTitle: 'Sign in — kantan',
    signIn: 'Sign in',
    signInBody: "Enter your email and we'll send you a one-time login link.",
    emailPlaceholder: 'you@example.com',
    emailMeLink: 'Email me a login link',
    sending: 'Sending…',
    verifFailed: 'Verification failed — please reload and try again.',
    completeVerification: 'Please complete the verification box first.',
    couldNotSend: 'Could not send the link.',
    checkInbox: '✓ Check your inbox — the link expires in 15 minutes.',
    loginLinkSent: 'Login link sent',
    devModeLink: 'No email provider configured (dev mode). Link:',
    tooManyLogins: 'Too many logins from this network — try again in a few minutes.',
    invalidLink: 'This login link is invalid or has expired. Request a new one.',

    step1Title: 'Connect GitHub',
    step1Body:
      'Your site lives in a new repository in your GitHub account. We ask for repo access so we can create it and set it up for you.',
    connectGithub: 'Connect GitHub',
    connectedAs: 'Connected as',
    switchAccount: 'switch account',

    step2Title: 'Connect Cloudflare',
    step2Body:
      'Paste an API token with Cloudflare Pages: Edit and Account Settings: Read (create one → "Create Custom Token" → add both permissions). Account Settings: Read lets us detect your account automatically; the token is used once to create your site and is never stored here.',
    cfTokenPlaceholder: 'Cloudflare API token',
    verifyToken: 'Verify token',
    cfAccount: 'Cloudflare account',
    cfAccountId: 'Cloudflare account ID',
    cfAccountIdHint:
      "This token can't list accounts, so enter the account ID it belongs to (dash.cloudflare.com → select the account → it's in the URL), or add Account Settings: Read to the token and re-verify.",
    pasteTokenFirst: 'Paste a token first.',
    tokenRejected: 'Token rejected. Needs "Cloudflare Pages: Edit".',
    tokenWorksAccount: 'Token works — account:',
    accountsFound: 'accounts found. Select the one to use:',
    tokenCantList:
      'Token authenticates, but cannot list accounts. Enter the Cloudflare account ID it belongs to, or add "Account Settings: Read".',

    step3Title: 'Name your site',
    step3Body: 'This becomes your repository name and your free address: <name>.pages.dev',
    step4Title: 'Bring your previous content',
    step4Body:
      'Export your previous site to download a .zip (dashboard → Export content), then upload it below. Or import directly from one of your existing sites.',
    stepConfirmTitle: 'Confirm creation',
    siteNamePlaceholder: 'my-blog',
    makePublic: 'Make this repository public',
    publicHint: '(your site itself is always public)',
    assignBranded: 'Assign me <name>.kantan-hp.fyi too',
    brandedHint: '(a branded address on kantan-hp.fyi; uncheck for pages.dev only)',
    tooShortBranded: 'Too short for a branded address — will use pages.dev only.',
    createSite: 'Create my website',

    provisioningFailed: 'Provisioning failed: ',
    couldNotReach: 'could not reach the server',
    partialCreate: '. Your site may be partially created; check GitHub and retry.',
    yourSiteBuilding: 'Your site is being built.',
    repo: 'Repo:',
    site: 'Site:',
    editor: 'Editor:',
    meanwhileLive: "Meanwhile it's live at:",

    somethingWentWrong: 'Something went wrong',
    couldNotReachPanel: 'Could not reach the panel: ',
    notSignedIn: 'Not signed in.',
    requestFailed: 'Request failed ({n}).',
    couldNotCheck: 'Could not check — click check to retry.',
    ghConnectCancelled: 'GitHub connect was cancelled or failed — click check to retry.',
    upToDate: 'Up to date',
    upToDateBody: 'Your site already runs the current template core.',
    updateNotAvailable: 'Update not available',
    updateAvailable: 'Update available',
    comparing: 'Comparing your site against the template…',
    updating: 'Updating…',
    applyingUpdate: 'Applying the update and rebuilding your site. This takes a minute or two.',
    updateComplete: 'Update complete',
    updateCompleteBody:
      'Your site is updated to template {to} ({n} file(s) changed). The deploy has been triggered — it takes a minute or two to go live.',
    viewBuild: 'View the build',
    done: 'Done',
    updateFailed: 'Update failed',
    updateTo: 'Update to {to}',
    filesNeverTouched: 'Your posts, images and settings are never touched. Files that change:',
    noCoreChanges: 'no core file changes',
    moreFiles: '…and {n} more',
    majorBump:
      'Major version bump: {deps}. This can change the look or break customizations — review before updating.',
    updateFromTo: 'Updating {origin} from template {from} to {to}.',
    filesBlocking: 'Files that block the update:',
    confirmAnyway: 'Confirm & update anyway',
    majorConfirmBody:
      'This update bumps a major version ({deps}). It can change the look or break customizations.',
    majorConfirmPrompt: 'Confirm to continue, or cancel.',
    reasonDirty:
      'Your site has core files that differ from the template — updates are blocked so your changes are never overwritten.',
    reasonCollision:
      'The template now adds files that already exist in your site — the update would overwrite them.',
    reasonCi: 'The template is not passing its own CI right now — updates are held until it is green.',
    reasonLegacy: 'This site was created before version tracking existed. Upgrades are not offered for it yet.',
    reasonUnreadable: 'The site repo could not be read (private, deleted, or no access).',

    deleteSite: 'Delete site',
    deleteConfirmTitle: 'Delete this site?',
    deleteConfirmBody:
      'This permanently deletes the GitHub repo, the Cloudflare Pages project, and this registration. This can\'t be undone.',
    deleteCfToken: 'Cloudflare API token (to delete the Pages project)',
    deleteTypeHost: 'Type the site address to confirm:',
    deleteConfirm: 'Delete permanently',
    deleteCancel: 'Cancel',
    deleting: 'Deleting…',
    deleteComplete: 'Site deleted',
    deleteFailed: 'Delete failed',
    deleteRemaining: 'Could not remove everything:',
    setBaseline: 'Set baseline',
    baselineSetting: 'Setting baseline…',
    baselineComplete: 'Baseline set — you can now check for updates.',
    baselineFailed: 'Could not set the baseline.',

    exportContent: 'Export content',
    exporting: 'Exporting…',
    exportFailed: 'Export failed',
    bringContent: "Bring a previous site's content over",
    bringContentHint: 'Start with your existing posts, images and settings.',
    contentFromSite: 'Import from an existing site',
    contentNone: 'None',
    contentUploadBundle: 'Upload a content bundle (.zip)',
    startFreshBringContent: 'Start fresh and bring your content over',

    notFoundTitle: 'Not found',
    notFoundBody: 'That page does not exist.',
    tooManyTitle: 'Too many requests',
    tooManyBody: 'Too many requests from this network — try again in a few minutes.',
    invalidOauth: 'Invalid OAuth state',
    invalidOauthBody: 'Please go back and try connecting GitHub again.',

    emailLoginSubject: 'Your kantan login link',
    emailLoginTitle: 'Sign in to kantan',
    emailLoginBody: 'Click the button below to sign in to your kantan panel.',
    emailLoginButton: 'Sign in',
    emailLoginExpires: 'This link expires in 15 minutes.',
    emailLoginIgnore: "If you didn't request this, you can safely ignore this email.",
  },

  ja: {
    navDashboard: 'ダッシュボード',
    navLogout: 'ログアウト',
    navBack: '戻る',
    backToKantan: 'かんたんに戻る',
    switchLanguage: '言語を選択',
    dashboardTitle: 'ダッシュボード — kantan',
    moreInfo: '詳細',
    yourSites: 'あなたのサイト',
    thSite: 'サイト',
    thCreated: '作成日',
    editorLabel: 'エディタ',
    upgradable: '更新可否',
    check: '確認',
    checking: '確認中…',
    update: '更新',
    close: '閉じる',
    createAnotherSite: '別のサイトを作成',
    yes: 'はい',
    no: 'いいえ',
    na: 'N/A',
    languageLabel: '言語',

    welcomeTitle: 'かんたん — 数分でブログを公開',
    welcomeOpen: 'マイダッシュボードへ',
    welcomeGetStarted: 'はじめる',
    welcomeH1: '数分で公開できる、無料のブログ。',
    welcomeIntro:
      'kantan（かんたん）は「シンプル」という意味。メールだけでログインすれば、GitHub のリポジトリもホスティングもエディタも、kantan が用意してくれます。',
    welcomeHow: '仕組み',
    welcomeStep1: 'メールだけでログイン — パスワードも GitHub ログインも不要です。',
    welcomeStep2: 'GitHub と Cloudflare を接続 — Cloudflare のトークンを貼り付けるだけで、あとは kantan が全部セットアップします。',
    welcomeStep3: '書いて公開 — 使いやすいエディタで記事を編集するだけ。保存すればサイトに反映されます。',
    welcomeKeys: '鍵はあなたのもの',
    welcomeKeysBody:
      'kantan は GitHub や Cloudflare の認証情報を保存しません。サイトを作る数秒間だけ使い、あなたのリポジトリにデプロイ用シークレットとして書き込んだら、あとは破棄します。いつでも取り消し・変更できます。',

    loginTitle: 'ログイン — kantan',
    signIn: 'ログイン',
    signInBody: 'メールアドレスを入力すると、ワンタイムのログインリンクをお送りします。',
    emailPlaceholder: 'you@example.com',
    emailMeLink: 'ログインリンクを送信',
    sending: '送信中…',
    verifFailed: '認証に失敗しました — リロードしてもう一度お試しください。',
    completeVerification: '先に認証を完了してください。',
    couldNotSend: 'リンクを送信できませんでした。',
    checkInbox: '✓ 受信トレイを確認してください — リンクは15分で失効します。',
    loginLinkSent: 'ログインリンクを送信しました',
    devModeLink: 'メールプロバイダーが未設定（開発モード）です。リンク:',
    tooManyLogins: 'このネットワークからのログインが多すぎます — 数分後にもう一度お試しください。',
    invalidLink: 'このログインリンクは無効または期限切れです。新しいリンクをリクエストしてください。',

    step1Title: 'GitHub を接続',
    step1Body:
      'サイトはあなたの GitHub アカウントの新しいリポジトリに作成されます。作成とセットアップのため、repo アクセスを求めます。',
    connectGithub: 'GitHub を接続',
    connectedAs: '接続済み:',
    switchAccount: 'アカウントを切り替え',

    step2Title: 'Cloudflare を接続',
    step2Body:
      '「Cloudflare Pages: Edit」と「Account Settings: Read」の権限を持つ API トークンを貼り付けてください（作成 →「Create Custom Token」→ 2つの権限を追加）。「Account Settings: Read」があればアカウントを自動検出できます。トークンはサイト作成の1回だけ使われ、保存はされません。',
    cfTokenPlaceholder: 'Cloudflare API トークン',
    verifyToken: 'トークンを確認',
    cfAccount: 'Cloudflare アカウント',
    cfAccountId: 'Cloudflare アカウント ID',
    cfAccountIdHint:
      'このトークンはアカウント一覧を取得できないため、所属するアカウント ID を入力してください（dash.cloudflare.com → アカウントを選択 → URL に含まれます）。またはトークンに Account Settings: Read を追加して再確認してください。',
    pasteTokenFirst: '先にトークンを貼り付けてください。',
    tokenRejected: 'トークンが拒否されました。「Cloudflare Pages: Edit」が必要です。',
    tokenWorksAccount: '✓ トークンは有効です — アカウント:',
    accountsFound: '件のアカウントが見つかりました。使用するものを選んでください:',
    tokenCantList:
      'トークンは認証できましたが、アカウントを一覧できません。所属する Cloudflare アカウント ID を入力するか、トークンに「Account Settings: Read」を追加してください。',

    step3Title: 'サイトに名前を付ける',
    step3Body: 'これがリポジトリ名と無料のアドレスになります: <name>.pages.dev',
    step4Title: '以前のコンテンツを引き継ぐ',
    step4Body:
      '以前のサイトを .zip としてダウンロードして（ダッシュボード → コンテンツをエクスポート）、下からアップロードしてください。既存のサイトから直接引き継ぐこともできます。',
    stepConfirmTitle: '作成を確認',
    siteNamePlaceholder: 'my-blog',
    makePublic: 'このリポジトリを公開',
    publicHint: '（サイト自体は常に公開です）',
    assignBranded: '<name>.kantan-hp.fyi も割り当てる',
    brandedHint: '（kantan-hp.fyi 上のブランドアドレス。チェックを外すと pages.dev のみ）',
    tooShortBranded: '短すぎるため、ブランドアドレスは使わず pages.dev のみになります。',
    createSite: 'サイトを作成',

    provisioningFailed: 'サイトの作成に失敗しました: ',
    couldNotReach: 'サーバーに接続できませんでした',
    partialCreate: '。一部だけ作成された可能性があります。GitHub を確認してやり直してください。',
    yourSiteBuilding: 'サイトを構築しています。',
    repo: 'リポジトリ:',
    site: 'サイト:',
    editor: 'エディタ:',
    meanwhileLive: 'その間はこちらでもアクセスできます:',

    somethingWentWrong: '問題が発生しました',
    couldNotReachPanel: 'パネルに接続できませんでした: ',
    notSignedIn: 'ログインしていません。',
    requestFailed: 'リクエストに失敗しました（{n}）。',
    couldNotCheck: '確認できませんでした — 「確認」をクリックして再試行してください。',
    ghConnectCancelled: 'GitHub 接続がキャンセルまたは失敗しました — 「確認」をクリックして再試行してください。',
    upToDate: '最新です',
    upToDateBody: 'サイトはすでに最新のテンプレートコアを実行しています。',
    updateNotAvailable: '更新できません',
    updateAvailable: '更新があります',
    comparing: 'サイトとテンプレートを比較しています…',
    updating: '更新中…',
    applyingUpdate: '更新を反映してサイトを作り直しています。1〜2分ほどかかります。',
    updateComplete: '更新が完了しました',
    updateCompleteBody:
      'サイトをテンプレート {to} に更新しました（{n} ファイル変更）。公開までは 1〜2 分ほどかかります。',
    viewBuild: 'ビルドを確認',
    done: '完了',
    updateFailed: '更新に失敗しました',
    updateTo: '{to} に更新',
    filesNeverTouched: '投稿・画像・設定はそのまま残ります。変更されるファイル:',
    noCoreChanges: 'コアファイルの変更はありません',
    moreFiles: '…ほかに {n} 件',
    majorBump:
      'メジャーアップデート: {deps}。見た目が変わったり、カスタマイズが壊れたりする可能性があります — 更新前に確認してください。',
    updateFromTo: '{origin} をテンプレート {from} から {to} に更新します。',
    filesBlocking: '更新を妨げるファイル:',
    confirmAnyway: 'それでも更新する',
    majorConfirmBody: 'この更新はメジャーアップデートです（{deps}）。見た目が変わったり、カスタマイズが壊れたりする可能性があります。',
    majorConfirmPrompt: '続行するか、キャンセルするか選んでください。',
    reasonDirty:
      'サイトのコアファイルがテンプレートと違っています。変更が上書きされないよう、更新を止めています。',
    reasonCollision: 'テンプレートが追加するファイルが、すでにサイトに存在します — 上書きしてしまうため更新できません。',
    reasonCi: 'テンプレートが現在 CI を通過していないため、更新は保留されています。',
    reasonLegacy: 'このサイトはバージョン管理の導入前に作られました。アップグレードはまだ提供されていません。',
    reasonUnreadable: 'サイトのリポジトリを読み込めませんでした（非公開・削除済み・アクセス不可）。',

    deleteSite: 'サイトを削除',
    deleteConfirmTitle: 'このサイトを削除しますか？',
    deleteConfirmBody:
      'GitHub リポジトリ、Cloudflare Pages プロジェクト、登録情報を完全に削除します。元に戻せません。',
    deleteCfToken: 'Cloudflare API トークン（Pages プロジェクトの削除に必要）',
    deleteTypeHost: '確認のためサイトアドレスを入力してください:',
    deleteConfirm: '完全に削除',
    deleteCancel: 'キャンセル',
    deleting: '削除中…',
    deleteComplete: 'サイトを削除しました',
    deleteFailed: '削除に失敗しました',
    deleteRemaining: '削除できなかったものがあります:',
    setBaseline: 'ベースラインを設定',
    baselineSetting: '設定中…',
    baselineComplete: 'ベースラインを設定しました。更新を確認できます。',
    baselineFailed: 'ベースラインを設定できませんでした。',

    exportContent: 'コンテンツをエクスポート',
    exporting: 'エクスポート中…',
    exportFailed: 'エクスポートに失敗しました',
    bringContent: '以前のサイトのコンテンツを引き継ぐ',
    bringContentHint: '既存の投稿・画像・設定から始められます。',
    contentFromSite: '既存のサイトから引き継ぐ',
    contentNone: 'なし',
    contentUploadBundle: 'コンテンツのバックアップ (.zip) をアップロード',
    startFreshBringContent: '作り直してコンテンツを引き継ぐ',

    notFoundTitle: '見つかりません',
    notFoundBody: 'このページは存在しません。',
    tooManyTitle: 'リクエストが多すぎます',
    tooManyBody: 'このネットワークからのリクエストが多すぎます — 数分後にもう一度お試しください。',
    invalidOauth: 'OAuth 状態が無効です',
    invalidOauthBody: '戻って GitHub の接続をもう一度お試しください。',

    emailLoginSubject: 'kantan ログインリンク',
    emailLoginTitle: 'kantan にログイン',
    emailLoginBody: '下のボタンをクリックして kantan パネルにログインしてください。',
    emailLoginButton: 'ログイン',
    emailLoginExpires: 'このリンクは 15 分で有効期限が切れます。',
    emailLoginIgnore: 'このメールに心当たりがない場合は、そのまま無視してください。',
  },

  'zh-Hant': {
    navDashboard: '儀表板',
    navLogout: '登出',
    navBack: '返回',
    backToKantan: '返回 kantan',
    switchLanguage: '選擇語言',
    dashboardTitle: '儀表板 — kantan',
    moreInfo: '更多資訊',
    yourSites: '您的網站',
    thSite: '網站',
    thCreated: '建立時間',
    editorLabel: '編輯器',
    upgradable: '可更新',
    check: '檢查',
    checking: '檢查中…',
    update: '更新',
    close: '關閉',
    createAnotherSite: '再建立一個網站',
    yes: '是',
    no: '否',
    na: 'N/A',
    languageLabel: '語言',

    welcomeTitle: 'kantan — 幾分鐘就能上線的部落格',
    welcomeOpen: '前往我的儀表板',
    welcomeGetStarted: '開始使用',
    welcomeH1: '免費部落格，幾分鐘就能上線。',
    welcomeIntro:
      'kantan（かんたん）就是「簡單」。用電子郵件登入，kantan 就會幫你搞定 GitHub 儲存庫、主機和編輯器。',
    welcomeHow: '運作方式',
    welcomeStep1: '用電子郵件登入 — 不需要密碼，也不用登入 GitHub。',
    welcomeStep2: '連接 GitHub 和 Cloudflare — 貼上一次 Cloudflare 令牌，其餘交給 kantan。',
    welcomeStep3: '撰寫並發布 — 在友善的編輯器裡寫文章，每次儲存都會更新網站。',
    welcomeKeys: '憑證只屬於你',
    welcomeKeysBody:
      'kantan 不會儲存你的 GitHub 或 Cloudflare 憑證。它們只會在建立網站的幾秒內使用，寫入你自己的儲存庫作為部署密碼，然後隨即捨棄。你隨時可以撤銷或輪換。',

    loginTitle: '登入 — kantan',
    signIn: '登入',
    signInBody: '輸入你的電子郵件，我們會寄送一次性登入連結。',
    emailPlaceholder: 'you@example.com',
    emailMeLink: '寄送登入連結',
    sending: '傳送中…',
    verifFailed: '驗證失敗 — 請重新整理後再試一次。',
    completeVerification: '請先完成驗證方塊。',
    couldNotSend: '無法傳送連結。',
    checkInbox: '✓ 請檢查收件匣 — 連結將於 15 分鐘後失效。',
    loginLinkSent: '登入連結已寄出',
    devModeLink: '未設定電子郵件服務（開發模式）。連結：',
    tooManyLogins: '此網路登入次數過多 — 請幾分鐘後再試。',
    invalidLink: '此登入連結無效或已過期。請重新申請。',

    step1Title: '連接 GitHub',
    step1Body: '你的網站會放在 GitHub 帳號的新儲存庫中。我們需要 repo 存取權限來建立並設定。',
    connectGithub: '連接 GitHub',
    connectedAs: '已連接：',
    switchAccount: '切換帳號',

    step2Title: '連接 Cloudflare',
    step2Body:
      '貼上有 Cloudflare Pages: Edit 與 Account Settings: Read 權限的 API 令牌（建立一個 →「Create Custom Token」→ 加入兩項權限）。Account Settings: Read 讓我們自動偵測帳號；令牌只使用一次來建立網站，不會儲存在這裡。',
    cfTokenPlaceholder: 'Cloudflare API 令牌',
    verifyToken: '驗證令牌',
    cfAccount: 'Cloudflare 帳號',
    cfAccountId: 'Cloudflare 帳號 ID',
    cfAccountIdHint:
      '此令牌無法列出帳號，請輸入它所屬的帳號 ID（dash.cloudflare.com → 選擇帳號 → 它就在網址中），或在令牌中加入 Account Settings: Read 後重新驗證。',
    pasteTokenFirst: '請先貼上令牌。',
    tokenRejected: '令牌被拒絕。需要「Cloudflare Pages: Edit」。',
    tokenWorksAccount: '✓ 令牌有效 — 帳號：',
    accountsFound: '個帳號。請選擇要使用的帳號：',
    tokenCantList:
      '✓ 令牌已驗證，但無法列出帳號。請輸入它所屬的 Cloudflare 帳號 ID，或加入「Account Settings: Read」。',

    step3Title: '為網站命名',
    step3Body: '這將成為儲存庫名稱與免費網址：<name>.pages.dev',
    step4Title: '沿用先前內容',
    step4Body:
      '將先前網站匯出為 .zip（儀表板 → 匯出內容）後，於下方上傳；也可以直接從既有網站匯入。',
    stepConfirmTitle: '確認建立',
    siteNamePlaceholder: 'my-blog',
    makePublic: '將此儲存庫設為公開',
    publicHint: '（網站本身永遠是公開的）',
    assignBranded: '也指派 <name>.kantan-hp.fyi',
    brandedHint: '（kantan-hp.fyi 上的品牌網址；取消勾選則僅用 pages.dev）',
    tooShortBranded: '名稱太短，無法使用品牌網址 — 僅使用 pages.dev。',
    createSite: '建立我的網站',

    provisioningFailed: '佈建失敗：',
    couldNotReach: '無法連線到伺服器',
    partialCreate: '。網站可能已部分建立；請檢查 GitHub 後重試。',
    yourSiteBuilding: '網站正在建置中。',
    repo: '儲存庫：',
    site: '網站：',
    editor: '編輯器：',
    meanwhileLive: '同時，這裡也可存取：',

    somethingWentWrong: '發生錯誤',
    couldNotReachPanel: '無法連線到面板：',
    notSignedIn: '尚未登入。',
    requestFailed: '請求失敗（{n}）。',
    couldNotCheck: '無法檢查 — 請點「檢查」重試。',
    ghConnectCancelled: 'GitHub 連線已取消或失敗 — 請點「檢查」重試。',
    upToDate: '已是最新',
    upToDateBody: '你的網站已執行最新的範本核心。',
    updateNotAvailable: '無法更新',
    updateAvailable: '有可用更新',
    comparing: '正在比較你的網站與範本…',
    updating: '更新中…',
    applyingUpdate: '正在套用更新並重建網站。約需一至兩分鐘。',
    updateComplete: '更新完成',
    updateCompleteBody: '你的網站已更新至範本 {to}（變更 {n} 個檔案）。部署已觸發 — 約一至兩分鐘後生效。',
    viewBuild: '檢視建置',
    done: '完成',
    updateFailed: '更新失敗',
    updateTo: '更新至 {to}',
    filesNeverTouched: '你的文章、圖片與設定不受影響。會變更的檔案：',
    noCoreChanges: '沒有核心檔案變更',
    moreFiles: '…還有 {n} 個',
    majorBump:
      '主要版本升級：{deps}。這可能改變外觀或破壞自訂項目 — 更新前請先確認。',
    updateFromTo: '將 {origin} 從範本 {from} 更新至 {to}。',
    filesBlocking: '阻擋更新的檔案：',
    confirmAnyway: '仍要繼續更新',
    majorConfirmBody: '此更新會升級主要版本（{deps}），可能改變外觀或破壞自訂項目。',
    majorConfirmPrompt: '請選擇繼續或取消。',
    reasonDirty:
      '你的網站核心檔案與範本不同 — 為避免覆寫你的變更，更新已封鎖。',
    reasonCollision: '範本新增的檔案已存在於你的網站 — 更新會覆寫它們。',
    reasonCi: '範本目前未通過自己的 CI — 通過前會暫停更新。',
    reasonLegacy: '此網站是在版本追蹤導入前建立的，目前不提供升級。',
    reasonUnreadable: '無法讀取網站儲存庫（私人、已刪除或無權限）。',

    deleteSite: '刪除網站',
    deleteConfirmTitle: '確定要刪除這個網站？',
    deleteConfirmBody: '這會永久刪除 GitHub 存放庫、Cloudflare Pages 專案和這筆註冊，無法復原。',
    deleteCfToken: 'Cloudflare API 令牌（用於刪除 Pages 專案）',
    deleteTypeHost: '輸入網站地址以確認：',
    deleteConfirm: '永久刪除',
    deleteCancel: '取消',
    deleting: '刪除中…',
    deleteComplete: '網站已刪除',
    deleteFailed: '刪除失敗',
    deleteRemaining: '無法移除以下項目：',
    setBaseline: '設定基準',
    baselineSetting: '設定中…',
    baselineComplete: '基準已設定，現在可以檢查更新。',
    baselineFailed: '無法設定基準。',

    exportContent: '匯出內容',
    exporting: '匯出中…',
    exportFailed: '匯出失敗',
    bringContent: '沿用先前網站的內容',
    bringContentHint: '從你既有的文章、圖片和設定開始。',
    contentFromSite: '從既有網站匯入',
    contentNone: '無',
    contentUploadBundle: '上傳內容備份 (.zip)',
    startFreshBringContent: '重新建立並沿用原有內容',

    notFoundTitle: '找不到頁面',
    notFoundBody: '這個頁面不存在。',
    tooManyTitle: '請求過多',
    tooManyBody: '此網路的請求過多 — 請幾分鐘後再試。',
    invalidOauth: 'OAuth 狀態無效',
    invalidOauthBody: '請返回並重新連接 GitHub。',

    emailLoginSubject: 'kantan 登入連結',
    emailLoginTitle: '登入 kantan',
    emailLoginBody: '點擊下方按鈕登入你的 kantan 面板。',
    emailLoginButton: '登入',
    emailLoginExpires: '此連結將於 15 分鐘後失效。',
    emailLoginIgnore: '如果你沒有提出此要求，可以放心忽略這封郵件。',
  },

  'zh-Hans': {
    navDashboard: '仪表板',
    navLogout: '退出登录',
    navBack: '返回',
    backToKantan: '返回 kantan',
    switchLanguage: '选择语言',
    dashboardTitle: '仪表板 — kantan',
    moreInfo: '更多信息',
    yourSites: '您的网站',
    thSite: '网站',
    thCreated: '创建时间',
    editorLabel: '编辑器',
    upgradable: '可更新',
    check: '检查',
    checking: '检查中…',
    update: '更新',
    close: '关闭',
    createAnotherSite: '再创建一个网站',
    yes: '是',
    no: '否',
    na: 'N/A',
    languageLabel: '语言',

    welcomeTitle: 'kantan — 几分钟就能上线的博客',
    welcomeOpen: '前往我的仪表板',
    welcomeGetStarted: '开始使用',
    welcomeH1: '免费博客，几分钟就能上线。',
    welcomeIntro:
      'kantan（かんたん）就是「简单」。用电子邮件登录，kantan 就会帮你搞定 GitHub 仓库、托管和编辑器。',
    welcomeHow: '运作方式',
    welcomeStep1: '用电子邮件登录 — 不需要密码，也不用登录 GitHub。',
    welcomeStep2: '连接 GitHub 和 Cloudflare — 粘贴一次 Cloudflare 令牌，其余交给 kantan。',
    welcomeStep3: '撰写并发布 — 在友好的编辑器里写文章，每次保存都会更新网站。',
    welcomeKeys: '凭据只属于你',
    welcomeKeysBody:
      'kantan 不会存储你的 GitHub 或 Cloudflare 凭据。它们只会在创建网站的几秒内使用，写入你自己的仓库作为部署机密，然后随即丢弃。你随时可以撤销或轮换。',

    loginTitle: '登录 — kantan',
    signIn: '登录',
    signInBody: '输入你的电子邮件，我们会发送一次性登录链接。',
    emailPlaceholder: 'you@example.com',
    emailMeLink: '发送登录链接',
    sending: '发送中…',
    verifFailed: '验证失败 — 请刷新后重试。',
    completeVerification: '请先完成验证框。',
    couldNotSend: '无法发送链接。',
    checkInbox: '✓ 请检查收件箱 — 链接将在 15 分钟后失效。',
    loginLinkSent: '登录链接已发送',
    devModeLink: '未配置电子邮件服务（开发模式）。链接：',
    tooManyLogins: '此网络登录过于频繁 — 请几分钟后再试。',
    invalidLink: '此登录链接无效或已过期。请重新申请。',

    step1Title: '连接 GitHub',
    step1Body: '你的网站会放在 GitHub 账号的新仓库中。我们需要 repo 访问权限来创建并设置。',
    connectGithub: '连接 GitHub',
    connectedAs: '已连接：',
    switchAccount: '切换账号',

    step2Title: '连接 Cloudflare',
    step2Body:
      '粘贴具有 Cloudflare Pages: Edit 与 Account Settings: Read 权限的 API 令牌（创建一个 →「Create Custom Token」→ 添加两项权限）。Account Settings: Read 让我们自动检测账号；令牌只使用一次来创建网站，不会存储在这里。',
    cfTokenPlaceholder: 'Cloudflare API 令牌',
    verifyToken: '验证令牌',
    cfAccount: 'Cloudflare 账号',
    cfAccountId: 'Cloudflare 账号 ID',
    cfAccountIdHint:
      '此令牌无法列出账号，请输入它所属的账号 ID（dash.cloudflare.com → 选择账号 → 它就在网址中），或在令牌中添加 Account Settings: Read 后重新验证。',
    pasteTokenFirst: '请先粘贴令牌。',
    tokenRejected: '令牌被拒绝。需要「Cloudflare Pages: Edit」。',
    tokenWorksAccount: '✓ 令牌有效 — 账号：',
    accountsFound: '个账号。请选择要使用的账号：',
    tokenCantList:
      '✓ 令牌已验证，但无法列出账号。请输入它所属的 Cloudflare 账号 ID，或添加「Account Settings: Read」。',

    step3Title: '为网站命名',
    step3Body: '这将成为仓库名称与免费网址：<name>.pages.dev',
    step4Title: '沿用先前内容',
    step4Body:
      '将先前网站导出为 .zip（仪表板 → 导出内容）后，在下方上传；也可以直接从现有网站导入。',
    stepConfirmTitle: '确认创建',
    siteNamePlaceholder: 'my-blog',
    makePublic: '将此仓库设为公开',
    publicHint: '（网站本身永远是公开的）',
    assignBranded: '也分配 <name>.kantan-hp.fyi',
    brandedHint: '（kantan-hp.fyi 上的品牌网址；取消勾选则仅用 pages.dev）',
    tooShortBranded: '名称太短，无法使用品牌网址 — 仅使用 pages.dev。',
    createSite: '创建我的网站',

    provisioningFailed: '配置失败：',
    couldNotReach: '无法连接到服务器',
    partialCreate: '。网站可能已部分创建；请检查 GitHub 后重试。',
    yourSiteBuilding: '网站正在构建中。',
    repo: '仓库：',
    site: '网站：',
    editor: '编辑器：',
    meanwhileLive: '同时，这里也可访问：',

    somethingWentWrong: '发生错误',
    couldNotReachPanel: '无法连接到面板：',
    notSignedIn: '尚未登录。',
    requestFailed: '请求失败（{n}）。',
    couldNotCheck: '无法检查 — 请点「检查」重试。',
    ghConnectCancelled: 'GitHub 连接已取消或失败 — 请点「检查」重试。',
    upToDate: '已是最新',
    upToDateBody: '你的网站已运行最新的模板核心。',
    updateNotAvailable: '无法更新',
    updateAvailable: '有可用更新',
    comparing: '正在比较你的网站与模板…',
    updating: '更新中…',
    applyingUpdate: '正在应用更新并重建网站。约需一至两分钟。',
    updateComplete: '更新完成',
    updateCompleteBody: '你的网站已更新至模板 {to}（变更 {n} 个文件）。部署已触发 — 约一至两分钟后生效。',
    viewBuild: '查看构建',
    done: '完成',
    updateFailed: '更新失败',
    updateTo: '更新至 {to}',
    filesNeverTouched: '你的文章、图片与设置不受影响。会变更的文件：',
    noCoreChanges: '没有核心文件变更',
    moreFiles: '…还有 {n} 个',
    majorBump:
      '主要版本升级：{deps}。这可能改变外观或破坏自定义项 — 更新前请先确认。',
    updateFromTo: '将 {origin} 从模板 {from} 更新至 {to}。',
    filesBlocking: '阻止更新的文件：',
    confirmAnyway: '仍要继续更新',
    majorConfirmBody: '此更新会升级主要版本（{deps}），可能改变外观或破坏自定义项。',
    majorConfirmPrompt: '请选择继续或取消。',
    reasonDirty:
      '你的网站核心文件与模板不同 — 为避免覆盖你的更改，更新已阻止。',
    reasonCollision: '模板新增的文件已存在于你的网站 — 更新会覆盖它们。',
    reasonCi: '模板目前未通过自己的 CI — 通过前会暂停更新。',
    reasonLegacy: '此网站是在版本跟踪引入前创建的，目前不提供升级。',
    reasonUnreadable: '无法读取网站仓库（私有、已删除或无权限）。',

    deleteSite: '删除网站',
    deleteConfirmTitle: '确定要删除这个网站？',
    deleteConfirmBody: '这会永久删除 GitHub 仓库、Cloudflare Pages 项目和这条注册记录，无法撤销。',
    deleteCfToken: 'Cloudflare API 令牌（用于删除 Pages 项目）',
    deleteTypeHost: '输入网站地址以确认：',
    deleteConfirm: '永久删除',
    deleteCancel: '取消',
    deleting: '删除中…',
    deleteComplete: '网站已删除',
    deleteFailed: '删除失败',
    deleteRemaining: '无法移除以下项目：',
    setBaseline: '设置基准',
    baselineSetting: '设置中…',
    baselineComplete: '基准已设置，现在可以检查更新。',
    baselineFailed: '无法设置基准。',

    exportContent: '导出内容',
    exporting: '导出中…',
    exportFailed: '导出失败',
    bringContent: '沿用先前网站的内容',
    bringContentHint: '从你已有的文章、图片和设置开始。',
    contentFromSite: '从现有网站导入',
    contentNone: '无',
    contentUploadBundle: '上传内容备份 (.zip)',
    startFreshBringContent: '重新创建并沿用原有内容',

    notFoundTitle: '找不到页面',
    notFoundBody: '这个页面不存在。',
    tooManyTitle: '请求过多',
    tooManyBody: '此网络的请求过多 — 请几分钟后再试。',
    invalidOauth: 'OAuth 状态无效',
    invalidOauthBody: '请返回并重新连接 GitHub。',

    emailLoginSubject: 'kantan 登录链接',
    emailLoginTitle: '登录 kantan',
    emailLoginBody: '点击下方按钮登录你的 kantan 面板。',
    emailLoginButton: '登录',
    emailLoginExpires: '此链接将在 15 分钟后失效。',
    emailLoginIgnore: '如果你没有提出此请求，可以放心忽略这封邮件。',
  },
};

// Look up a localized string; `{key}` tokens are replaced from `params`.
export function t(locale, key, params) {
  const table = ui[locale] || ui[DEFAULT_LOCALE];
  let s = table[key] ?? ui[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

// The full flat string table for a locale, embedded into pages for the
// client-side script (window.I18N).
export function stringsFor(locale) {
  return ui[locale] || ui[DEFAULT_LOCALE];
}

// A collapsed language switcher for the panel shell: shows only the current
// language; clicking it expands all four (native names) upward, and choosing
// one navigates via /setlang (full reload → the new language, collapsed again).
// The expand/collapse toggle is wired by the script in shell().
export function languageSwitcher(locale, currentPath) {
  const next = currentPath && currentPath !== '/' ? `&next=${encodeURIComponent(currentPath)}` : '';
  return (
    `<nav class="lang-switch" aria-label="${t(locale, 'switchLanguage')}">` +
    `<button type="button" class="lang-toggle" aria-expanded="false" aria-controls="lang-list">` +
    `<span class="lang-current">${nativeNames[locale]}</span>` +
    `<span class="lang-caret" aria-hidden="true">▾</span>` +
    `</button>` +
    `<ul class="lang-list hidden" id="lang-list">` +
    LOCALES.map(
      (l) =>
        `<li><a href="/setlang?l=${l}${next}" lang="${l}"${l === locale ? ' aria-current="true"' : ''}>${nativeNames[l]}</a></li>`,
    ).join('') +
    `</ul>` +
    `</nav>`
  );
}

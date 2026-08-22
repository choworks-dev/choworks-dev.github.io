/* ============================================================
   codechains blog — static build
   Reads markdown from /content and static files from /assets,
   writes static HTML to /site.
   No build step runs on GitHub; it only serves the output.
   Run:  node scripts/build.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const fm = require("front-matter");
// 글을 읽는 규칙은 make-og.js 와 함께 씁니다(슬러그·날짜 해석이 어긋나지 않도록)
const { read, fmtDate, loadPosts, published, ogCardPath } = require("./posts");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const ASSETS = path.join(ROOT, "assets"); // 커밋되는 정적 원본(css 등) → site/assets/ 로 복사
const OUT = path.join(ROOT, "site");
const site = JSON.parse(fs.readFileSync(path.join(CONTENT, "site.json"), "utf8"));

marked.setOptions({ gfm: true, breaks: false });

/* ---------- helpers ---------- */
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
function write(rel, html) {
  const out = path.join(OUT, rel);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, html);
  return rel;
}
/* /assets 의 정적 원본을 그대로 site/assets/ 로 복사.
   (css·이미지 등은 build.js가 생성하는 게 아니라 커밋된 파일이므로 반드시 복사해야 배포에 포함됨) */
function copyAssets() {
  if (!fs.existsSync(ASSETS)) {
    throw new Error("assets/ 폴더가 없습니다. CSS 등 정적 원본은 assets/ 안에 두고 커밋하세요.");
  }
  const files = fs.readdirSync(ASSETS);
  if (!files.includes("style.css")) {
    throw new Error("assets/style.css 가 없습니다. 스타일 없이 배포되는 걸 막기 위해 빌드를 중단합니다.");
  }
  const dest = path.join(OUT, "assets");
  ensureDir(dest);
  /* 작업 파일은 배포에 넣지 않습니다.
     assets/ 는 통째로 복사되는 폴더라, 여기 둔 스크립트나 메모가 그대로 공개 주소로 열립니다.
     (로고를 만들던 파이썬 스크립트가 실제로 /assets/logo/ 에 올라가 있었습니다) */
  const SKIP = /\.(py|sh|ps1|bat|md|txt|psd|ai|sketch|fig)$|^\./i;
  fs.cpSync(ASSETS, dest, {
    recursive: true,
    filter: (src) => !SKIP.test(path.basename(src)),
  });
  return files.length;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- SEO 검사 ----------
   글이 발행될 때마다 검색 최적화 항목이 자동으로 채워지도록, 빌드가 직접 확인합니다.
   - 없으면 안 되는 것(title/date/description)은 오류 → 빌드 중단 → 배포되지 않음
   - 품질 문제(설명 길이, 태그 누락 등)는 경고 → 배포는 되지만 로그에 남음
   초안이라 아직 못 채웠다면 frontmatter 에 draft: true 를 넣으세요. 검사 대상에서 빠집니다. */
/* 기준이 언어마다 다릅니다.

   검색 결과에서 잘리는 기준은 글자 수가 아니라 픽셀 폭입니다. 한글은 한 글자가 영문
   두 글자쯤의 폭을 차지하므로, 같은 자릿수라도 한국어가 먼저 잘립니다.
   2026-08-22 에 발행된 열여섯 페이지를 재어 보니 한국어판 여덟 편 중 일곱 편의
   description 이 잘리고 있었습니다. 그때까지 영문 기준(40~160)을 한국어에도 그대로
   적용하고 있었기 때문입니다. */
const SEO = {
  ko: { descMin: 40, descMax: 80, titleMax: 30 },
  en: { descMin: 110, descMax: 155, titleMax: 60 },
};

function checkSeo(posts, label) {
  const S = SEO[label === "en" ? "en" : "ko"];
  /* 검사 결과는 글 단위로 모읍니다.
     콘솔 출력용 문자열과, 로컬 관리 페이지가 글마다 배지로 보여줄 목록이 같은 데이터에서 나옵니다. */
  const issues = []; // { slug, level: "error" | "warn", msg }
  const bySlug = new Map();
  const add = (slug, level, msg) => {
    const item = { slug, level, msg };
    issues.push(item);
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(item);
  };
  const seenSlugs = new Map();
  const seenStamps = new Map();

  posts.forEach((p) => {
    const err = (m) => add(p.slug, "error", m);
    const warn = (m) => add(p.slug, "warn", m);

    if (!p.title || !String(p.title).trim()) err(`title 이 없습니다.`);
    if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) err(`date 가 없거나 형식이 잘못됐습니다(YYYY-MM-DD).`);
    if (!p.description || !String(p.description).trim()) {
      err(`description 이 없습니다. 검색결과에 보이는 문장이라 글마다 반드시 달라야 합니다.`);
    } else {
      const len = String(p.description).trim().length;
      if (len < S.descMin) warn(`description 이 ${len}자로 짧습니다(권장 ${S.descMin}~${S.descMax}자).`);
      if (len > S.descMax) warn(`description 이 ${len}자로 깁니다. 검색결과에서 뒷부분이 잘립니다(권장 ${S.descMax}자 이내).`);
    }

    if (p.title && String(p.title).length > S.titleMax) {
      warn(`title 이 ${String(p.title).length}자로 깁니다. 검색결과에서 잘릴 수 있습니다(권장 ${S.titleMax}자 이내).`);
    }
    if (!(p.tags || []).length) warn(`tags 가 없습니다.`);

    /* 긴 하이픈(em dash —, en dash –)은 AI가 쓴 글이라는 인상을 주는 대표적인 흔적이라 기본적으로 쓰지 않습니다.
       쉼표나 마침표로 대체하세요. 의도적으로 넣은 경우라면 이 경고는 무시하면 됩니다(빌드는 통과). */
    const dashFields = [["title", p.title], ["description", p.description], ["본문", p.rawBody]];
    dashFields.forEach(([name, text]) => {
      if (text && /[—–]/.test(String(text))) {
        warn(`${name}에 긴 하이픈(— 또는 –)이 있습니다. 쉼표나 마침표로 바꾸세요.`);
      }
    });

    // 슬러그가 겹치면 나중 글이 앞 글을 덮어써 조용히 사라집니다
    if (seenSlugs.has(p.slug)) err(`슬러그가 "${seenSlugs.get(p.slug)}" 와 겹칩니다. 파일명을 바꾸세요.`);
    else seenSlugs.set(p.slug, p.slug);

    /* 발행 시각이 완전히 같으면 어느 글이 위로 갈지 글 스스로 정하지 못합니다.
       파일명 역순으로 갈라 두긴 하지만, 의도한 순서인지는 사람만 알 수 있으므로 알려줍니다. */
    const stampKey = String(new Date(p.stamp).getTime());
    if (seenStamps.has(stampKey)) {
      warn(`발행 시각이 "${seenStamps.get(stampKey)}" 와 같아 목록 순서가 정해지지 않습니다. 나중에 낸 글의 date 에 시각을 넣으세요(예: date: ${p.date} 14:00:00 +09:00).`);
    } else seenStamps.set(stampKey, p.slug);
  });

  const lines = (level) => issues.filter((i) => i.level === level).map((i) => `${label}/${i.slug}: ${i.msg}`);
  return { errors: lines("error"), warnings: lines("warn"), bySlug };
}

function reportSeo(groups) {
  const errors = groups.flatMap((g) => g.errors);
  const warnings = groups.flatMap((g) => g.warnings);

  warnings.forEach((w) => console.warn(`  [SEO 경고] ${w}`));
  if (errors.length) {
    console.error("\n[SEO 검사 실패] 아래를 고쳐야 배포됩니다:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\n(아직 다듬는 중이라면 frontmatter 에 draft: true 를 넣어 두세요.)\n");
    process.exit(1);
  }
  if (warnings.length) console.warn("");
}

const LOGO = `<svg class="logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12.5 19.5l7-7" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"/><path d="M14.8 9.2l1.7-1.7a4.6 4.6 0 016.5 6.5l-1.7 1.7" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"/><path d="M17.2 22.8l-1.7 1.7a4.6 4.6 0 01-6.5-6.5l1.7-1.7" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"/><defs><linearGradient id="g" x1="6" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#6ee7b7"/><stop offset="1" stop-color="#7aa2ff"/></linearGradient></defs></svg>`;

const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('cc-theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();</script>`;
const THEME_TOGGLE_JS = `<script>(function(){var b=document.getElementById('themeBtn');if(!b)return;function cur(){return document.documentElement.getAttribute('data-theme')||'dark';}function set(v){document.documentElement.setAttribute('data-theme',v);try{localStorage.setItem('cc-theme',v);}catch(e){}b.textContent=v==='dark'?'☀':'☾';}b.textContent=cur()==='dark'?'☀':'☾';b.addEventListener('click',function(){set(cur()==='dark'?'light':'dark');});})();</script>`;
const SUBSCRIBE_JS = `<script>(function(){var f=document.getElementById('subForm');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('subNote');if(n)n.style.display='block';});})();</script>`;

/* 언어 이어가기 — 한국어 홈(/)에서만 동작.

   예전에는 브라우저 언어(navigator.languages)를 보고 한국어가 아니면 자동으로 /en/ 으로
   보냈습니다. 그 방식은 접었습니다. Googlebot 도 자바스크립트를 실행하고 그 언어 설정이
   보통 영어라, 크롤러가 한국어 홈을 보러 왔다가 영어 홈으로 튕겨 나갔기 때문입니다.
   구글은 인지된 언어에 따른 자동 리디렉션을 권장하지 않습니다(크롤러가 모든 언어판을
   보지 못하게 됨). 대신 다른 언어판이 있다는 것을 화면에 보이게 알립니다(langNotice).

   지금 남은 동작은 하나입니다. 사용자가 언어를 직접 고른 적이 있으면 그 선택을 이어 줍니다.
   크롤러에는 저장된 선택이 없으므로 이동이 일어나지 않습니다.
   깜빡임을 없애려고 <head>에서 본문 렌더 전에 실행하고, 히스토리를 더럽히지 않도록 replace 를 씁니다. */
const LANG_REDIRECT = `<script>(function(){try{if(localStorage.getItem('cc-lang')==='en'){location.replace('/en/');}}catch(e){}})();</script>`;

/* 언어 링크(머리말·안내 줄)를 직접 눌렀을 때 그 선택을 기억 */
const LANG_REMEMBER_JS = `<script>(function(){[].slice.call(document.querySelectorAll('[data-lang]')).forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('cc-lang',a.getAttribute('data-lang'));}catch(e){}});});})();</script>`;

const T = {
  ko: { nav_about: "소개", home: "홈", posts: "글", langAlt: "EN", author_label: "글쓴이", author_more: "소개 보기", contact: "비슷한 상황이라면 편하게 물어보세요.", nl_h: "새 글을 이메일로 받아보기", nl_p: "AI 트랜스폼 여정의 새 글을 가장 먼저 받아보세요. 스팸은 없습니다.", nl_btn: "구독", nl_ph: "이메일 주소", nl_note: `구독 기능은 곧 연결됩니다. 우선 ${site.email} 로 연락 주셔도 좋아요!`, ad: "광고 영역 (애드센스 승인 후 표시됩니다)", latest: "최근 글", back: "← 목록으로", readmore: "읽기", next_post: "다음 글", prev_post: "이전 글" },
  en: { nav_about: "About", home: "Home", posts: "Posts", langAlt: "한국어", author_label: "Written by", author_more: "About me", contact: "In a similar spot? Feel free to ask.", nl_h: "Get new posts by email", nl_p: "Be first to read new posts from the AI transformation journey. No spam.", nl_btn: "Subscribe", nl_ph: "your email", nl_note: `Subscriptions are being wired up. For now, reach me at ${site.email}!`, ad: "Ad slot (shown after AdSense approval)", latest: "Latest posts", back: "← All posts", readmore: "Read", next_post: "Next post", prev_post: "Previous post" },
};

/* 공유 카드 이미지의 실제 크기. og:image:width/height 를 같이 보내면
   카카오톡·페이스북 같은 곳이 이미지를 받기 전에도 자리를 잡아, 처음 공유할 때
   미리보기가 비어 보이는 일이 줄어듭니다. 파일에서 직접 읽으므로 카드를 다시 만들어도 맞습니다.
   같은 파일을 여러 페이지가 쓰므로 한 번 읽은 것은 기억해 둡니다. */
const dimsCache = new Map();
function pngDims(rel) {
  if (dimsCache.has(rel)) return dimsCache.get(rel);
  let dims = null;
  try {
    const b = fs.readFileSync(path.join(ASSETS, rel.replace(/^\/assets\//, "")));
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (b.slice(0, 8).equals(sig)) dims = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch (e) {}
  dimsCache.set(rel, dims);
  return dims;
}

/* 글이 자기 카드를 가지고 있으면 그것을, 없으면 사이트 공용 카드를 씁니다.
   카드를 아직 안 만든 글도 빈 미리보기로 나가지 않도록 하는 안전장치입니다.
   (새 글을 쓰고 npm run og 를 아직 안 돌린 상태가 여기에 해당합니다) */
function cardFor(lang, slug) {
  const rel = ogCardPath(lang, slug);
  if (fs.existsSync(path.join(ASSETS, rel.replace(/^\/assets\//, "")))) return rel;
  return site.ogImage;
}

/* ---------- layout ---------- */
/* JSON-LD 를 <script> 안에 안전하게 넣기 — 본문에 </script> 가 섞여도 태그가 깨지지 않도록 < 를 이스케이프 */
function jsonLdTag(obj) {
  if (!obj) return "";
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>\n`;
}

/* 스레드 아이콘. 푸터에 한 번 들어가는 게 전부라 파일로 빼지 않고 인라인으로 둡니다.
   fill="currentColor" 라서 푸터 글자색(다크·라이트, hover)을 그대로 따라갑니다. */
const THREADS_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/></svg>`;

function layout({ lang, title, description, canonical, langAltHref, active, body, autoLang, noAlt, noIndex, ogType, published, jsonLd, card }) {
  const t = T[lang];
  const isEn = lang === "en";
  // hreflang: 검색엔진에 "같은 글의 다른 언어판"을 알려 각 언어권에 맞는 페이지가 노출되게 함
  const koHref = isEn ? langAltHref : canonical;
  const enHref = isEn ? canonical : langAltHref;
  /* x-default 는 한국어도 영어도 아닌 방문자가 갈 곳입니다(독일어·일본어 등).
     영어를 기본으로 둡니다. 해외 유입을 주로 보고 있고, 제3언어권 방문자에게는
     읽지 못하는 한국어보다 영어가 낫기 때문입니다.
     한국어 사용자는 hreflang="ko" 를 따라가므로 이 값에 영향받지 않습니다. */
  const altLinks = noAlt
    ? ""
    : `<link rel="alternate" hreflang="ko" href="${site.url}${koHref}">
<link rel="alternate" hreflang="en" href="${site.url}${enHref}">
<link rel="alternate" hreflang="x-default" href="${site.url}${enHref}">
`;
  /* 공유 카드 이미지. site.json 의 ogImage 에 경로(예: "/assets/og.png")를 채우면 활성화됩니다.
     이미지가 없는데 summary_large_image 를 선언하면 SNS에서 빈 카드가 뜨므로,
     이미지가 있을 때만 큰 카드를 쓰고 없으면 summary 로 낮춥니다. */
  const cardSrc = card || site.ogImage;
  const dims = cardSrc ? pngDims(cardSrc) : null;
  const ogImage = cardSrc
    ? `<meta property="og:image" content="${site.url}${cardSrc}">
<meta property="og:image:alt" content="${esc(title || site.brand)}">
${dims ? `<meta property="og:image:width" content="${dims.w}">
<meta property="og:image:height" content="${dims.h}">
` : ""}<meta name="twitter:image" content="${site.url}${cardSrc}">
`
    : "";
  const homeHref = isEn ? "/en/" : "/";
  const aboutHref = isEn ? "/en/about/" : "/about/";
  /* 홈 제목은 태그라인과 따로 둡니다.
     태그라인은 첫 화면에서 사람을 세우는 문장이라 길어도 되지만,
     검색 결과의 제목은 한글 기준 30자 안팎에서 잘립니다. 같은 문장을 두 자리에 쓰면
     한쪽이 반드시 손해를 봅니다. homeTitle 이 비어 있으면 예전처럼 태그라인을 씁니다. */
  const homeTitle = (isEn ? site.homeTitleEn : site.homeTitleKo) || (isEn ? site.taglineEn : site.taglineKo);
  /* 글 페이지에는 브랜드를 안 붙입니다.

     " · choworks.dev" 가 15자인데, 한국어 검색 결과는 30자쯤에서 잘립니다.
     즉 브랜드가 제목 자리의 절반을 먹습니다. 2026-08-22 에 재어 보니 여덟 편 중 여섯 편의
     제목이 검색 결과에서 중간에 끊기고 있었고, 끊긴 자리가 대부분 글 제목이었습니다.

     브랜드는 어차피 결과 화면에 도메인으로 따로 표시됩니다. 제목에서 한 번 더 말할 이유가 없습니다.
     홈·소개·404 처럼 글이 아닌 페이지에는 그대로 붙입니다. 거기는 브랜드가 곧 제목입니다.

     og:title 은 따로 둡니다. 링크를 공유했을 때는 어느 사이트 글인지가 보여야 하고,
     거기에는 글자 수 제한이 검색 결과만큼 빡빡하지 않습니다. */
  const brandless = ogType === "article";
  const fullTitle = title
    ? (brandless ? title : `${title} · ${site.brand}`)
    : `${site.brand} · ${homeTitle}`;
  const shareTitle = title ? `${title} · ${site.brand}` : fullTitle;
  const desc = description || (isEn ? site.descriptionEn : site.descriptionKo);
  return `<!doctype html>
<html lang="${isEn ? "en" : "ko"}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site.url}${canonical}">
${noIndex ? `<meta name="robots" content="noindex, nofollow">
` : ""}
${naverTags(site.naverVerification)}<meta name="author" content="${esc(authorName(lang))}">
<meta property="og:type" content="${ogType || "website"}">
<meta property="og:site_name" content="${esc(site.brand)}">
<meta property="og:locale" content="${isEn ? "en_US" : "ko_KR"}">
<meta property="og:locale:alternate" content="${isEn ? "ko_KR" : "en_US"}">
<meta property="og:title" content="${esc(shareTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${site.url}${canonical}">
${published ? `<meta property="article:published_time" content="${published}">
<meta property="article:author" content="${esc(authorName(lang))}">
` : ""}${ogImage}<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
${altLinks}<link rel="alternate" type="application/rss+xml" title="${site.brand}" href="/feed.xml">
<link rel="stylesheet" href="/assets/style.css">
${jsonLdTag(jsonLd)}${autoLang ? LANG_REDIRECT : ""}
${THEME_SCRIPT}
</head>
<body>
<header class="site-header"><div class="wrap">
  <a class="brand" href="${homeHref}"><span class="wordmark">${esc(site.brand)}</span></a>
  <nav class="nav">
    <a href="${homeHref}">${t.home}</a>
    <a href="${aboutHref}">${t.nav_about}</a>
    <span class="sep"></span>
    <a id="langLink" data-lang="${isEn ? "ko" : "en"}" href="${langAltHref}" title="${t.langAlt}">${t.langAlt}</a>
    <button class="iconbtn" id="themeBtn" aria-label="theme">☀</button>
  </nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <span>© ${esc(authorName(lang))} · ${esc(site.brand)}</span>
  <span class="foot-links">
    ${isEn || !site.threadsUrl ? "" : `<a class="foot-icon" href="${site.threadsUrl}" target="_blank" rel="me noopener" title="Threads" aria-label="Threads">${THREADS_ICON}</a>`}
    <a href="/feed.xml">RSS</a>
  </span>
</div></footer>
${THEME_TOGGLE_JS}
${LANG_REMEMBER_JS}
${NEWSLETTER_ENABLED ? SUBSCRIBE_JS : ""}
${webAnalytics()}
${naverAnalytics()}
</body>
</html>`;
}

/* 배포 빌드인가. 로컬에서 돌린 빌드와 갈라야 하는 것들이 여기에 걸립니다.
   (관리 페이지 생성 여부, 방문 측정 스크립트 삽입 여부)
   선언이 여기 있는 이유는 layout() 이 이 값을 읽는데, layout() 은 파일 아래쪽
   run 구간에서 불리기 때문입니다. 선언이 run 구간에 있으면 그 시점에 아직 초기화 전이라
   ReferenceError 가 납니다. */
const DEPLOY = process.env.CC_DEPLOY === "1" || process.env.CI === "true";

/* ---------- 방문 측정 (Cloudflare Web Analytics) ----------
   choworks.dev 는 회색 구름(프록시 끔)으로 GitHub Pages 를 가리킵니다. 트래픽이 Cloudflare 를
   거치지 않으므로 Cloudflare 대시보드의 애널리틱스에는 이 사이트가 영원히 나오지 않습니다.
   프록시를 켜면 되는 문제가 아닙니다. 켜는 순간 GitHub 의 인증서 발급이 깨집니다.
   그래서 서버가 아니라 페이지에서 재는 방식(자바스크립트 비컨)을 씁니다.

   토큰은 비밀값이 아닙니다. 모든 페이지의 HTML 에 그대로 실려 나가는 값이라 숨길 수가 없고,
   숨길 이유도 없습니다. 그래서 .env 가 아니라 content/site.json 에 둡니다.

   배포 빌드에만 넣습니다. 로컬에서 고치고 새로고침한 것까지 방문으로 세면 숫자를 못 믿게 됩니다.
   글을 쓰는 동안 하루에 수십 번 새로고침하므로 이 구분이 없으면 통계가 통째로 망가집니다.

   type="module" 은 Cloudflare 가 주는 스니펫 그대로입니다. defer 로 바꾸지 마세요.
   beacon.min.js 가 ES 모듈이라 일반 스크립트로 부르면 문법 오류로 죽습니다.
   모듈 스크립트는 원래 defer 처럼 동작하므로 로딩을 막지도 않습니다.
   토큰도 관리 화면의 스니펫에서 그대로 가져와야 합니다. 대시보드 주소에 보이는 32자리 값은
   site tag 이지 토큰이 아닙니다. 형식이 똑같이 생겨서 헷갈리는데, 넣으면 조용히 실패합니다.
   스크립트는 멀쩡히 로드되고 데이터만 어디에도 안 쌓입니다. */
function webAnalytics() {
  const token = String(site.cfAnalyticsToken || "").trim();
  if (!DEPLOY || !token) return "";
  return `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>`;
}

/* 네이버 애널리틱스.
   Cloudflare 비컨과 따로 둡니다. 재는 것이 겹치지만 보는 곳이 다릅니다.
   네이버 쪽은 네이버 검색으로 들어온 사람이 어떤 검색어를 쳤는지를 서치어드바이저와
   같은 자리에서 보여줍니다. Cloudflare 는 그걸 모릅니다.

   아이디는 비밀값이 아닙니다. 모든 페이지의 HTML 에 그대로 실려 나가는 값이라
   숨길 수가 없고 숨길 이유도 없습니다. 그래서 content/site.json 에 둡니다.

   배포 빌드에만 넣습니다. 로컬에서 고치고 새로고침한 것까지 방문으로 세면 숫자를 못 믿게 됩니다.

   스니펫은 네이버가 주는 그대로입니다. 손대지 마세요.
   src 가 //wcs.pstatic.net 으로 시작하는 것도, if(!wcs_add) 가 선언 전의 변수를 보는 것도
   원본 그대로입니다. 후자는 var 호이스팅에 기대는 옛날 코드라 얌전히 고치고 싶어지는데,
   고치면 네이버가 스니펫을 바꿨을 때 무엇이 원본이었는지 알 수 없게 됩니다. */
function naverAnalytics() {
  const id = String(site.naverAnalyticsId || "").trim();
  if (!DEPLOY || !id) return "";
  return `<script type="text/javascript" src="//wcs.pstatic.net/wcslog.js"></script>
<script type="text/javascript">
if(!wcs_add) var wcs_add = {};
wcs_add["wa"] = "${id}";
if(window.wcs) {
  wcs_do();
}
</script>`;
}

/* 뉴스레터 구독 노출 스위치.
   구독 서비스를 실제로 시작할 때 true 로 바꾸면 홈·소개·글 하단에 다시 나타납니다.
   (마크업·문구·스크립트는 그대로 보존돼 있어 되돌리는 데 이 한 줄이면 됩니다) */
const NEWSLETTER_ENABLED = false;

/* 글 끝 연락 한 줄 노출 스위치.
   읽고 마음이 움직인 사람이 갈 곳이 없으면 그대로 닫고 나갑니다. 그래서 한 줄만 둡니다.
   판매 문구를 붙이지 않는 이유는, 이 글들이 읽히는 이유가 광고가 아니라 기록이기 때문입니다.
   문구를 고치려면 T 의 contact 를 손보세요. */
const CONTACT_ENABLED = true;

/* 광고 영역 노출 스위치.
   애드센스 승인 후 true 로 바꾸면 글 하단에 자리가 다시 생깁니다.
   그때 buildPost 의 .ad-slot 를 <ins class="adsbygoogle"> 코드로 교체하세요. */
const ADS_ENABLED = false;

function newsletter(lang) {
  if (!NEWSLETTER_ENABLED) return "";
  const t = T[lang];
  return `<section class="newsletter">
  <h3>${t.nl_h}</h3>
  <p>${t.nl_p}</p>
  <form class="subscribe" id="subForm" action="#" method="post">
    <input type="email" placeholder="${t.nl_ph}" aria-label="email" required>
    <button class="btn btn-primary" type="submit">${t.nl_btn}</button>
  </form>
  <p id="subNote" style="display:none;margin-top:.8rem;color:var(--accent-2);font-size:.9rem">${t.nl_note}</p>
</section>`;
}

/* ---------- 저자 ----------
   글 끝에 "누가 썼는가"를 사람이 볼 수 있게 남깁니다.
   구글 E-E-A-T(경험·전문성·권위·신뢰) 신호이자, 일반적인 글의 형식이기도 합니다.
   같은 정보를 JSON-LD 의 author 로도 내보내 크롤러가 사람과 글을 연결할 수 있게 합니다. */
/* 이름도 언어별로 다릅니다. 한국어 화면에는 "조웍", 영문에는 "Cho Works".
   한국어 독자에게 로마자 이름은 남의 이름처럼 읽혀서 사람과 글이 잘 연결되지 않습니다.
   값은 site.json 의 authorKo / authorEn 에서 관리합니다. */
const authorName = (lang) => (lang === "en" ? site.authorEn : site.authorKo) || site.author || "";
const authorBio = (lang) => (lang === "en" ? site.authorBioEn : site.authorBioKo) || "";

/* 다른 언어판이 있다는 것을 눈에 보이게 알립니다. 자동 이동을 없앤 자리를 채우는 장치입니다.
   문구는 읽는 사람이 아는 언어로 씁니다. 한국어 화면에는 영어로, 영어 화면에는 한국어로.
   그래야 자기가 못 읽는 화면에 떨어진 사람이 이 줄만은 알아봅니다. */
/* 네이버 소유확인 태그. 값을 여러 개 둘 수 있습니다.
   네이버는 http://example.com 과 https://example.com 을 다른 사이트로 세고,
   사이트마다 확인 값이 따로 나옵니다. 프로토콜을 옮기는 동안에는 둘 다 걸려 있어야
   리포트가 끊기지 않습니다. 문자열 하나만 적어도 그대로 동작합니다. */
function naverTags(v) {
  const list = (Array.isArray(v) ? v : [v]).filter(Boolean);
  return list.map((c) => `<meta name="naver-site-verification" content="${esc(c)}">
`).join("");
}

function langNotice(lang) {
  const isEn = lang === "en";
  return `<p class="lang-notice">
  <span>${isEn ? "이 사이트는 한국어로도 읽을 수 있습니다." : "This site is also available in English."}</span>
  <a data-lang="${isEn ? "ko" : "en"}" href="${isEn ? "/" : "/en/"}">${isEn ? "한국어로 보기" : "Read in English"} →</a>
</p>`;
}

/* ---------- 글 사이 이동 ----------
   글을 끝까지 읽은 사람이 갈 곳을 한 자리 만들어 둡니다. 목록으로 돌아가 제목을 다시 고르게 하면
   대부분 그냥 닫습니다. 다음 글 제목이 눈앞에 보이면 한 편 더 읽습니다.

   있는 쪽을 다 보여줍니다. 한 편만 보여주던 때는 최신 글에서 이전 글로 한 번 내려가면
   그 글에는 왔던 곳으로 돌아가는 "다음 글" 하나뿐이라 거기서 길이 막혔습니다.
   두 편을 이어 읽은 사람이 제일 더 읽을 마음이 있는 사람인데, 하필 그 자리에서 막혔습니다.

   목록은 최신순이라 배열에서 하나 앞(i-1)이 더 최근, 하나 뒤(i+1)가 더 예전입니다. */
function neighborsOf(posts, i) {
  return { next: posts[i - 1] || null, prev: posts[i + 1] || null };
}

function postNav(lang, nav) {
  if (!nav || (!nav.next && !nav.prev)) return ""; // 글이 한 편뿐이면 이동할 곳이 없습니다
  const t = T[lang];
  const base = lang === "en" ? "/en/posts/" : "/posts/";
  /* rel="next"/"prev" 는 크롤러가 글의 순서를 이해하는 데 씁니다.
     라벨 끝의 콜론이 "이 다음에 오는 것이 제목이다"를 말해 줍니다.
     화살표를 같이 쓰면 콜론과 역할이 겹치고 "다음 글: →" 처럼 읽히므로 두지 않습니다.
     방향은 다음/이전 이라는 낱말이 이미 말하고 있습니다.

     더 최근 글을 위에 둡니다. 방금 한 편을 읽은 사람은 대개 앞으로 나아갑니다. */
  const link = (post, rel, label) => (post ? `  <a class="post-nav-link" href="${base}${post.slug}/" rel="${rel}">
    <span class="post-nav-label">${label}:</span>
    <span class="post-nav-title">${esc(post.title)}</span>
  </a>` : "");
  const links = [link(nav.next, "next", t.next_post), link(nav.prev, "prev", t.prev_post)].filter(Boolean);
  return `<nav class="post-nav">
${links.join("\n")}
</nav>`;
}

function contactLine(lang) {
  if (!CONTACT_ENABLED) return "";
  return `<p class="post-contact">${T[lang].contact} <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>`;
}

function authorCard(lang) {
  const t = T[lang];
  const aboutHref = lang === "en" ? "/en/about/" : "/about/";
  return `<aside class="author-card">
  <div class="author-avatar" aria-hidden="true">${LOGO}</div>
  <div class="author-body">
    <p class="author-label">${t.author_label}</p>
    <p class="author-name">${esc(authorName(lang))}</p>
    <p class="author-bio">${esc(authorBio(lang))}</p>
    <p class="author-links">
      <a href="${aboutHref}">${t.author_more}</a>
    </p>
  </div>
</aside>`;
}

/* ---------- 구조화 데이터 (schema.org) ---------- */
/* logo 를 넣지 않습니다. 파비콘을 걷어내면서 로고로 내세울 그림 파일이 없어졌습니다.
   schema.org 에서 선택 항목이고, 없는 파일을 가리키는 것보다 비우는 편이 맞습니다.
   로고 그림이 다시 생기면 logo: { "@type": "ImageObject", url: ... } 를 되살리면 됩니다. */
const PUBLISHER = {
  "@type": "Organization",
  name: site.brand,
  url: site.url,
};
const authorOf = (lang) => ({ "@type": "Person", name: authorName(lang), url: site.url });
const authorNode = (lang) => ({
  ...authorOf(lang),
  description: authorBio(lang),
  email: `mailto:${site.email}`,
  sameAs: [site.github],
});

function postJsonLd(post, lang, canonical) {
  const iso = post.stamp;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description || "",
    inLanguage: lang === "en" ? "en" : "ko",
    datePublished: iso,
    dateModified: iso,
    author: authorNode(lang),
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${site.url}${canonical}` },
    url: `${site.url}${canonical}`,
    ...((post.tags || []).length ? { keywords: post.tags.join(", ") } : {}),
    ...(cardFor(lang, post.slug) ? { image: `${site.url}${cardFor(lang, post.slug)}` } : {}),
  };
}

function postListItems(posts, lang) {
  const base = lang === "en" ? "/en/posts/" : "/posts/";
  return posts
    .map((p) => {
      const tags = (p.tags || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
      return `<li><a class="post-item" href="${base}${p.slug}/">
      <time datetime="${p.date}">${fmtDate(p.date, lang)}</time>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.description || "")}</p>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
    </a></li>`;
    })
    .join("\n");
}

/* ---------- pages ---------- */
function buildHome(lang, posts) {
  const t = T[lang];
  const isEn = lang === "en";
  const tagline = isEn ? site.taglineEn : site.taglineKo;
  const intro = isEn
    ? "The journey of moving into AI, built and documented in the open, one link at a time."
    : "작은 회사를 운영하며 미뤄둔 IT 일을 AI로 하나씩 처리한 기록. 홈페이지 이전으로 연 59만원을 줄이고, 견적 발송을 하루에서 5분으로 바꾼 과정을 그대로 적습니다.";

  /* 한국어 첫 화면은 쓰레드에서 넘어온 사장님이 봅니다.
     "코드", "커리어", "여정" 같은 말은 IT 에서 밀려나 있던 사람에게 자기 얘기로 안 읽힙니다.
     본인이 겪는 상태(몇 년째 미뤄둔 일)를 먼저 말하고, 도구 이름을 구체적으로 붙입니다.

     버튼도 순서를 바꿨습니다. 쓰레드 글을 보고 들어온 사람이 원하는 것은
     소개가 아니라 그 이야기의 나머지입니다. */
  const body = `${langNotice(lang)}
<section class="hero">
  <h1>${isEn ? "Chaining code into a<br><span class=\"grad\">new career.</span>" : "몇 년째 미뤄둔 일을<br><span class=\"grad\">하나씩 끝내고 있습니다.</span>"}</h1>
  <p>${esc(tagline)}</p>
  <div class="cta">
    ${isEn
      ? `<a class="btn btn-primary" href="/en/about/">About me</a>
    <a class="btn btn-ghost" href="#latest">Read posts</a>`
      : `<a class="btn btn-primary" href="#latest">글 읽기</a>
    <a class="btn btn-ghost" href="/about/">소개 보기</a>`}
  </div>
</section>
<h2 class="section-title" id="latest">${t.latest}</h2>
<ul class="postlist">
${postListItems(posts, lang)}
</ul>
${newsletter(lang)}`;
  const canonical = isEn ? "/en/" : "/";
  const langAlt = isEn ? "/" : "/en/";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: site.brand,
    url: `${site.url}${canonical}`,
    description: intro,
    inLanguage: isEn ? "en" : "ko",
    author: authorOf(lang),
    publisher: PUBLISHER,
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${site.url}${isEn ? "/en/posts/" : "/posts/"}${p.slug}/`,
      datePublished: p.stamp,
    })),
  };
  // 자동 언어 분기는 기본 진입점인 한국어 홈(/)에서만. 깊은 링크나 /en/ 은 방문자의 의도로 보고 건드리지 않음
  return layout({ lang, title: "", description: intro, canonical, langAltHref: langAlt, active: "home", body, autoLang: !isEn, jsonLd });
}

function buildAbout(lang) {
  const isEn = lang === "en";
  const file = path.join(CONTENT, isEn ? "about-en.md" : "about.md");
  const parsed = fm(read(file));
  /* 본문 맨 끝(연락 줄) 아래에 붙는 스레드 계정 한 줄.
     about.md 안에 SVG 를 박아 두면 글이 마크업으로 지저분해지므로 여기서 이어 붙입니다.
     계정 이름은 주소에서 뽑아 쓰므로 site.json 의 threadsUrl 한 곳만 고치면 됩니다. */
  const threadsHandle = (site.threadsUrl || "").split("/").filter(Boolean).pop();
  const threadsLine = isEn || !site.threadsUrl
    ? ""
    : `<p class="about-threads"><a href="${site.threadsUrl}" target="_blank" rel="me noopener">${THREADS_ICON}<span>${esc(threadsHandle)}</span></a></p>`;
  const body = `<article class="article">
  <div class="article-head"><h1>${esc(parsed.attributes.title)}</h1></div>
  <div class="prose">${marked.parse(parsed.body)}${threadsLine}</div>
</article>
${newsletter(lang)}`;
  const canonical = isEn ? "/en/about/" : "/about/";
  const langAlt = isEn ? "/about/" : "/en/about/";
  // 소개 페이지는 인물 정보로 표시 — 검색에서 사람을 찾는 경로(협업·기회 제안)를 열어둠
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${site.url}${canonical}`,
    inLanguage: isEn ? "en" : "ko",
    mainEntity: {
      ...authorOf(lang),
      email: `mailto:${site.email}`,
      description: parsed.attributes.description || "",
      sameAs: [site.github],
    },
  };
  return layout({ lang, title: parsed.attributes.title, description: parsed.attributes.description, canonical, langAltHref: langAlt, active: "about", body, jsonLd });
}

/* hasAlt: 같은 슬러그의 다른 언어판이 실제로 발행돼 있는가.
   없는 주소를 hreflang 으로 가리키면 구글은 상호 참조가 안 된다고 보고 그 짝을 통째로 무시하고,
   x-default 까지 404 면 국제 타게팅 자체가 깨집니다. 그래서 짝이 있을 때만 alternate 를 냅니다. */
function buildPost(lang, post, hasAlt, nav) {
  const t = T[lang];
  const isEn = lang === "en";
  const tags = (post.tags || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
  const body = `<article class="article">
  <div class="article-head">
    <p class="article-meta">
      <time datetime="${post.date}">${fmtDate(post.date, lang)}</time>
      <span class="dot" aria-hidden="true">·</span>
      <a class="byline" href="${isEn ? "/en/about/" : "/about/"}" rel="author">${esc(authorName(lang))}</a>
    </p>
    <h1>${esc(post.title)}</h1>
    ${tags ? `<div class="tags" style="margin-top:.8rem">${tags}</div>` : ""}
  </div>
  <div class="prose">${post.bodyHtml}</div>
  ${postNav(lang, nav)}
  ${authorCard(lang)}
  ${contactLine(lang)}
  ${ADS_ENABLED ? `<div class="ad-slot">${t.ad}</div>` : ""}
  <a class="backlink" href="${isEn ? "/en/" : "/"}">${t.back}</a>
</article>
${newsletter(lang)}`;
  const canonical = `${isEn ? "/en/posts/" : "/posts/"}${post.slug}/`;
  // 짝이 없으면 머리말의 언어 링크는 그 언어의 홈으로 보냅니다(없는 글 주소로 보내 404 를 만들지 않도록)
  const langAlt = hasAlt ? `${isEn ? "/posts/" : "/en/posts/"}${post.slug}/` : isEn ? "/" : "/en/";
  return layout({
    lang, title: post.title, description: post.description, canonical, langAltHref: langAlt, active: "home", body,
    noAlt: !hasAlt,
    ogType: "article",
    published: post.stamp,
    card: cardFor(lang, post.slug), // 글마다 제목이 박힌 카드. 없으면 공용 카드로 내려갑니다
    jsonLd: postJsonLd(post, lang, canonical),
  });
}

/* ---------- feeds ---------- */
function buildFeed(posts) {
  const items = posts.slice(0, 20).map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${site.url}/posts/${p.slug}/</link>
    <guid>${site.url}/posts/${p.slug}/</guid>
    <pubDate>${new Date(p.stamp).toUTCString()}</pubDate>
    <description>${esc(p.description || "")}</description>
  </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(site.brand)}</title>
  <link>${site.url}/</link>
  <description>${esc(site.descriptionKo)}</description>
  <language>ko</language>
${items}
</channel></rss>`;
}
// 네임스페이스는 반드시 sitemaps.org (복수형). 오타가 나면 Search Console이 사이트맵을 통째로 거부합니다.
function buildSitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
    .map(({ loc, lastmod }) =>
      `  <url><loc>${site.url}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
    .join("\n")}
</urlset>`;
}

/* ---------- run ---------- */
const assetCount = copyAssets();
// 언어별 글 폴더는 이름만 다르고 나란히 있습니다(posts-kr / posts-en).
// 소개 페이지도 같은 규칙으로 about.md / about-en.md 입니다.
const koAll = loadPosts(path.join(CONTENT, "posts-kr"));
const enAll = loadPosts(path.join(CONTENT, "posts-en"));
const koPosts = published(koAll);
const enPosts = published(enAll);
// 언어판이 짝을 이루는지 확인하는 데 씁니다(hreflang 을 낼지, 한 언어로만 낼지)
const koSlugs = new Set(koPosts.map((p) => p.slug));
const enSlugs = new Set(enPosts.map((p) => p.slug));
// 초안은 검사 대상이 아닙니다(아직 다듬는 중이므로). 공개되는 글만 봅니다.
const koSeo = checkSeo(koPosts, "ko");
const enSeo = checkSeo(enPosts, "en");
reportSeo([koSeo, enSeo]);
const urls = [];
// 홈·목록의 lastmod 는 가장 최근 글의 날짜로 — 새 글이 나가면 크롤러가 다시 훑도록
const latestKo = koPosts[0] && koPosts[0].date;
const latestEn = enPosts[0] && enPosts[0].date;

write("index.html", buildHome("ko", koPosts)); urls.push({ loc: "/", lastmod: latestKo });
write("about/index.html", buildAbout("ko")); urls.push({ loc: "/about/" });
koPosts.forEach((p, i) => { write(`posts/${p.slug}/index.html`, buildPost("ko", p, enSlugs.has(p.slug), neighborsOf(koPosts, i))); urls.push({ loc: `/posts/${p.slug}/`, lastmod: p.date }); });

write("en/index.html", buildHome("en", enPosts)); urls.push({ loc: "/en/", lastmod: latestEn });
write("en/about/index.html", buildAbout("en")); urls.push({ loc: "/en/about/" });
enPosts.forEach((p, i) => { write(`en/posts/${p.slug}/index.html`, buildPost("en", p, koSlugs.has(p.slug), neighborsOf(enPosts, i))); urls.push({ loc: `/en/posts/${p.slug}/`, lastmod: p.date }); });

write("feed.xml", buildFeed(koPosts));
write("sitemap.xml", buildSitemap(urls));
/* 파비콘은 만들지 않습니다. <head> 에 rel="icon" 도 넣지 않으므로 브라우저 기본 아이콘이 뜹니다.
   예전에는 assets/favicon.svg 가 없으면 기본 파비콘을 여기서 만들어 넣었는데,
   그 자동 생성이 남아 있으면 파일만 지워도 파비콘이 되살아납니다. 함께 걷어냈습니다. */
/* 쓰레드 앱의 리다이렉트 주소.
   Meta 는 실제로 열리지 않는 주소를 앱 설정에 등록하지 못하게 막습니다. 그래서 빈 페이지라도 있어야 합니다.
   겸사겸사 주소창에 붙는 code 를 화면에 크게 띄워 줍니다. 손으로 주소창에서 잘라내는 것보다 덜 틀립니다.
   토큰이나 비밀값은 이 페이지를 지나가지 않습니다. code 는 몇 분이면 만료되는 일회용입니다. */
write("threads-callback/index.html", layout({
  lang: "ko",
  title: "쓰레드 연결",
  description: "쓰레드 앱 인증 코드를 받는 자리입니다.",
  canonical: "/threads-callback/",
  langAltHref: "/",
  active: "",
  noAlt: true,
  noIndex: true, // 검색에 잡힐 이유가 없는 도구 페이지입니다
  body: `<section class="hero">
  <h1>쓰레드 연결</h1>
  <p id="msg">주소에 코드가 없습니다. 이 페이지는 쓰레드 앱 인증에만 씁니다.</p>
  <pre id="code" style="display:none;white-space:pre-wrap;word-break:break-all;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;font-size:.95rem"></pre>
  <p id="next" style="display:none;color:var(--muted)">이 값을 복사해서 아래를 실행하세요.<br><code>npm run thread:token code &lt;붙여넣기&gt;</code><br>코드는 몇 분이면 만료됩니다.</p>
</section>
<script>
(function(){
  var code = new URLSearchParams(location.search).get('code');
  if (!code) return;
  code = code.replace(/#_$/, '');
  document.getElementById('msg').textContent = '아래 코드를 복사하세요.';
  var box = document.getElementById('code');
  box.textContent = code;
  box.style.display = 'block';
  document.getElementById('next').style.display = 'block';
})();
</script>`,
}));

write("404.html", layout({ lang: "ko", title: "404", description: "페이지를 찾을 수 없습니다.", canonical: "/404.html", langAltHref: "/en/", active: "", noAlt: true, body: `<section class="hero"><h1>404</h1><p>이 링크는 아직 사슬에 없네요.</p><div class="cta"><a class="btn btn-primary" href="/">홈으로</a></div></section>` }));
write(".nojekyll", "");
// 커스텀 도메인은 site.json의 customDomain이 채워졌을 때만 생성.
// (DNS 연결 전에 CNAME이 있으면 github.io 접속이 깨질 수 있음)
if (site.customDomain) write("CNAME", site.customDomain + "\n");
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

/* IndexNow 소유확인 파일. 루트에 <키>.txt 가 있고 그 안에 같은 키가 들어 있어야
   검색엔진이 우리를 소유자로 인정합니다.

   키를 site.json 한 곳에만 둡니다. 파일 두 곳에 같은 값을 적어 두면 언젠가 한쪽만
   바뀝니다. 그때 조용히 403 이 나고, 색인 요청이 안 갔다는 것을 한참 뒤에 압니다. */
if (site.indexNowKey) write(`${site.indexNowKey}.txt`, site.indexNowKey + "\n");

/* ---------- 로컬 전용 콘텐츠 관리 페이지 ----------
   기본은 "만든다" 입니다. 배포 빌드일 때만 만들지 않고, 남아 있던 것도 지웁니다.

   반대로(배포가 기본, 로컬은 옵션) 두면 npm run build 처럼 평범한 로컬 빌드가
   관리 페이지를 지워버려서, 새로고침해도 안 보이는 일이 계속 생깁니다.
   배포 경로는 GitHub Actions 하나뿐이고 그쪽은 아래 두 조건에 모두 걸리므로,
   기본값을 로컬 쪽에 맞추는 편이 안전하면서 덜 헷갈립니다.
   sitemap·feed 에는 어느 경우에도 넣지 않습니다.
   (DEPLOY 자체는 layout() 이 먼저 읽어야 해서 파일 위쪽 스위치 구간에 선언돼 있습니다) */
const ADMIN = !DEPLOY;
const ADMIN_DIR = path.join(OUT, "admin");
if (ADMIN) {
  const { buildAdmin } = require("./admin");
  write("admin/index.html", buildAdmin({
    koAll,
    enAll,
    issuesBySlug: { ko: koSeo.bySlug, en: enSeo.bySlug },
    contentDir: CONTENT,
    builtAt: new Date().toLocaleString("ko-KR"),
    // 파일 열기 링크의 기본 프로토콜. 화면의 선택 상자로도 바꿀 수 있습니다.
    editor: process.env.CC_EDITOR || "cursor",
  }));
} else if (fs.existsSync(ADMIN_DIR)) {
  // 배포용 빌드에서는 이전에 만들어 둔 관리 페이지를 지웁니다(실수로 공개되는 경로를 아예 없앰)
  fs.rmSync(ADMIN_DIR, { recursive: true, force: true });
}

/* 글은 한국어판과 영문판을 한 쌍으로 냅니다. 한쪽만 있는 것은 작업이 덜 끝난 상태입니다.
   예전에는 [알림]으로 흘려보냈다가 영문판 누락을 몇 달 못 보고 지나친 적이 있어
   [경고]로 올렸습니다. 다른 SEO 경고와 같은 줄에 서야 눈에 들어옵니다.
   (짝이 없는 동안 그 글은 hreflang 없이 나가고, 배포 자체는 계속 됩니다) */
const solo = [
  ...koPosts.filter((p) => !enSlugs.has(p.slug)).map((p) => `ko/${p.slug}`),
  ...enPosts.filter((p) => !koSlugs.has(p.slug)).map((p) => `en/${p.slug}`),
];
if (solo.length) {
  console.warn(`  [경고] 짝 언어판이 없습니다. 아래 글은 hreflang 없이 나갑니다: ${solo.join(", ")}`);
  console.warn(`         한국어판은 content/posts-kr/, 영문판은 content/posts-en/ 에 같은 슬러그로 둡니다.\n`);
}

/* 측정 없이 배포되는 것을 막습니다. 조용히 빠지면 몇 주 뒤에 "그동안 아무 기록이 없다"를 알게 됩니다.
   그때는 이미 지나간 유입이라 되돌릴 방법이 없습니다. */
if (DEPLOY && !String(site.cfAnalyticsToken || "").trim()) {
  console.warn("  [경고] content/site.json 의 cfAnalyticsToken 이 비어 있어 방문 측정 스크립트를 넣지 않았습니다.");
  console.warn("         Cloudflare → Analytics → Web Analytics 에서 choworks.dev 를 추가하고 받은 토큰을 채우세요.\n");
}
if (DEPLOY && !String(site.naverAnalyticsId || "").trim()) {
  console.warn("  [경고] content/site.json 의 naverAnalyticsId 가 비어 있어 네이버 애널리틱스를 넣지 않았습니다.");
}

const draftCount = (koAll.length - koPosts.length) + (enAll.length - enPosts.length);
console.log(
  `Built ${koPosts.length} KO + ${enPosts.length} EN posts, ${urls.length} URLs, ${assetCount} asset file(s) copied.` +
  (draftCount ? ` (초안 ${draftCount}개 제외)` : "") +
  (ADMIN ? ` 관리 페이지: http://localhost:${process.env.PORT || 4000}/admin/` : " (배포 빌드: 관리 페이지 제외)")
);

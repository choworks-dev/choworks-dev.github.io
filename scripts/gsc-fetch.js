/* ============================================================
   검색 기록 가져오기

       npm run search              최근 90일치를 content/search.json 으로
       npm run search -- --days=28
       npm run search -- --no-index   색인 상태 조회는 건너뜁니다(빠릅니다)

   두 가지를 받아옵니다.

     1. 검색 실적   어떤 검색어에 몇 번 노출되고 몇 번 눌렸나
     2. 색인 상태   사이트맵의 주소가 하나씩 색인됐는지, 안 됐으면 왜인지

   2번이 중요합니다. 서치 콘솔 화면에서는 "색인 안 됨 8개" 라는 숫자만 보이고
   어느 주소인지 보려면 사유마다 눌러 들어가야 합니다. 여기서는 주소별로 한 줄씩 뽑습니다.

   ── 자격 증명 ──
   로컬은 .gcp-searchconsole.json (gitignore), 워크플로는 GCP_SA_KEY 환경변수에
   그 파일 내용을 통째로 넣습니다.

   서비스 계정을 만들었다고 끝이 아닙니다. 서치 콘솔의 사용자 및 권한에
   그 계정 이메일을 사람처럼 추가해야 합니다. API 로는 못 합니다. 웹에서만 됩니다.
   빠뜨리면 목록이 빈 채로 성공합니다. 오류가 안 나서 알아채기 어렵습니다.

   ── 속성 이름 ──
   sc-domain:choworks.dev 입니다. URL 접두어(https://choworks.dev/)로 등록한 것과
   형식이 다르고, 틀리면 404 가 납니다. 모르면 --sites 로 목록을 뽑으세요.

   ── 숫자를 볼 때 ──
   서치 콘솔은 이틀쯤 늦게 집계됩니다. 그래서 어제까지만 묻습니다.
   오늘을 넣으면 늘 0 이 나와서 떨어진 것처럼 보입니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "content", "search.json");
const KEY_FILE = path.join(ROOT, ".gcp-searchconsole.json");

const args = process.argv.slice(2);
const LIST_SITES = args.includes("--sites");
const NO_INDEX = args.includes("--no-index");
const DAYS = Number((args.find((a) => a.startsWith("--days=")) || "").split("=")[1]) || 90;

const SITE = "sc-domain:choworks.dev";
const SITEMAP = "https://choworks.dev/sitemap.xml";

function loadKey() {
  if (process.env.GCP_SA_KEY) return JSON.parse(process.env.GCP_SA_KEY);
  if (fs.existsSync(KEY_FILE)) return JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
  console.error("  [없음] 서비스 계정 키를 찾지 못했습니다.");
  console.error("  로컬이면 .gcp-searchconsole.json, 워크플로면 시크릿 GCP_SA_KEY 입니다.");
  process.exit(1);
}

/* 서비스 계정으로 액세스 토큰을 받습니다. 라이브러리 없이 JWT 를 직접 만듭니다.
   의존성을 하나 더 늘리는 것보다 스무 줄을 두는 편이 낫습니다. */
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  });
  const sig = crypto.sign("RSA-SHA256", Buffer.from(head + "." + body), key.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${body}.${sig}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("토큰을 못 받았습니다: " + JSON.stringify(j));
  return j.access_token;
}

const ymd = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

async function api(t, url, body) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

async function analytics(t, dims, rowLimit) {
  const j = await api(t, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    { startDate: ymd(DAYS), endDate: ymd(1), dimensions: dims, rowLimit: rowLimit || 25 });
  return (j.rows || []).map((r) => ({
    key: r.keys ? r.keys[0] : "",
    clicks: r.clicks, impressions: r.impressions,
    ctr: Math.round(r.ctr * 10000) / 100,
    position: Math.round(r.position * 10) / 10,
  }));
}

/* 사이트맵에서 주소를 읽습니다. 우리가 구글에 알려준 목록이 곧 검사 대상입니다. */
async function sitemapUrls() {
  const r = await fetch(SITEMAP);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/* 주소 하나의 색인 상태. 하루 2000건까지 되므로 스무 개는 여유롭습니다.
   한꺼번에 던지지 않고 몇 개씩 나눠 보냅니다. 분당 제한이 따로 있습니다. */
async function inspect(t, url) {
  try {
    const j = await api(t, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      { inspectionUrl: url, siteUrl: SITE, languageCode: "ko" });
    const x = (j.inspectionResult && j.inspectionResult.indexStatusResult) || {};
    return {
      url,
      verdict: x.verdict || "",               // PASS / NEUTRAL / FAIL
      state: x.coverageState || "",           // "Submitted and indexed" 등 사람이 읽는 사유
      lastCrawl: x.lastCrawlTime ? x.lastCrawlTime.slice(0, 10) : "",
      robots: x.robotsTxtState || "",
      canonical: x.googleCanonical || "",
    };
  } catch (e) {
    return { url, verdict: "", state: "조회 실패: " + e.message, lastCrawl: "", robots: "", canonical: "" };
  }
}

(async () => {
  const key = loadKey();
  const t = await accessToken(key);

  if (LIST_SITES) {
    const j = await api(t, "https://www.googleapis.com/webmasters/v3/sites");
    console.log("접근 가능한 속성:");
    (j.siteEntry || []).forEach((s) => console.log(`  ${s.siteUrl}   권한:${s.permissionLevel}`));
    if (!(j.siteEntry || []).length) {
      console.log("  (없습니다. 서치 콘솔 → 설정 → 사용자 및 권한에 서비스 계정을 추가했는지 보세요)");
      console.log(`  추가할 주소: ${key.client_email}`);
    }
    return;
  }

  const [totalRow] = await analytics(t, [], 1);
  const totals = totalRow
    ? { clicks: totalRow.clicks, impressions: totalRow.impressions, ctr: totalRow.ctr, position: totalRow.position }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  const [byQuery, byPage, byCountry, byDevice, byDate] = await Promise.all([
    analytics(t, ["query"], 30),
    analytics(t, ["page"], 30),
    analytics(t, ["country"], 15),
    analytics(t, ["device"], 5),
    analytics(t, ["date"], 200),
  ]);

  let index = [];
  if (!NO_INDEX) {
    const urls = await sitemapUrls();
    process.stdout.write(`  색인 상태 조회 ${urls.length}개 `);
    for (let i = 0; i < urls.length; i += 4) {
      index.push(...await Promise.all(urls.slice(i, i + 4).map((u) => inspect(t, u))));
      process.stdout.write(".");
    }
    console.log();
  }

  const out = {
    updated: new Date().toISOString(),
    source: "google-search-console",
    site: SITE,
    /* 화면에 그대로 띄웁니다. 서치 콘솔은 이틀쯤 늦게 집계되므로 어제까지만 묻습니다. */
    caveat: "서치 콘솔은 집계가 이틀쯤 늦습니다. 어제까지의 값입니다.",
    range: { from: ymd(DAYS), to: ymd(1), days: DAYS },
    totals,
    byDate: byDate.map((r) => ({ date: r.key, clicks: r.clicks, impressions: r.impressions })),
    byQuery, byPage, byCountry, byDevice,
    index,
    indexSummary: index.length
      ? {
          total: index.length,
          indexed: index.filter((x) => x.verdict === "PASS").length,
          notIndexed: index.filter((x) => x.verdict && x.verdict !== "PASS").length,
        }
      : null,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`${out.range.from} ~ ${out.range.to} (${DAYS}일)`);
  console.log(`  클릭 ${totals.clicks} · 노출 ${totals.impressions} · 평균순위 ${totals.position}`);
  if (out.indexSummary) console.log(`  색인 ${out.indexSummary.indexed}/${out.indexSummary.total}`);
  console.log(`  content/search.json 에 적었습니다. 관리 화면의 검색 탭에서 봅니다.`);
})().catch((e) => {
  console.error("  실패:", e.message);
  process.exit(1);
});

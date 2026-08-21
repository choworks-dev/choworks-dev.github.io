/* ============================================================
   방문 기록 가져오기

       npm run stats            최근 30일치를 content/stats.json 으로 떨굽니다
       npm run stats -- --days=90

   왜 남의 대시보드를 안 보고 이걸 만드는가.
   GitHub Pages 는 정적 호스팅이라 우리 쪽에 서버가 없습니다. 방문자가 왔다는 사실을
   받아 적을 곳이 없어서 수집은 바깥(Cloudflare 비컨)이 합니다. 그건 피할 수 없습니다.
   피할 수 있는 건 "보러 들어가는 것" 입니다. 여기서 긁어 파일로 떨구면
   관리 화면이 그 파일을 읽어 그립니다. 데이터도 우리 저장소에 남습니다.

   ── 자격 증명 ──
   로컬은 .env.analytics (gitignore), 워크플로는 환경변수로 받습니다.

       CF_API_TOKEN     Account Analytics: Read 권한만 있는 토큰
       CF_ACCOUNT_ID    도메인이 들어 있는 계정. dash URL 의 32자리
       CF_SITE_TAG      Web Analytics 사이트 식별자

   ── 여기서 한 번 걸렸던 것 ──
   CF_SITE_TAG 는 HTML 에 박히는 비컨 토큰(content/site.json 의 cfAnalyticsToken)과
   다른 값입니다. 비컨 토큰으로 물으면 오류가 아니라 그냥 0 이 돌아옵니다.
   그래서 데이터가 없는 건지 잘못 물은 건지 구별이 안 됩니다.
   2026-08-21 에 여기서 한참 헤맸습니다. 값을 못 찾으면 --discover 로 목록을 뽑으세요.

   ── 숫자를 그대로 믿지 마세요 ──
   무료 플랜은 표본을 뽑아 추정하므로 10 단위로 반올림돼 나옵니다.
   "방문 0 인데 조회 10" 같은 줄이 그 증거입니다. 절대 수치가 아니라 추세로 봅니다.
   그리고 우리(대표님과 저)의 방문을 걸러낼 방법이 없습니다. Web Analytics 는
   사람을 구별하지 않고 무료 플랜에는 IP 제외 기능도 없습니다. 그래서 걸러낸 척하지 않고
   "사이트 안에서 이동" 을 따로 보여줘서 눈으로 감안하게 둡니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "content", "stats.json");
const ENV = path.join(ROOT, ".env.analytics");

const args = process.argv.slice(2);
const DISCOVER = args.includes("--discover");
const DAYS = Number((args.find((a) => a.startsWith("--days=")) || "").split("=")[1]) || 30;

/* 로컬 파일이 있으면 그걸 쓰고, 없으면 환경변수를 씁니다(워크플로가 이 길로 옵니다). */
function creds() {
  const kv = {};
  if (fs.existsSync(ENV)) {
    fs.readFileSync(ENV, "utf8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
      if (m) kv[m[1]] = m[2].trim();
    });
  }
  for (const k of ["CF_API_TOKEN", "CF_ACCOUNT_ID", "CF_SITE_TAG"]) {
    if (!kv[k] && process.env[k]) kv[k] = String(process.env[k]).trim();
  }
  return kv;
}

const iso = (d) => d.toISOString().slice(0, 19) + "Z";

async function gql(token, query, variables) {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) {
    const msg = j.errors.map((e) => e.message).join(" / ");
    throw new Error(msg);
  }
  return j.data;
}

/* 사이트 식별자를 모를 때. 계정 안에서 기록이 있는 사이트를 전부 뽑습니다. */
async function discover(c) {
  const from = iso(new Date(Date.now() - 90 * 864e5));
  const to = iso(new Date());
  const d = await gql(c.CF_API_TOKEN, `query($a:String!,$from:Time!,$to:Time!){
    viewer{ accounts(filter:{accountTag:$a}){
      rumPageloadEventsAdaptiveGroups(limit:50, filter:{datetime_geq:$from,datetime_leq:$to}, orderBy:[count_DESC]){
        count dimensions{ siteTag } } } } }`, { a: c.CF_ACCOUNT_ID, from, to });
  const rows = d.viewer.accounts[0].rumPageloadEventsAdaptiveGroups;
  console.log("최근 90일 기록이 있는 사이트:");
  if (!rows.length) console.log("  (없습니다)");
  rows.forEach((x) => console.log(`  ${x.dimensions.siteTag}   조회 ${x.count}`));
  console.log("\n쓰실 값을 .env.analytics 의 CF_SITE_TAG= 에 넣으세요.");
}

const QUERY = `query($a:String!,$s:String!,$from:Time!,$to:Time!){
  viewer{ accounts(filter:{accountTag:$a}){
    byDay: rumPageloadEventsAdaptiveGroups(limit:400, filter:{siteTag:$s,datetime_geq:$from,datetime_leq:$to}, orderBy:[date_ASC]){
      count sum{ visits } dimensions{ date } }
    byPath: rumPageloadEventsAdaptiveGroups(limit:60, filter:{siteTag:$s,datetime_geq:$from,datetime_leq:$to}, orderBy:[count_DESC]){
      count dimensions{ requestPath } }
    byRef: rumPageloadEventsAdaptiveGroups(limit:30, filter:{siteTag:$s,datetime_geq:$from,datetime_leq:$to}, orderBy:[count_DESC]){
      count dimensions{ refererHost } }
    byCountry: rumPageloadEventsAdaptiveGroups(limit:20, filter:{siteTag:$s,datetime_geq:$from,datetime_leq:$to}, orderBy:[count_DESC]){
      count dimensions{ countryName } }
    byDevice: rumPageloadEventsAdaptiveGroups(limit:8, filter:{siteTag:$s,datetime_geq:$from,datetime_leq:$to}, orderBy:[count_DESC]){
      count dimensions{ deviceType } }
  }}
}`;

(async () => {
  const c = creds();
  const missing = ["CF_API_TOKEN", "CF_ACCOUNT_ID"].filter((k) => !c[k]);
  if (missing.length) {
    console.error(`  [없음] ${missing.join(", ")} 를 찾지 못했습니다.`);
    console.error("  로컬이면 .env.analytics 에, 워크플로면 저장소 시크릿에 넣으세요.");
    process.exit(1);
  }

  if (DISCOVER) return discover(c);

  if (!c.CF_SITE_TAG) {
    console.error("  [없음] CF_SITE_TAG 가 없습니다. content/site.json 의 비컨 토큰과 다른 값입니다.");
    console.error("  npm run stats -- --discover 로 목록을 뽑아 확인하세요.");
    process.exit(1);
  }

  const toD = new Date(), fromD = new Date(Date.now() - DAYS * 864e5);
  const d = await gql(c.CF_API_TOKEN, QUERY, {
    a: c.CF_ACCOUNT_ID, s: c.CF_SITE_TAG, from: iso(fromD), to: iso(toD),
  });
  const a = d.viewer.accounts[0];
  if (!a) {
    console.error("  계정에 붙었는데 결과가 비어 있습니다. CF_ACCOUNT_ID 를 확인하세요.");
    process.exit(1);
  }

  const byDay = a.byDay.map((x) => ({ date: x.dimensions.date, views: x.count, visits: (x.sum && x.sum.visits) || 0 }));
  const num = (rows, key, label) => rows.map((x) => ({ [label]: x.dimensions[key] || "", views: x.count }));

  const stats = {
    updated: new Date().toISOString(),
    source: "cloudflare-web-analytics",
    /* 화면에 그대로 띄웁니다. 나중에 이 숫자로 판단할 때 헷갈리지 않게. */
    caveat: "무료 플랜은 표본 추정이라 10 단위로 반올림됩니다. 우리 방문도 섞여 있습니다.",
    range: { from: fromD.toISOString().slice(0, 10), to: toD.toISOString().slice(0, 10), days: DAYS },
    totals: {
      views: byDay.reduce((s, x) => s + x.views, 0),
      visits: byDay.reduce((s, x) => s + x.visits, 0),
    },
    byDay,
    byPath: num(a.byPath, "requestPath", "path"),
    byReferrer: num(a.byRef, "refererHost", "host"),
    byCountry: num(a.byCountry, "countryName", "country"),
    byDevice: num(a.byDevice, "deviceType", "device"),
  };

  fs.writeFileSync(OUT, JSON.stringify(stats, null, 2) + "\n", "utf8");
  console.log(`${stats.range.from} ~ ${stats.range.to} (${DAYS}일)`);
  console.log(`  조회 ${stats.totals.views} · 방문 ${stats.totals.visits}`);
  console.log(`  content/stats.json 에 적었습니다. 관리 화면의 방문 탭에서 봅니다.`);
})().catch((e) => {
  console.error("  실패:", e.message);
  process.exit(1);
});

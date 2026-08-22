/* ============================================================
   IndexNow 로 새 글을 검색엔진에 알립니다.

       npm run indexnow                  글 주소 전부 (한/영)
       npm run indexnow -- --new 2       최근 2개만
       npm run indexnow -- <URL> ...     지정한 주소만
       npm run indexnow -- --all         글 말고 사이트맵의 모든 주소
       npm run indexnow -- --check       키 파일이 살아 있는지만 확인

   왜 이게 필요한가
     네이버는 색인 요청 API 를 따로 두지 않고 IndexNow 프로토콜을 받습니다.
     그래서 서치어드바이저에 들어가 "웹 페이지 수집" 을 손으로 넣을 필요가 없습니다.
     HTTP 요청 한 번이면 됩니다.

   ⚠ 구글은 IndexNow 에 참여하지 않습니다. 구글은 사이트맵으로 알아서 가져가고,
      급하면 npm run index 로 앞당깁니다. 그건 서치 콘솔 화면을 대신 눌러 주는 것입니다.

   소유확인
     루트의 <키>.txt 를 검색엔진이 읽어 소유자를 확인합니다.
     키는 content/site.json 의 indexNowKey 한 곳에만 있고, 빌드가 그 파일을 만듭니다.
     두 곳에 적어 두면 언젠가 한쪽만 바뀌고, 그때 조용히 403 이 납니다.

   주소는 배포된 사이트맵에서 읽습니다
     로컬 site/sitemap.xml 을 읽으면 아직 배포 안 된 주소를 알리게 됩니다.
     검색엔진이 와서 404 를 받으면 안 알린 것만 못합니다. 그래서 실제로 떠 있는 것만 봅니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site.json"), "utf8"));
const SITE = site.url.replace(/\/$/, "");
const HOST = SITE.replace(/^https?:\/\//, "");

// 네이버는 자체 엔드포인트. api.indexnow.org 는 Bing·Yandex·Seznam 으로 퍼뜨립니다.
const ENDPOINTS = [
  ["네이버", "https://searchadvisor.naver.com/indexnow"],
  ["IndexNow 공용", "https://api.indexnow.org/indexnow"],
];

const NOTE = {
  200: "접수", 202: "접수(확인 대기)", 400: "요청 형식 오류",
  403: "키 확인 실패", 422: "주소가 host 와 안 맞음", 429: "요청이 너무 잦음",
};

/* 배포된 사이트맵에서 주소를 최신순으로 뽑습니다. */
async function sitemapUrls(onlyPosts) {
  const r = await fetch(`${SITE}/sitemap.xml`);
  if (!r.ok) throw new Error(`사이트맵을 못 읽었습니다 (${r.status})`);
  const xml = await r.text();
  const rows = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const mod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || "";
    if (!loc) continue;
    if (onlyPosts && !/\/posts\//.test(loc)) continue;
    rows.push([mod, loc]);
  }
  rows.sort((a, b) => (b[0] + b[1]).localeCompare(a[0] + a[1]));
  return rows.map(([, u]) => u);
}

/* 키 파일이 배포돼 있어야 검색엔진이 소유자를 확인합니다.
   푸시 전에 돌리면 여기서 걸립니다. 조용히 실패하는 것보다 낫습니다. */
async function check(key) {
  const url = `${SITE}/${key}.txt`;
  try {
    const r = await fetch(url);
    const body = (await r.text()).trim();
    const ok = r.ok && body === key;
    console.log(`${ok ? "✓" : "✗"} ${url}  (${r.status})`);
    if (r.ok && !ok) console.log(`  내용이 키와 다릅니다: ${JSON.stringify(body.slice(0, 40))}`);
    return ok;
  } catch (e) {
    console.log(`✗ 키 파일을 확인할 수 없습니다. ${e.message}`);
    return false;
  }
}

async function submit(key, urls) {
  const body = JSON.stringify({ host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls });
  let bad = 0;
  for (const [name, ep] of ENDPOINTS) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });
      const ok = r.status === 200 || r.status === 202;
      console.log(`${ok ? "✓" : "✗"} ${name.padEnd(14)} ${r.status} ${NOTE[r.status] || ""}`);
      if (!ok) {
        bad++;
        const t = (await r.text()).trim();
        if (t) console.log(`    ${t.slice(0, 200)}`);
      }
    } catch (e) {
      bad++;
      console.log(`✗ ${name.padEnd(14)} 실패. ${e.message}`);
    }
  }
  return bad;
}

(async () => {
  const args = process.argv.slice(2);
  const key = site.indexNowKey;
  if (!key) {
    console.error("content/site.json 에 indexNowKey 가 없습니다.");
    process.exitCode = 1;
    return;
  }
  console.log(`키  ${key}`);
  if (!(await check(key))) {
    console.log("\n키 파일이 배포되지 않았습니다. 커밋·푸시하고 다시 돌리세요.");
    process.exitCode = 1;
    return;
  }
  if (args.includes("--check")) return;

  let urls = args.filter((a) => a.startsWith("http"));
  if (!urls.length) urls = await sitemapUrls(!args.includes("--all"));
  const n = args.indexOf("--new");
  if (n !== -1) urls = urls.slice(0, Number(args[n + 1]) || 1);
  if (!urls.length) {
    console.error("알릴 주소가 없습니다.");
    process.exitCode = 1;
    return;
  }

  console.log(`\n${urls.length}개 주소를 알립니다.`);
  urls.forEach((u) => console.log(`  ${u}`));
  console.log();
  const bad = await submit(key, urls);
  console.log("\n접수는 색인이 아닙니다. 대기열에 들어가는 것이고 며칠 걸립니다.");
  if (bad) process.exitCode = 1;
})();

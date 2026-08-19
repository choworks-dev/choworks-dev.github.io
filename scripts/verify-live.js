/* ============================================================
   올라갔는지 확인하기

   자동화에서 제일 위험한 것은 빨간불이 아니라 초록불입니다.
   2026-08-18 에 예약 발행이 정각에 정확히 돌았고 로그에 "2개를 공개했습니다" 까지 찍혔지만,
   글은 사이트에 없었습니다. 잡은 성공으로 끝났고 실패 알림도 안 울렸습니다.
   워크플로가 "실행됐는가" 만 보기 때문입니다. 이 스크립트는 "떴는가" 를 봅니다.

   확인하는 곳은 액션 로그가 아니라 진짜 주소입니다. 중간 단계가 몇 개든 상관없이
   독자가 보는 것과 같은 것을 봅니다. 그래서 아직 모르는 종류의 고장도 여기서 걸립니다.

     node scripts/verify-live.js --wait=slug1,slug2   배포를 기다렸다가 확인하고 결과를 알림
     node scripts/verify-live.js                      전체 점검. 문제가 있을 때만 알림

   앞의 것은 예약 발행 워크플로가 부릅니다. 성공해도 알립니다.
   폰이 조용한 것 자체가 신호가 되어야 하기 때문입니다. 문제가 있을 때만 오는 알림은,
   알림이 고장난 것과 아무 일도 없는 것을 구별해 주지 못합니다.

   뒤의 것은 하루 한 번 도는 점검입니다. 예약 워크플로가 통째로 안 돈 경우는
   위의 확인이 아예 안 불리므로, 밖에서 한 번 더 봐야 잡힙니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const fm = require("front-matter");
const { slugOf } = require("./posts");
const { tgSend } = require("./notify");

const ROOT = path.join(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site.json"), "utf8"));
const BASE = String(site.url || "").replace(/\/+$/, "");

const LANGS = [
  { dir: "posts-kr", prefix: "/posts/", label: "한국어" },
  { dir: "posts-en", prefix: "/en/posts/", label: "영문" },
];

/* 기다리는 총 시간과 물어보는 간격. 배포는 보통 1~2분이면 끝납니다.
   넉넉히 잡는 이유는, 늦게 뜨는 것과 영영 안 뜨는 것을 헷갈리지 않기 위해서입니다. */
const WAIT_MIN = 15;
const POLL_SEC = 20;

const kstStamp = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* publish-due.js 와 같은 규칙으로 읽습니다. 시각은 한국 시각입니다. */
function parseKst(v) {
  const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh, mi] = m;
  return Date.parse(`${y}-${mo}-${d}T${hh || "09"}:${mi || "00"}:00+09:00`);
}

function scan() {
  const out = [];
  LANGS.forEach((lang) => {
    const dir = path.join(ROOT, "content", lang.dir);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .forEach((f) => {
        const a = fm(fs.readFileSync(path.join(dir, f), "utf8")).attributes || {};
        const slug = slugOf(f);
        out.push({
          slug,
          file: f,
          lang: lang.label,
          url: `${BASE}${lang.prefix}${slug}/`,
          title: a.title || slug,
          draft: a.draft === true,
          publishAt: a.publishAt ? parseKst(a.publishAt) : null,
        });
      });
  });
  return out;
}

/* 캐시된 응답을 받으면 확인하는 뜻이 없어집니다. 지운 글이 한참 200 으로 보이거나,
   방금 올린 글이 404 로 보입니다. 그래서 캐시를 쓰지 말라고 붙여서 물어봅니다. */
async function status(url) {
  try {
    const r = await fetch(url, {
      cache: "no-store",
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
      signal: AbortSignal.timeout(20000),
    });
    return r.status;
  } catch (e) {
    return `오류(${e.message})`;
  }
}

/* 알림이 안 갔다고 확인 자체를 실패로 만들지는 않습니다.
   보낼 곳이 설정되지 않은 로컬에서도 그냥 돌아야 합니다. */
async function tell(text) {
  console.log(`\n${text}\n`);
  try {
    await tgSend(text);
    console.log("알림을 보냈습니다.");
    return true;
  } catch (e) {
    console.warn(`알림 실패: ${e.message}`);
    return false;
  }
}

/* 워크플로가 뒤에서 판단할 수 있게 남깁니다. 알림을 이미 보냈으면
   워크플로가 실패 알림을 또 보내지 않습니다. 같은 일로 두 번 울리면 다음부터 안 보게 됩니다. */
function output(key, val) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) fs.appendFileSync(f, `${key}=${val}\n`);
}

/* [1] 방금 공개한 글이 사이트에 뜰 때까지 기다립니다. */
async function waitFor(slugs) {
  const targets = scan().filter((p) => slugs.includes(p.slug) && !p.draft);
  if (!targets.length) {
    console.log(`확인할 글이 없습니다 (${slugs.join(", ")}).`);
    return true;
  }
  targets.forEach((t) => console.log(`  확인 대상 ${t.lang} ${t.url}`));

  const deadline = Date.now() + WAIT_MIN * 60000;
  let left = targets.slice();
  const seen = new Map();

  while (left.length && Date.now() < deadline) {
    const results = await Promise.all(left.map((t) => status(t.url)));
    const still = [];
    left.forEach((t, i) => {
      seen.set(t.url, results[i]);
      if (results[i] === 200) console.log(`  떴습니다 ${t.url}`);
      else still.push(t);
    });
    left = still;
    if (left.length && Date.now() + POLL_SEC * 1000 < deadline) await sleep(POLL_SEC * 1000);
    else break;
  }

  const title = targets[0].title;
  if (!left.length) {
    await tell([`발행 확인: 사이트에 올라왔습니다`, ``, title, ...targets.map((t) => t.url)].join("\n"));
    output("notified", "1");
    return true;
  }

  await tell(
    [
      `발행 확인 실패: ${WAIT_MIN}분을 기다렸는데 아직 사이트에 없습니다`,
      ``,
      title,
      ...left.map((t) => `${t.lang} ${seen.get(t.url)} ${t.url}`),
      ``,
      `글은 공개 처리됐는데 배포가 안 됐을 가능성이 큽니다.`,
      `Actions 에서 Build & Deploy blog 를 손으로 한 번 돌려 보세요.`,
    ].join("\n")
  );
  output("notified", "1");
  return false;
}

/* [2] 전체 점검. 예약 워크플로가 통째로 안 돈 경우까지 밖에서 봅니다. */
async function audit() {
  const all = scan();
  const now = Date.now();
  const problems = [];

  /* 공개해 둔 글인데 사이트에 없는 것. 배포가 빠졌거나 빌드가 이 글을 떨어뜨린 것입니다. */
  const live = all.filter((p) => !p.draft);
  const codes = await Promise.all(live.map((p) => status(p.url)));
  live.forEach((p, i) => console.log(`  ${codes[i]} ${p.url}`));

  /* 한 번 더 물어봅니다. 마침 배포가 도는 중이거나 한 번 튄 응답까지 고장으로 세면
     멀쩡한 날에도 알림이 옵니다. 그런 알림은 몇 번 받고 나면 안 보게 됩니다. */
  const bad = live.filter((p, i) => codes[i] !== 200);
  if (bad.length) {
    console.log(`  ${bad.length}건이 200 이 아닙니다. 1분 뒤에 한 번 더 봅니다.`);
    await sleep(60000);
    const again = await Promise.all(bad.map((p) => status(p.url)));
    bad.forEach((p, i) => {
      console.log(`  다시 ${again[i]} ${p.url}`);
      if (again[i] !== 200) problems.push(`사이트에 없음 (${again[i]}) ${p.lang} ${p.url}`);
    });
  }

  /* 예약 시각이 지났는데 아직 초안인 글. 예약 발행이 안 돈 것입니다.
     한 시간의 여유를 둡니다. 회차가 늦게 도는 것까지 고장으로 세면 알림을 믿지 않게 됩니다. */
  all
    .filter((p) => p.draft && p.publishAt && p.publishAt < now - 3600 * 1000)
    .forEach((p) => {
      console.log(`  [지남] ${p.file} 예약 ${kstStamp(p.publishAt)}`);
      problems.push(`예약 시각이 지났는데 아직 초안 (${kstStamp(p.publishAt)}) ${p.lang} ${p.file}`);
    });

  if (!problems.length) {
    console.log(`\n글 ${live.length}편 모두 정상입니다. 늦은 예약도 없습니다.`);
    return true;
  }
  await tell([`사이트 점검에서 ${problems.length}건이 걸렸습니다`, ``, ...problems].join("\n"));
  output("notified", "1");
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const wait = args.find((a) => a.startsWith("--wait="));
  console.log(`지금 ${kstStamp(Date.now())} (한국 시각) · ${BASE}`);

  const ok = wait
    ? await waitFor(
        wait
          .slice("--wait=".length)
          .split(/[,\s]+/)
          .filter(Boolean)
      )
    : await audit();

  /* 문제가 있으면 액션도 빨간불이 되게 둡니다. 알림은 이미 보냈지만,
     나중에 실행 목록을 훑을 때 초록불만 늘어서 있으면 그날 무슨 일이 있었는지 안 보입니다. */
  if (!ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error("확인 실패:", e.message);
    process.exitCode = 1;
  });
}

module.exports = { scan, status, waitFor, audit };

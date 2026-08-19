/* ============================================================
   예약 발행

   글에 publishAt 을 적어두면 그 시각에 자동으로 공개됩니다.

       ---
       title: ...
       date: 2026-08-18 17:00:00 +09:00
       draft: true
       publishAt: 2026-08-18 17:00
       ---

   이 스크립트가 하는 일은 하나입니다. 시각이 되면 `draft: true` 와 `publishAt` 줄을 지웁니다.
   그러면 워크플로가 그걸 커밋·푸시하고, 푸시가 배포를 깨웁니다.

   빌드는 draft 만 보고 날짜는 안 봅니다. 미래 날짜로 적어둔 글도 그냥 공개됩니다.
   그래서 "날짜를 미래로 적어두면 그때 나가겠지" 는 틀립니다. 지우는 사람이 있어야 합니다.

   publishAt 은 date 와 따로 둡니다. 겹쳐 보이지만 뜻이 다릅니다.
     date       글에 찍히는 날짜. 목록 순서를 정합니다.
     publishAt  공개할 시각. 이 줄이 있어야만 자동으로 공개됩니다.
   date 만 보고 공개하면, 그냥 쟁여둔 초안이 날짜가 지났다는 이유로 나가버립니다.

   시각은 전부 한국 시각입니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const fm = require("front-matter");

const ROOT = path.join(__dirname, "..");
const DIRS = [path.join(ROOT, "content", "posts-kr"), path.join(ROOT, "content", "posts-en")];

/* 회차가 예약 시각보다 이만큼 앞이면 이 회차가 맡아서 기다립니다.
   깃허브 예약 실행이 10분마다 돌지 않기 때문입니다(하루치를 세어보니 평균 80분, 최대 214분).
   창이 좁으면 아무 회차도 못 맡아서 한참 뒤에야 공개됩니다.
   워크플로의 timeout-minutes 를 이 값보다 넉넉하게 잡아야 합니다. */
const LEAD_MIN = 120;

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstStamp = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");

/* "2026-08-18 17:00" 을 진짜 시각으로. 시각을 안 적었으면 그날 09:00 으로 봅니다.
   자정으로 보면 날짜만 적은 글이 새벽에 나가는데, 그때 나가는 글은 아무도 안 봅니다. */
function parseKst(v) {
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh, mi] = m;
  return Date.parse(`${y}-${mo}-${d}T${hh || "09"}:${mi || "00"}:00+09:00`);
}

/* draft 와 publishAt 줄만 지웁니다. 나머지는 글자 하나 안 건드립니다.
   front-matter 로 읽어서 다시 쓰면 따옴표와 줄 순서가 통째로 바뀌어, 사람이 쓴 원본이 사라집니다. */
function strip(raw) {
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const end = lines.indexOf("---", 1); // 두 번째 --- 가 머리말의 끝
  if (end < 1) return null;
  const head = lines
    .slice(0, end)
    .filter((l) => !/^\s*draft\s*:/i.test(l) && !/^\s*publishAt\s*:/i.test(l));
  return [...head, ...lines.slice(end)].join(nl);
}

function due() {
  const out = [];
  DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .forEach((f) => {
        const p = path.join(dir, f);
        const a = fm(fs.readFileSync(p, "utf8")).attributes || {};
        if (!a.publishAt) return;
        /* draft 가 아닌 글은 이미 공개된 것입니다. publishAt 이 남아 있어도 할 일이 없습니다.
           (한쪽 언어만 먼저 공개된 상태로 회차가 끊겼을 때 여기로 옵니다) */
        if (a.draft !== true) return;
        const at = parseKst(a.publishAt);
        if (!at) {
          console.warn(`[건너뜀] ${f} : publishAt 을 못 읽었습니다 (${a.publishAt})`);
          return;
        }
        out.push({ file: f, path: p, at });
      });
  });
  return out.sort((x, y) => x.at - y.at);
}

async function main() {
  const now = Date.now();
  console.log(`지금 ${kstStamp(now)} (한국 시각)`);

  const list = due();
  if (!list.length) {
    console.log("예약된 글이 없습니다.");
    return;
  }
  list.forEach((x) => console.log(`  ${x.file} → ${kstStamp(x.at)}`));

  const first = list[0].at;
  const offMin = (first - now) / 60000;
  if (offMin > LEAD_MIN) {
    console.log(`가장 이른 예약까지 ${Math.round(offMin)}분 남았습니다. 이번 회차는 그냥 지나갑니다.`);
    return;
  }

  /* 예약 시각까지 여기서 기다립니다. 회차가 도는 시각에 바로 공개하면
     17:00 이라고 적어둔 글이 18:20 에 나갑니다. 시각을 적어둔 뜻이 사라집니다. */
  const waitMs = Math.max(0, first - now);
  if (waitMs > 0) console.log(`${Math.round(waitMs / 1000)}초 기다렸다가 공개합니다.`);
  await new Promise((r) => setTimeout(r, waitMs));

  /* 기다리는 사이에 같은 시각의 다른 글도 때가 됐을 수 있으니 다시 봅니다.
     한/영 짝은 같은 시각이라 여기서 같이 걸립니다. 한쪽만 나가면 그 글은 짝 없이 발행됩니다. */
  let n = 0;
  const slugs = new Set();
  due()
    .filter((x) => x.at <= Date.now())
    .forEach((x) => {
      const out = strip(fs.readFileSync(x.path, "utf8"));
      if (!out) {
        console.warn(`[건너뜀] ${x.file} : 머리말을 못 찾았습니다.`);
        return;
      }
      fs.writeFileSync(x.path, out);
      console.log(`공개: ${x.file}`);
      slugs.add(x.file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""));
      n += 1;
    });
  console.log(n ? `${n}개를 공개했습니다.` : "공개할 글이 없었습니다.");

  /* 어느 글을 공개했는지 워크플로에 넘깁니다.
     뒤에서 이 주소들이 실제로 뜨는지 확인해야 하는데, 로그를 긁어 알아내게 두면
     로그 문구를 고치는 날 조용히 끊깁니다. */
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `published=${[...slugs].join(",")}\n`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("실패:", e.message);
    process.exitCode = 1;
  });
}

module.exports = { parseKst, strip, due };

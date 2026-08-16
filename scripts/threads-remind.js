/* ============================================================
   쓰레드 발행 알림

   content/threads/ 의 큐를 보고, 나갈 시각이 되면 그 편의 원고를 텔레그램으로 보냅니다.
   올리는 것은 사람이 합니다. 복사해서 쓰레드 앱에 붙여넣습니다.

   왜 자동으로 안 올리는가
     API 로 자동 발행하는 계정이 정지되는 사례가 계속 나옵니다. 첫 계정(@kadecho.dev)도
     개설 다음 날 정지됐습니다. 정지되면 글 몇 편이 아니라 계정과 팔로워가 통째로 날아갑니다.
     올리는 일은 몇 초면 끝나는데, 계정 하나는 다시 만들 수 없습니다.
     그래서 자동화가 맡는 부분을 "언제 무엇을 올릴지 알려주는 것"까지로 줄였습니다.
     쓰레드 API 로 발행하는 코드는 지웠습니다. 남겨두면 언젠가 다시 켜집니다.

   실행
     npm run thread:remind     이 PC 에서는 무엇을 보낼지만 보여줍니다
                               (텔레그램 값이 없으면 보내지 않고, 보낸 표시도 남기지 않습니다)
     깃허브 액션이 10분마다 이것을 부릅니다.

   예약 시각을 지키는 방법
     깃허브의 예약 실행은 시각을 지켜주지 않습니다. 몇 분에서 몇십 분씩 밀려서 시작합니다.
     그래서 회차가 도는 시각에 보내지 않고, 예약 시각보다 일찍 잡힌 회차가 그 편을 맡아
     남은 시간을 이 안에서 자면서 기다렸다가 정확히 그 시각에 보냅니다.

   올렸다는 확인
     알림에 아무 답장이나 보내면 다음 회차가 그걸 읽고 발행 표시를 남깁니다.
     그 메시지에 대고 reply 로 답하면 어느 편인지 정확히 잡습니다(밀린 편이 둘 이상일 때 중요).
     알림을 보낸 것(~)과 실제로 올린 것(@)은 다른 표시입니다. 알림만 보고 발행됨으로 적으면
     놓친 편이 올라간 것으로 기록되어 조용히 사라집니다.
     답장이 안 먹혔으면 이 PC 에서:  npm run thread -- --posted=AA03

   안전장치
     · 한 번 실행에 한 편만 알립니다.
     · 하루 상한을 넘기면 알리지 않습니다.
     · status 가 ready 인 편만 알립니다. draft 는 건드리지 않습니다.
     · 언제나 큐에서 가장 이른 편부터 알립니다. 건너뛰지 않습니다.
     · 지난 날짜의 편은 알리지 않고 멈춥니다. 며칠 밀린 큐를 그대로 쏟아내면
       하루에 여러 편이 몰려 나가고, 그게 계정이 정지되는 모양입니다.
   ============================================================ */
const path = require("path");
const T = require("./threads");
const N = require("./notify");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "content", "threads");

// 텔레그램 값이 있어야 실제로 보냅니다. 없으면 무엇을 보낼지 찍고 끝냅니다.
const LIVE = Boolean(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);

const DAILY_CAP = 3;  // 하루에 알릴 수 있는 최대 편수

/* LEAD_MIN  이만큼 앞이면 이 회차가 그 편을 맡아 예약 시각까지 기다립니다.
   깃허브 예약 실행이 밀리는 폭을 덮을 만큼 넉넉해야 합니다.
   짧으면 아무 회차도 못 맡아서 예약 시각을 지나친 뒤에야 알림이 갑니다. */
const LEAD_MIN = 25;

/* 시각 다루기.
   깃허브 액션은 UTC 로 돌고 우리 예약 시각은 한국 시각이라, 둘을 섞으면 아홉 시간이 어긋납니다.
   비교는 항상 진짜 시각(epoch)으로 하고, 한국 시각은 화면에 찍거나 "오늘"을 가를 때만 씁니다. */
const KST = 9 * 60 * 60 * 1000;
const kstStamp = (ms) => new Date(ms + KST).toISOString().slice(0, 16); // 2026-08-16T20:50
const kstDate = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
const scheduledAt = (p) => new Date(`${p.date}T${p.time}:00+09:00`).getTime();
const stampAt = (s) => new Date(`${s}:00+09:00`).getTime(); // ~ · @ 표시를 진짜 시각으로

/* 답장을 읽어 발행 표시를 남깁니다.
   답장 하나가 편 하나를 확인합니다. 어느 편인지는 이 순서로 찾습니다.

     1. 답장 본문에 적은 번호(AA03). 적었는데 확인 대기에 없으면 그 답장은 버립니다.
        "AA03 올렸음" 을 엉뚱한 편의 확인으로 쓰는 것보다, 아무 일도 안 일어나는 쪽이 낫습니다.
     2. 답장이 달린 원래 메시지. 안내문 통이면 거기 번호가 있고, 원고 통이면 원고가 그대로 있어
        어느 편인지 그대로 나옵니다. 폰에서 그 메시지에 대고 답장하면 여기서 걸립니다.
     3. 아무 통에나 그냥 보낸 답장이면 확인 대기 중 가장 오래된 편.

   ID 로 찾는 자리를 2번에서 느슨하게 두는 이유는, 원고 본문에 우연히 "AB12" 꼴이 있을 수
   있기 때문입니다. 확인 대기 목록에 있는 번호일 때만 씁니다.

   반드시 알림을 보낸 시각보다 뒤에 온 답장만 봅니다.
   텔레그램은 읽지 않은 답장을 24시간 동안 계속 돌려주기 때문에, 이 조건이 없으면
   어제 보낸 "ㅇ" 하나가 오늘 알림까지 올린 것으로 만듭니다. */
const ID_IN = /\b[A-Za-z]{2}\d{2}\b/g;
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

function matchConfirms(pending, msgs) {
  const left = [...pending].sort((a, b) => stampAt(a.remindedAt) - stampAt(b.remindedAt));
  const hits = [];
  msgs.forEach((m) => {
    // 안 올렸다는 답장은 확인으로 치지 않습니다. 그 편은 확인 대기로 그대로 둡니다.
    if (/취소|안\s*올|나중|\bskip\b|\bno\b/i.test(m.text)) return;
    const fresh = (p) => m.at >= stampAt(p.remindedAt); // 알림보다 뒤에 온 답장만
    const quoted = norm(m.replyText);

    const said = (m.text.match(ID_IN) || [])[0]; // 1. 답장에 직접 적은 번호
    let i = said ? left.findIndex((p) => p.id === said.toUpperCase() && fresh(p)) : -1;
    if (said && i < 0) return;

    if (i < 0 && quoted) { // 2. 답장이 달린 원래 메시지에서
      const ids = (quoted.match(ID_IN) || []).map((s) => s.toUpperCase());
      i = left.findIndex((p) => ids.includes(p.id) && fresh(p));
      /* 원고 통에 대고 답장한 경우. 그 통에는 번호가 없고 원고만 있으므로 원고로 찾습니다.
         기다리는 사이에 원고를 고쳤을 수 있어 앞부분만 봅니다. */
      if (i < 0) {
        i = left.findIndex((p) => fresh(p) && p.parts.some((x) => {
          const a = norm(x.text);
          return a && (a === quoted || a.slice(0, 30) === quoted.slice(0, 30));
        }));
      }
    }

    if (i < 0 && !quoted) i = left.findIndex(fresh); // 3. 그냥 보낸 답장
    if (i < 0) return;

    const [p] = left.splice(i, 1);
    hits.push({ id: p.id, at: m.at, text: m.text });
  });
  return { hits, left };
}

async function confirmPosted(queue) {
  const pending = queue.filter((p) => p.status !== "posted" && p.remindedAt && p.id);
  if (!pending.length) return 0;

  let msgs = [];
  try {
    msgs = await N.tgUpdates();
  } catch (e) {
    // 확인을 못 받는 것은 알림을 못 보내는 것보다 가볍습니다. 여기서 회차를 죽이지 않습니다.
    console.warn(`답장을 읽지 못했습니다: ${e.message}`);
    return 0;
  }

  const { hits, left } = matchConfirms(pending, msgs);
  hits.forEach((h) => {
    const when = kstStamp(h.at);
    T.markPosted(DIR, h.id, when);
    console.log(`올렸다고 확인했습니다: ${h.id} (${when.replace("T", " ")}) · 답장 "${h.text.slice(0, 20)}"`);
  });
  if (left.length) {
    console.log(`아직 확인 안 된 편 ${left.length}개: ${left.map((p) => p.id).join(", ")}`);
  }
  return hits.length;
}

/* 기다리는 동안 관리 화면에서 원고를 고쳤을 수 있습니다.
   깃허브 액션은 회차가 시작할 때 받아온 파일을 그대로 들고 있어서, 그대로 보내면 옛 글이 갑니다.
   보내기 직전에 한 번 더 받아와 지금 원고를 씁니다.
   받아오는 데 실패하면 들고 있던 원고로 보냅니다. 안 보내는 것보다는 낫습니다. */
function refresh(post, parts) {
  if (process.env.GITHUB_ACTIONS !== "true") return parts; // 이 PC 에서는 작업 중인 파일을 건드리지 않습니다
  const r = require("child_process").spawnSync("git", ["pull", "--rebase", "origin", "main"], {
    cwd: ROOT, encoding: "utf8", timeout: 60000,
  });
  if (r.status !== 0) {
    console.warn("\n받아오지 못했습니다. 회차가 시작할 때의 원고로 보냅니다.");
    console.warn(((r.stderr || "") + (r.stdout || "")).trim());
    return parts;
  }
  const cur = T.queueOf(T.loadThreads(DIR)).find((p) => p.id === post.id);
  if (!cur) throw new Error(`${post.id} 이 큐에서 사라졌습니다. 알리지 않습니다.`);
  if (cur.status !== "ready") throw new Error(`${post.id} 이 ${T.STATUS[cur.status]} 으로 바뀌었습니다. 알리지 않습니다.`);
  if (cur.remindedAt) throw new Error(`${post.id} 은 이미 알림이 나갔습니다(${cur.remindedAt}). 두 번 보내지 않습니다.`);
  const fresh = cur.parts.map((x) => x.text);
  if (fresh.join("\n\n") !== parts.join("\n\n")) {
    console.log("\n기다리는 사이에 원고가 바뀌었습니다. 고친 글로 보냅니다.");
  }
  return fresh;
}

/* 알림 한 통과, 원고를 조각마다 한 통씩.

   원고를 안내문과 한 통에 섞지 않습니다. 폰에서 메시지를 복사하면 그 통의 글이 통째로 담겨서,
   섞어 두면 "지금 올릴 차례입니다" 까지 쓰레드에 붙습니다.
   그래서 원고가 든 통에는 원고만 있습니다. 길게 눌러 복사 → 쓰레드에 붙여넣기로 끝납니다. */
async function send(post, parts, lateMin) {
  const many = parts.length > 1;
  const late = lateMin < 1 ? null
    : lateMin < 120 ? `예약 시각이 ${Math.round(lateMin)}분 지났습니다.`
      : `예약 시각이 ${Math.round(lateMin / 60)}시간 지났습니다. 지금 올려도 되는 시간인지 보세요.`;
  const head = [
    `지금 올릴 차례입니다.  ${post.id}`,
    `예약 ${post.at} · ${T.KIND[post.kind]} · ${post.len}자${many ? ` · 본문 + 답글 ${parts.length - 1}개` : ""}`,
    late,
    "",
    many
      ? `아래 ${parts.length}개 메시지를 순서대로 복사해 올리세요. 첫 통이 본문, 나머지가 답글입니다.`
      : "아래 메시지를 복사해서 쓰레드에 올리세요.",
    `올린 뒤 이 메시지에 reply 로 아무 말이나 보내면 ${post.id} 에 발행 표시를 남깁니다.`,
  ].filter((l) => l !== null).join("\n");

  if (!LIVE) {
    console.log("\n텔레그램 값이 없어 보내지 않습니다. 실제로는 이렇게 갑니다.");
    console.log("-".repeat(60));
    console.log(head);
    parts.forEach((t) => console.log(`${"-".repeat(60)}\n${t}`));
    console.log("-".repeat(60));
    console.log("\nTELEGRAM_TOKEN 과 TELEGRAM_CHAT_ID 를 넣으면 실제로 갑니다 (npm run notify).");
    return false;
  }

  await N.tgSend(head);
  for (const text of parts) await N.tgSend(text); // eslint-disable-line no-await-in-loop
  return true;
}

async function main() {
  const now = Date.now();
  console.log(`지금 ${kstStamp(now)} (한국 시각)`);

  /* 확인부터 받습니다. 알릴 편이 없는 회차에도 답장은 처리되어야 하고,
     여기서 표시가 남아야 아래에서 세는 그날 편수가 맞습니다. */
  await confirmPosted(T.queueOf(T.loadThreads(DIR)));

  const queue = T.queueOf(T.loadThreads(DIR)); // 표시를 남겼으니 다시 읽습니다
  /* 언제나 큐에서 가장 이른, 아직 알림이 안 나간 편 하나만 봅니다.
     "시각이 된 편들" 중에서 고르지 않는 이유는, 그러면 앞 편을 건너뛸 길이 생기기 때문입니다.
     순서가 뒤집히면 앞 편을 가리키며 쓴 문장이 뒤로 갑니다. */
  const post = queue.find((p) => p.status === "ready" && p.date && p.time && !p.remindedAt);
  if (!post) {
    console.log("알릴 편이 남지 않았습니다.");
    return;
  }

  const at = scheduledAt(post);
  const offMin = (at - now) / 60000; // 양수면 아직 남은 것, 음수면 이미 지난 것
  console.log(`큐 ${queue.length}편 · 다음 편 ${post.id} ${post.at} (${T.KIND[post.kind]})`);

  if (offMin > LEAD_MIN) {
    console.log(`예약 시각까지 ${Math.round(offMin)}분 남았습니다. 이번 회차는 그냥 지나갑니다.`);
    return;
  }

  /* 지난 날짜는 알리지 않고 멈춥니다.
     오늘 안에서 늦은 것은 그냥 보냅니다. 사람이 보고 올릴지 말지 정하면 되니까요.
     하지만 며칠 밀린 큐를 그대로 흘리면 밀린 편들이 하루에 몰려 나갑니다.
     계정을 잃은 이유가 편수가 아니라 몰아치는 활동량이었으므로, 여기서는 멈추는 편이 맞습니다. */
  if (post.date < kstDate(now)) {
    console.warn(`\n멈춥니다. ${post.id} (${post.at}) 은 지난 날짜입니다.`);
    console.warn("밀린 큐를 그대로 흘리면 하루에 여러 편이 몰려 나갑니다.");
    console.warn(`날짜를 다시 짜세요:  npm run thread -- --replan=${kstDate(now)}`);
    return;
  }

  /* 그날 상한. 알림이 나간 것과 올라간 것을 같이 셉니다. 둘 다 그날 나간 편이라서요.
     지금 날짜가 아니라 이 편의 예약 날짜로 세는 이유는, 자정 직전에 다음 날 편을 기다리는 경우에도
     상한이 그 편이 나갈 날 기준으로 맞아야 하기 때문입니다. */
  const dayOf = (p) => (p.remindedAt || p.postedAt || "").slice(0, 10) || p.date;
  const sameDay = queue.filter((p) => (p.status === "posted" || p.remindedAt) && dayOf(p) === post.date).length;
  console.log(`${post.date} 에 나간 것 ${sameDay}/${DAILY_CAP}편`);
  if (sameDay >= DAILY_CAP) {
    console.log(`그날 상한(${DAILY_CAP}편)을 채웠습니다. 알리지 않습니다.`);
    return;
  }

  if (post.len > T.LIMIT) {
    console.error(`${post.id} 이 ${post.len}자입니다. 상한 ${T.LIMIT}자를 넘어 알리지 않습니다.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n대상: ${post.id}  ${post.at}  ${T.KIND[post.kind]}  ${post.len}자  (${post.file})`);

  /* 예약 시각까지 이 안에서 기다립니다.
     회차가 도는 시각에 맞춰 보내면 화면에 적힌 08:58 이 실제로는 09:11 에 옵니다.
     시각을 흩어 놓은 이유가 사람이 올리는 것처럼 보이려는 것인데, 매번 밀리면 그 의도가 사라집니다. */
  const waitMs = Math.max(0, at - Date.now());
  if (waitMs > 0) console.log(`${Math.round(waitMs / 1000)}초 기다렸다가 ${post.time} 에 보냅니다.`);

  await new Promise((r) => setTimeout(r, waitMs));

  const parts = refresh(post, post.parts.map((x) => x.text));
  const lateMin = (Date.now() - at) / 60000;
  if (!(await send(post, parts, lateMin))) return;

  /* 표시는 보낸 뒤에 남깁니다. 먼저 남기고 보내다 실패하면 그 편은 영영 알림 없이 지나갑니다. */
  const when = kstStamp(Date.now());
  const file = T.markReminded(DIR, post.id, when);
  console.log(`\n보냈습니다. ${post.id} · ${when.replace("T", " ")}`);
  console.log(`${file} 의 ${post.id} 에 알림 표시를 남겼습니다. 올린 뒤 답장하면 발행됨으로 바뀝니다.`);
}

// 답장 고르기는 텔레그램 없이도 시험할 수 있게 밖으로 내둡니다.
module.exports = { matchConfirms };

if (require.main === module) {
  Promise.resolve()
    .then(main)
    .catch((e) => {
      console.error("실패:", e.message);
      /* process.exit 로 즉시 끊지 않습니다. 정리 중인 타이머가 남아 있으면 윈도우에서
         libuv 어설션이 찍혀 진짜 오류 메시지가 묻힙니다. 종료 코드는 그대로 1 입니다. */
      process.exitCode = 1;
    });
}

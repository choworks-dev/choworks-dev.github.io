/* ============================================================
   쓰레드 알림 워커 — 1단계: 읽기만 합니다

   깃허브 액션이 하던 일을 여기로 옮기는 중입니다. 지금 단계에서는
   **판단만 하고 저장소에는 아무것도 쓰지 않습니다.** 며칠 돌려보고 액션과 같은
   결론을 내는지 대조한 뒤에 권한을 줍니다. 안전장치를 다시 지었다는 말은
   다시 틀릴 수 있다는 뜻이라, 실물과 맞춰 보기 전에는 믿지 않습니다.

   왜 자는 코드가 없는가
     액션은 예약 실행이 몇십 분씩 밀려서, 미리 잡힌 회차가 최대 120분을 자면서
     정시를 맞췄습니다(LEAD_MIN). 워커 크론은 매분 돌기 때문에 기다릴 이유가 없습니다.
     "지금인가" 만 보면 됩니다. 그래서 그 코드는 옮기지 않았습니다.

   옮겨온 안전장치 — 이 다섯은 계정을 지키는 규칙입니다. 지우지 마십시오.
     · 한 번에 한 편만
     · status 가 ready 인 편만. draft 는 건드리지 않는다
     · 큐에서 가장 이른 편부터. 건너뛰지 않는다
     · 지난 날짜의 편은 보내지 않고 멈춘다 (밀린 큐를 쏟으면 계정이 정지된다)
     · 하루 상한(DAILY_CAP)을 넘기면 보내지 않는다
   ============================================================ */
import { parseBatch, queueOf, KIND, LIMIT, DAILY_CAP } from "./queue.js";
import { loadThreadFiles, headSha, listThreadNames, getFile, putFile } from "./github.js";
import { send, getUpdates } from "./telegram.js";
import { matchConfirms } from "./confirm.js";
import { applyMark, markPostedPatch, markRemindedPatch } from "./mark.js";

/* 깃허브 액션은 UTC 로 돌고 예약 시각은 한국 시각이라, 섞으면 아홉 시간이 어긋납니다.
   비교는 언제나 epoch 으로 하고, 한국 시각은 찍거나 "오늘" 을 가를 때만 씁니다.
   워커도 UTC 로 도니 규칙은 그대로입니다. */
const KST = 9 * 60 * 60 * 1000;
const kstStamp = (ms) => new Date(ms + KST).toISOString().slice(0, 16);
const kstDate  = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
const scheduledAt = (p) => Number(new Date(`${p.date}T${p.time}:00+09:00`));

/* 예약 시각을 이만큼 지나기 전까지는 보내지 않습니다. 0 이면 정시입니다.
   매분 돌기 때문에 정시에서 최대 1분 늦게 나갑니다. 액션 시절보다 정확합니다. */
const GRACE_MIN = 0;

function decide(queue, now) {
  /* 언제나 큐에서 가장 이른, 아직 알림이 안 나간 편 하나만 봅니다.
     "시각이 된 편들" 중에서 고르면 앞 편을 건너뛸 길이 생깁니다.
     순서가 뒤집히면 앞 편을 가리키며 쓴 문장이 뒤로 갑니다. */
  const post = queue.find((p) => p.status === "ready" && p.date && p.time && !p.remindedAt);
  if (!post) return { action: "none", why: "알릴 편이 남지 않았습니다" };

  const offMin = (scheduledAt(post) - now) / 60000; // 양수면 아직 남은 것
  if (offMin > GRACE_MIN) {
    return { action: "wait", post, why: `예약 시각까지 ${Math.round(offMin)}분 남았습니다` };
  }

  /* 지난 날짜는 보내지 않고 멈춥니다. 오늘 안에서 늦은 것은 그냥 보냅니다.
     며칠 밀린 큐를 그대로 흘리면 밀린 편들이 하루에 몰려 나가고,
     계정을 잃은 이유가 편수가 아니라 몰아치는 활동량이었습니다. */
  if (post.date < kstDate(now)) {
    return { action: "halt", post, why: `${post.id} (${post.at}) 은 지난 날짜입니다. 날짜를 다시 짜야 합니다` };
  }

  /* 그날 상한. 알림이 나간 것과 올라간 것을 같이 셉니다. 둘 다 그날 나간 편이라서요.
     지금 날짜가 아니라 이 편의 예약 날짜로 셉니다. */
  const dayOf = (p) => (p.remindedAt || p.postedAt || "").slice(0, 10) || p.date;
  const sameDay = queue.filter((p) => (p.status === "posted" || p.remindedAt) && dayOf(p) === post.date).length;
  if (sameDay >= DAILY_CAP) {
    return { action: "capped", post, why: `${post.date} 상한 ${sameDay}/${DAILY_CAP}편을 채웠습니다` };
  }

  if (post.len > LIMIT) {
    return { action: "toolong", post, why: `${post.id} 이 ${post.len}자입니다. 상한 ${LIMIT}자를 넘습니다` };
  }

  return { action: "send", post, why: `${post.id} 을 지금 보냅니다` };
}

/* 안내문. 원본(scripts/threads-remind.js 의 send)과 같은 문구를 씁니다.
   문구가 다르면 답장이 달린 원래 메시지로 편을 찾는 규칙이 어긋납니다. */
function headFor(post, lateMin, dry) {
  const many = post.parts.length > 1;
  const late = lateMin < 1 ? null
    : lateMin < 120 ? `예약 시각이 ${Math.round(lateMin)}분 지났습니다.`
      : `예약 시각이 ${Math.round(lateMin / 60)}시간 지났습니다. 지금 올려도 되는 시간인지 보세요.`;
  return [
    `${dry ? "[모의] " : ""}지금 올릴 차례입니다.  ${post.id}`,
    `예약 ${post.at} · ${KIND[post.kind] || post.kind} · ${post.len}자${many ? ` · 본문 + 답글 ${post.parts.length - 1}개` : ""}`,
    late,
    "",
    many
      ? `아래 ${post.parts.length}개 메시지를 순서대로 복사해 올리세요. 첫 통이 본문, 나머지가 답글입니다.`
      : "아래 메시지를 복사해서 쓰레드에 올리세요.",
    `올린 뒤 이 메시지에 reply 로 아무 말이나 보내면 ${post.id} 에 발행 표시를 남깁니다.`,
  ].filter((l) => l !== null).join("\n");
}

/* 그 번호가 든 파일을 찾아 === 줄에 표시를 남깁니다.
   파일을 한 번에 하나씩 열어 봅니다. 원고가 15편 남짓이라 부담이 없고,
   무엇보다 표시를 남길 때는 그 파일의 지금 내용과 blob sha 가 있어야 합니다. */
async function markInRepo(env, sha, id, patch, message) {
  const paths = await listThreadNames(env, sha);
  for (const path of paths) {
    const f = await getFile(env, path, sha);
    const out = applyMark(f.text, id, patch);
    if (!out) continue;
    if (out === f.text) return path; // 이미 같은 표시가 있습니다
    await putFile(env, path, out, f.sha, message);
    return path;
  }
  throw new Error(`${id} 를 찾지 못했습니다. 표시를 못 남기면 같은 편이 또 나갑니다.`);
}

/* 답장을 읽어 발행 표시를 남깁니다.
   알릴 편이 없는 회차에도 돌아야 합니다 — 여기서 표시가 남아야 그날 편수가 맞습니다. */
async function confirmPosted(env, queue, sha, dry) {
  const pending = queue.filter((p) => p.status !== "posted" && p.remindedAt && p.id);
  if (!pending.length) return [];

  let msgs = [];
  try {
    msgs = await getUpdates(env);
  } catch (e) {
    // 확인을 못 받는 것은 알림을 못 보내는 것보다 가볍습니다. 여기서 회차를 죽이지 않습니다.
    console.warn(`답장을 읽지 못했습니다: ${e.message}`);
    return [];
  }

  const { hits, left } = matchConfirms(pending, msgs);
  for (const h of hits) {
    const when = kstStamp(h.at);
    if (dry) { console.log(`[모의] 발행 표시했을 것: ${h.id} (${when})`); continue; }
    await markInRepo(env, sha, h.id, markPostedPatch(when), `${h.id} 발행 표시 (쓰레드 워커)`);
    console.log(`올렸다고 확인했습니다: ${h.id} (${when.replace("T", " ")}) · 답장 "${h.text.slice(0, 20)}"`);
  }
  if (left.length) console.log(`아직 확인 안 된 편 ${left.length}개: ${left.map((p) => p.id).join(", ")}`);
  return hits;
}

async function run(env, now) {
  const dry = env.DRY_RUN === "1";
  const sha = await headSha(env);
  const [files, cached] = await loadThreadFiles(env);
  let queue = queueOf(files.map((f) => parseBatch(f.file, f.raw)));

  /* 확인부터 받습니다. 알릴 편이 없는 회차에도 답장은 처리되어야 하고,
     여기서 표시가 남아야 아래에서 세는 그날 편수가 맞습니다. */
  const done = await confirmPosted(env, queue, sha, dry);
  if (done.length && !dry) {
    // 표시를 남겼으니 다시 읽습니다. 커밋이 생겨 SHA 가 바뀌므로 캐시는 저절로 무효가 됩니다.
    const [f2] = await loadThreadFiles(env);
    queue = queueOf(f2.map((f) => parseBatch(f.file, f.raw)));
  }

  const d = decide(queue, now);
  const line = `${kstStamp(now)} KST · 큐 ${queue.length}편${cached ? "(캐시)" : "(새로 읽음)"}`
    + `${done.length ? ` · 발행확인 ${done.length}편` : ""} · ${d.action} · ${d.why}`;
  console.log(line);

  if (d.action !== "send") return line;

  const lateMin = (now - Number(new Date(`${d.post.date}T${d.post.time}:00+09:00`))) / 60000;

  if (dry) {
    /* 1단계에서는 저장소에 표시를 남기지 않아 같은 편이 매분 다시 걸립니다.
       KV 에 보냈다고 적어 두어 두 번 보내지 않습니다. */
    const seen = env.STATE ? await env.STATE.get(`dry:${d.post.id}`) : null;
    if (seen) { console.log(`${d.post.id} 모의 알림은 이미 나갔습니다(${seen}).`); return line; }
    await send(env, headFor(d.post, lateMin, true));
    for (const part of d.post.parts) await send(env, part.text);
    if (env.STATE) await env.STATE.put(`dry:${d.post.id}`, kstStamp(now), { expirationTtl: 60 * 60 * 24 * 30 });
    console.log(`${d.post.id} 모의 알림 보냈습니다`);
    return line;
  }

  const sent = await send(env, headFor(d.post, lateMin, false));
  if (!sent) { console.log("텔레그램 값이 없어 보내지 않았습니다."); return line; }
  for (const part of d.post.parts) await send(env, part.text);

  /* 표시는 보낸 뒤에 남깁니다. 먼저 남기고 보내다 실패하면 그 편은 영영 알림 없이 지나갑니다. */
  const when = kstStamp(now);
  const file = await markInRepo(env, sha, d.post.id, markRemindedPatch(when), `${d.post.id} 알림 표시 (쓰레드 워커)`);
  console.log(`보냈습니다. ${d.post.id} · ${when.replace("T", " ")} · ${file}`);
  return line;
}

export default {
  /* 매분 깨어납니다. 실패하면 조용히 넘어가지 않고 텔레그램으로 알립니다 —
     액션은 실패하면 메일이 왔지만 워커는 아무도 안 알려줍니다.
     조용히 안 도는 것이 제일 나쁩니다. */
  async scheduled(event, env, ctx) {
    try {
      await run(env, event.scheduledTime || Date.now());
    } catch (err) {
      console.error("실패:", err && err.stack || err);
      /* 매분 도는 일이라 실패도 매분 납니다. 그대로 보내면 한 시간에 60통입니다.
         실제로 그렇게 보내 놓고서야 알았습니다(2026-08-28). 같은 실패는 한 시간에
         한 번만 알립니다. 알리지 않는 것과 쉬지 않고 알리는 것 둘 다 못 쓰는 알림입니다. */
      const kind = String(err).slice(0, 60);
      try {
        const last = env.STATE ? await env.STATE.get("err:last") : null;
        if (last !== kind) {
          await send(env, `[모의] 쓰레드 워커 실패\n${String(err).slice(0, 500)}`);
          if (env.STATE) await env.STATE.put("err:last", kind, { expirationTtl: 3600 });
        }
      } catch (_) {}
    }
  },

  /* 손으로 확인할 때 씁니다. 브라우저로 열면 지금 무엇을 할지 그대로 보여줍니다. */
  async fetch(req, env, ctx) {
    try {
      const line = await run(env, Date.now());
      return new Response(line + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (err) {
      return new Response("실패: " + String(err) + "\n", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  },
};

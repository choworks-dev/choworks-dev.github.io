/* === 줄에 표시를 남깁니다. scripts/threads.js 의 mark / metaLine 을 옮겼습니다.

   알림을 보낸 것(~)과 실제로 올린 것(@)은 다른 표시입니다.
   알림만 보고 발행됨으로 적으면, 알림을 놓친 편이 올라간 것으로 기록되어 조용히 사라집니다.
   ~ 가 하는 일은 하나입니다 — 같은 편에 알림을 두 번 보내지 않게 하는 것. */

const ID_RE = /^[A-Z]{2}\d{2}$/;
const KIND   = { work: 1, life: 1 };
const STATUS = { draft: 1, ready: 1, posted: 1 };

function parseMeta(line) {
  const out = { id: "", date: "", time: "", kind: "", status: "", postedAt: "", remindedAt: "", unknown: [] };
  String(line).trim().split(/\s+/).filter(Boolean).forEach((tok) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) out.date = tok;
    else if (ID_RE.test(tok)) out.id = tok;
    else if (/^@/.test(tok)) out.postedAt = tok.slice(1);
    else if (/^~/.test(tok)) out.remindedAt = tok.slice(1);
    else if (/^\d{1,2}:\d{2}$/.test(tok)) out.time = tok.padStart(5, "0");
    else if (Object.prototype.hasOwnProperty.call(KIND, tok)) out.kind = tok;
    else if (Object.prototype.hasOwnProperty.call(STATUS, tok)) out.status = tok;
    else out.unknown.push(tok);
  });
  return out;
}

/* === 날짜 번호 시각 성격 상태 ~알림 @발행 — 자리를 고정해 다시 씁니다.
   줄을 만드는 곳을 한 군데로 두는 이유는, 여러 곳에서 배열을 따로 만들면 한 곳이
   시각 표시를 빠뜨리기 때문입니다. 원본에서 실제로 @발행 시각이 조용히 지워진 적이 있습니다. */
function metaLine(m, patch) {
  const v = { ...m, ...(patch || {}) };
  const toks = [v.date, v.id, v.time, v.kind, v.status, ...(v.unknown || [])];
  if (v.remindedAt) toks.push(`~${v.remindedAt}`);
  if (v.postedAt) toks.push(`@${v.postedAt}`);
  return `=== ${toks.filter(Boolean).join(" ")}`;
}

/* 파일 하나에서 그 번호의 === 줄만 고칩니다. 나머지 줄은 한 글자도 건드리지 않습니다.
   못 찾으면 null 을 돌려줍니다 — 부르는 쪽이 다음 파일을 봅니다. */
export function applyMark(raw, id, patch) {
  let hit = false;
  const out = raw.replace(/^=== .*$/gm, (line) => {
    const m = parseMeta(line.replace(/^=== */, ""));
    if (m.id !== id || hit) return line;
    hit = true;
    return metaLine(m, patch);
  });
  return hit ? out : null;
}

export const markPostedPatch   = (when) => ({ status: "posted", postedAt: when || "" });
export const markRemindedPatch = (when) => ({ remindedAt: when || "" });

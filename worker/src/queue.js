/* ============================================================
   쓰레드 큐 읽기 — scripts/threads.js 에서 알림에 필요한 부분만 옮겼습니다.

   워커에는 파일 시스템이 없습니다. 원본은 fs 로 읽지만 여기서는 GitHub API 가
   내려준 문자열을 받습니다. 그것 말고 판단 규칙은 원본과 같아야 합니다.
   다르면 같은 큐를 두 곳이 다르게 읽는 것이고, 그게 제일 찾기 어려운 종류의 버그입니다.
   ============================================================ */

export const KIND   = { work: 1, life: 1 };
export const STATUS = { draft: 1, ready: 1, posted: 1 };
export const LIMIT  = 500;   // 한 편 글자 상한
export const DAILY_CAP = 4;  // 하루에 나갈 수 있는 편 수

const ID_RE = /^[A-Z]{2}\d{2}$/;

const stripNotes = (s) => String(s).replace(/<!--[\s\S]*?-->/g, "");

/* 쓰레드는 글자를 셉니다. 한글도 영문도 한 자입니다.
   [...s] 로 나누는 이유는 s.length 가 이모지 하나를 둘로 세기 때문입니다. */
const countChars = (s) => [...String(s)].length;

/* front-matter 를 직접 떼어냅니다. 워커에 npm 의존을 들이지 않기 위해서입니다.
   이 파일들의 앞머리는 source/kind 두 줄뿐이라 YAML 파서가 필요 없습니다. */
function frontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { attributes: {}, body: raw };
  const attributes = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) attributes[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { attributes, body: raw.slice(m[0].length) };
}

function parseMeta(line) {
  const out = { id: "", date: "", time: "", kind: "", status: "", postedAt: "", remindedAt: "", unknown: [] };
  String(line).trim().split(/\s+/).filter(Boolean).forEach((tok) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) out.date = tok;
    else if (ID_RE.test(tok)) out.id = tok;
    else if (/^@/.test(tok)) out.postedAt = tok.slice(1);   // 실제로 올라간 시각
    else if (/^~/.test(tok)) out.remindedAt = tok.slice(1); // 알림을 보낸 시각
    else if (/^\d{1,2}:\d{2}$/.test(tok)) out.time = tok.padStart(5, "0");
    else if (Object.prototype.hasOwnProperty.call(KIND, tok)) out.kind = tok;
    else if (Object.prototype.hasOwnProperty.call(STATUS, tok)) out.status = tok;
    else out.unknown.push(tok);
  });
  return out;
}

function splitReplies(body) {
  return body
    .split(/^[ \t]*---[ \t]*$/m)
    .map((s) => s.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .map((text, i) => ({ n: i + 1, text, len: countChars(text) }));
}

export function parseBatch(file, raw) {
  const parsed = frontMatter(raw);
  const a = parsed.attributes || {};
  const source = a.source ? String(a.source).trim() : "";
  const baseKind = Object.prototype.hasOwnProperty.call(KIND, String(a.kind)) ? String(a.kind) : "work";

  const body = stripNotes(parsed.body);
  const chunks = body.split(/^[ \t]*===[ \t]*(.*)$/m);
  const posts = [];
  for (let i = 1; i < chunks.length; i += 2) {
    const meta = parseMeta(chunks[i]);
    const parts = splitReplies(chunks[i + 1] || "");
    posts.push({
      n: posts.length + 1,
      id: meta.id,
      date: meta.date,
      time: meta.time,
      at: meta.date ? `${meta.date}${meta.time ? ` ${meta.time}` : " 00:00"}` : "",
      // 시각을 안 적은 편은 그날 맨 뒤로 갑니다(아직 안 정한 것이므로)
      sortKey: meta.date ? Number(new Date(`${meta.date}T${meta.time || "23:59"}:00+09:00`)) : Infinity,
      kind: meta.kind || baseKind,
      status: meta.status || "draft",
      postedAt: meta.postedAt,
      remindedAt: meta.remindedAt,
      unknown: meta.unknown,
      parts,
      len: parts.reduce((m, p) => Math.max(m, p.len), 0),
    });
  }
  return { file, name: file.replace(/\.md$/, ""), source, baseKind, posts };
}

/* 배치들을 나갈 순서 하나로 폅니다. 적혀 있는 날짜 순 그대로이고 여기서 다시 정하지 않습니다. */
export function queueOf(batches) {
  const all = [];
  batches.forEach((b) => b.posts.forEach((p) => all.push({ ...p, file: b.file, source: b.source })));
  return all.sort((a, b) => a.sortKey - b.sortKey || a.file.localeCompare(b.file) || a.n - b.n);
}

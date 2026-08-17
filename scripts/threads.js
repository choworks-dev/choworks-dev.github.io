/* ============================================================
   codechains blog — 쓰레드 원고 (1단계: 원고를 쌓고 큐로 관리하기)

   운영 모델
     블로그 글 한 편이 쓰레드 서너 편에서 열 편까지의 소재가 됩니다.
     그 편들은 이어 붙인 체인이 아니라 며칠에 걸쳐 따로 나가는 독립 포스팅입니다.
     사이사이에는 일 얘기가 아닌 글이 섞여야 합니다. 업무 이야기만 늘어놓는 계정은 읽히지 않습니다.

   그래서 파일은 "쓰레드 한 편"이 아니라 "한 배치"입니다.
     content/threads/<이름>.md 한 파일 = 한 묶음(보통 블로그 글 하나에서 뽑은 것)
     === 로 시작하는 줄이 그 안에서 편을 나눕니다.
     한 편 안에서 답글로 이어 붙일 때만 --- 를 씁니다.

   파일 모양
     ---
     source: wix-to-cloudflare   # 소재가 된 블로그 글의 슬러그. 없으면 비웁니다
     kind: work                  # 이 파일의 기본 성격(work | life). 편마다 덮어쓸 수 있습니다
     ---

     === 2026-08-04 08:20 work ready
     첫 편 본문

     === 2026-08-04 21:10 life
     둘째 편 본문

   === 뒤의 토큰은 순서를 가리지 않고, 없어도 됩니다.
     날짜 2026-08-04 · 시각 08:20 · 성격 work|life · 상태 draft|ready|posted
     ~2026-08-04T08:20 알림을 보낸 시각 · @2026-08-04T08:23 실제로 올린 시각 (자동화가 남깁니다)
   <!-- 이렇게 --> 적은 메모는 글자 수에도 복사에도 들어가지 않습니다.

   쓰기:  node scripts/threads.js <블로그슬러그>   (그 글에서 배치 뼈대를 만듭니다)
          node scripts/threads.js                  (큐 상태와 남은 소재를 봅니다)
   보기:  npm run dev → http://localhost:4000/admin 의 "쓰레드" 탭
   ============================================================ */
const fs = require("fs");
const path = require("path");
const fm = require("front-matter");

/* 쓰레드 한 편의 글자 수. 둘은 성격이 다릅니다.
     LIMIT  쓰레드가 받아주는 상한. 이걸 넘으면 저장 자체를 막습니다.
     SOFT   우리가 정한 길이. 넘어도 올라가지만 검사에서 잡습니다.

   SOFT 를 200자로 둡니다. 그 위로 가면 피드에서 접히고, 접힌 글은 잘 안 펴집니다.
   스크롤을 멈추지 않고 한 번에 읽히는 길이가 실제로 읽히는 길이입니다.
   길게 쓸 말이 있으면 늘리지 말고 --- 로 답글을 나눕니다. */
const LIMIT = 500;
const SOFT = 200;

/* 상태는 세 가지뿐이고 뜻이 정해져 있습니다.
     draft   원고가 아직 안 끝났습니다. 뼈대만 있거나 쓰는 중입니다. 상태를 안 적으면 이것으로 봅니다.
     ready   원고를 다 썼습니다. 지금 그대로 올려도 되는 상태입니다.
     posted  쓰레드에 실제로 올렸습니다. 여기까지 와야 큐에서 빠집니다. */
const STATUS = { draft: "초안", ready: "준비됨", posted: "발행됨" };
/* 성격. 업무 이야기만 이어지면 계정이 광고판이 됩니다.
   섞으라고 말로만 정해두면 안 지켜지므로, 편마다 표시하고 배합을 세어서 보여줍니다. */
const KIND = { work: "업무", life: "일상" };

/* 메모(<!-- -->)는 원고가 아닙니다. 글자 수를 셀 때도, 복사할 때도 없는 것으로 봅니다. */
const stripNotes = (s) => String(s).replace(/<!--[\s\S]*?-->/g, "");

/* 쓰레드는 글자를 셉니다. 한글도 영문도 한 자입니다.
   [...s] 로 나누는 이유는 s.length 가 이모지 하나를 둘로 세기 때문입니다.
   (조합형 이모지는 여전히 실제보다 크게 나올 수 있어, 그래서 SOFT 여백을 둡니다) */
const countChars = (s) => [...String(s)].length;

const hasLink = (s) => /https?:\/\//.test(s);

/* ---------- 편 고유번호 ----------
   알파벳 두 자 + 숫자 두 자. AA01 부터 시작해 AA99 다음이 AB01, AZ99 다음이 BA01 입니다.
   26 x 26 x 99 = 66,924 편까지 갑니다.

   한 번 붙은 번호는 절대 바뀌지 않습니다. 날짜를 다시 배정하든 순서를 섞든 그대로입니다.
   그래야 "AA07 그 글 말이야" 라고 부를 수 있고, 나중에 발행 결과나 반응을 이 번호로 이어 붙일 수 있습니다.
   자리 수가 고정이라 문자열 비교만으로 순서가 나옵니다(AA01 < AA02 < AB01). */
const ID_RE = /^[A-Z]{2}\d{2}$/;
const FIRST_ID = "AA01";

function nextId(id) {
  if (!id) return FIRST_ID;
  let a = id.charCodeAt(0);
  let b = id.charCodeAt(1);
  let n = Number(id.slice(2)) + 1;
  if (n > 99) { n = 1; b += 1; }
  if (b > 90) { b = 65; a += 1; } // 'Z' = 90, 'A' = 65
  if (a > 90) return null; // 다 썼습니다. 66,924 편이라 실제로는 오지 않습니다.
  return String.fromCharCode(a) + String.fromCharCode(b) + String(n).padStart(2, "0");
}

/* === 뒤에 붙는 토큰들. 순서를 외우지 않아도 되도록 종류로 알아봅니다.
   날짜만, 시각만, 성격만 적어도 됩니다. 못 알아본 토큰은 조용히 버리지 않고 그대로 돌려주어
   오타(예: redy)가 화면에서 눈에 띄게 합니다. */
function parseMeta(line) {
  const out = { id: "", date: "", time: "", kind: "", status: "", postedAt: "", remindedAt: "", unknown: [] };
  String(line).trim().split(/\s+/).filter(Boolean).forEach((tok) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) out.date = tok;
    else if (ID_RE.test(tok)) out.id = tok;
    // @2026-08-03T09:02 는 실제로 올라간 시각입니다. 발행 표시를 남길 때 붙습니다.
    else if (/^@/.test(tok)) out.postedAt = tok.slice(1);
    // ~2026-08-03T09:02 는 "올릴 차례" 알림을 보낸 시각입니다. 알림 자동화가 남깁니다.
    else if (/^~/.test(tok)) out.remindedAt = tok.slice(1);
    else if (/^\d{1,2}:\d{2}$/.test(tok)) out.time = tok.padStart(5, "0");
    else if (Object.prototype.hasOwnProperty.call(KIND, tok)) out.kind = tok;
    else if (Object.prototype.hasOwnProperty.call(STATUS, tok)) out.status = tok;
    else out.unknown.push(tok);
  });
  return out;
}

/* === 줄을 표준 형태로 다시 씁니다.  === 날짜 번호 시각 성격 상태 ~알림 @발행
   파서는 순서를 가리지 않지만, 파일을 눈으로 볼 때 자리가 고정돼 있어야 읽힙니다.

   줄을 다시 쓰는 곳이 다섯 군데인데, 각자 배열을 만들면 한 곳에서 시각 표시를 빠뜨립니다.
   실제로 그렇게 해서 번호를 채울 때 @발행 시각이 조용히 지워지고 있었습니다.
   그래서 한 곳에서만 만듭니다. 바꿀 값만 patch 로 주고 나머지는 읽은 그대로 둡니다. */
function metaLine(m, patch) {
  const v = { ...m, ...(patch || {}) };
  const toks = [v.date, v.id, v.time, v.kind, v.status, ...(v.unknown || [])];
  if (v.remindedAt) toks.push(`~${v.remindedAt}`);
  if (v.postedAt) toks.push(`@${v.postedAt}`);
  return `=== ${toks.filter(Boolean).join(" ")}`;
}

/* 한 편 안에서 답글로 이어 붙일 때만 쓰는 경계.
   \s* 대신 [ \t]* 를 쓰는 이유는, \s 가 줄바꿈까지 먹어 빈 줄이 경계로 오인되기 때문입니다. */
function splitReplies(body) {
  return body
    .split(/^[ \t]*---[ \t]*$/m)
    .map((s) => s.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .map((text, i) => ({ n: i + 1, text, len: countChars(text) }));
}

/* 배치 하나(파일 하나) 읽기 */
function parseBatch(file, raw) {
  const parsed = fm(raw);
  const a = parsed.attributes || {};
  const source = a.source ? String(a.source).trim() : "";
  const baseKind = Object.prototype.hasOwnProperty.call(KIND, String(a.kind)) ? String(a.kind) : "work";

  const body = stripNotes(parsed.body);
  /* === 로 자릅니다. 첫 조각은 === 앞의 머리말이라 원고가 아닙니다(보통 비어 있음).
     캡처 그룹을 쓰면 [본문0, 메타1, 본문1, 메타2, 본문2, ...] 순으로 나옵니다. */
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
      // 정렬용. 시각을 안 적은 편은 그날 맨 뒤로 갑니다(아직 안 정한 것이므로)
      sortKey: meta.date ? Number(new Date(`${meta.date}T${meta.time || "23:59"}:00+09:00`)) : Infinity,
      kind: meta.kind || baseKind,
      status: meta.status || "draft",
      postedAt: meta.postedAt,
      /* 알림은 나갔는데 아직 발행 표시가 없는 편 = 올리라고 알렸지만 올렸다는 답을 못 받은 편입니다.
         큐는 이 편을 지나 다음으로 넘어가되, 화면에는 확인이 안 됐다고 남겨 둡니다. */
      remindedAt: meta.remindedAt,
      unknown: meta.unknown,
      parts,
      len: parts.reduce((m, p) => Math.max(m, p.len), 0),
    });
  }
  return { file, name: file.replace(/\.md$/, ""), source, baseKind, posts };
}

function loadThreads(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => parseBatch(f, fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/* 배치들을 나갈 순서 하나로 폅니다. 화면이 답해야 하는 질문이 "다음에 뭐가 나가나" 라서요. */
function queueOf(batches) {
  const all = [];
  batches.forEach((b) => b.posts.forEach((p) => all.push({ ...p, file: b.file, source: b.source })));
  return all.sort((a, b) => a.sortKey - b.sortKey || a.file.localeCompare(b.file) || a.n - b.n);
}

/* 한 편 검사. 블로그의 SEO 검사와 달리 빌드를 멈추지 않습니다.
   쓰레드는 아직 안 올린 상태가 정상이고, 그 상태로 며칠씩 있기 때문입니다. */
function checkPost(p, postsBySlug) {
  const issues = [];
  const add = (level, msg) => issues.push({ level, msg });
  const where = (part) => (p.parts.length > 1 ? `${part.n}번째 답글: ` : "");

  if (!p.parts.length) add("error", "내용이 비어 있습니다.");

  p.parts.forEach((part) => {
    if (part.len > LIMIT) {
      add("error", `${where(part)}${part.len}자입니다. ${part.len - LIMIT}자를 줄이거나 --- 로 나누세요(상한 ${LIMIT}자).`);
    } else if (part.len > SOFT && p.status !== "posted") {
      /* 이미 올린 편은 빼줍니다. 쓰레드에 올라간 그대로가 기록이라 여기서 고칠 수 없는데,
         길이 규칙을 나중에 조인 탓에 옛 편들이 영영 경고로 남으면 새 경고가 안 보입니다. */
      add("warn", `${where(part)}${part.len}자입니다. 한 편은 ${SOFT}자 안쪽으로 씁니다(넘으면 피드에서 접힙니다).`);
    }
    if (/[—–]/.test(part.text)) {
      add("warn", `${where(part)}긴 하이픈(— 또는 –)이 있습니다. 쉼표나 마침표로 바꾸세요.`);
    }
  });

  /* 링크는 아예 쓰지 않습니다. 2026-08-17 에 정했고 있던 것도 전부 걷어냈습니다.
     링크가 붙은 글은 도달이 눈에 띄게 떨어집니다. 밖으로 내보내는 글을 플랫폼이 덜 퍼뜨리는 건
     당연한 일이라, 아껴 쓰는 정도로는 이길 수 없습니다.
     블로그로 오게 하려면 링크 대신 프로필에 두고, 글에서는 궁금하게만 만듭니다.
     발행된 편은 이제 와서 못 고치니 빼줍니다. */
  const linked = p.parts.filter((x) => hasLink(x.text));
  if (linked.length && p.status !== "posted") {
    add("warn", `${linked.length}곳에 링크가 있습니다. 쓰레드 원고에는 링크를 넣지 않습니다(도달이 떨어집니다).`);
  }

  if (!p.id) add("warn", "고유번호가 없습니다. npm run thread -- --ids 로 채우세요.");
  if (!p.date) add("warn", "나갈 날짜가 없습니다. === 뒤에 2026-08-04 08:37 처럼 적어두세요.");
  if (p.unknown.length) add("warn", `=== 줄에서 못 알아본 말: ${p.unknown.join(", ")}. 오타인지 보세요.`);
  if (p.source && postsBySlug && !postsBySlug.has(p.source)) {
    add("error", `source: ${p.source} 에 해당하는 블로그 글이 없습니다.`);
  }
  return issues;
}

/* 블로그 글 하나에서 뽑는 배치는 3편입니다. 글 한 편이 도입·전개·마무리로 나뉘는 단위가 셋이라서요.
   이건 하루에 몇 편을 올리느냐와 상관없습니다. 발행 속도(PER_DOW)와는 애초에 맞물리지 않으므로
   둘을 같이 움직이면 안 됩니다.

   2026-08-17 에 9편에서 3편으로 줄였습니다. 한 글에서 아홉 편을 뽑으면 뒤로 갈수록 우려낸 티가 나고,
   무엇보다 큐가 길어져서 오늘 쓴 글의 쓰레드가 몇 주 뒤에나 나갑니다. 배치는 큐 맨 뒤에 붙으니까요.
   글이 자주 나오는 편이 계정에도 낫습니다. 이미 만들어 둔 9편짜리 배치는 그대로 둡니다.

   검사는 3의 배수인지만 봅니다. 옛 배치(9편)를 경고로 만들지 않으려는 것이고, 늘리고 싶은 날에도
   3편 단위로 늘어야 소재가 한쪽만 다뤄지다 끊기지 않기 때문입니다.
   소재가 없는 파일(일상 편 등)은 쌓아가는 성격이라 이 규칙에서 뺍니다. */
const BATCH_STEP = 3;
function batchIssues(batches) {
  const out = batches
    .filter((b) => b.source && b.posts.length % BATCH_STEP !== 0)
    .map((b) => {
      const short = BATCH_STEP - (b.posts.length % BATCH_STEP);
      const down = b.posts.length - (b.posts.length % BATCH_STEP);
      return `${b.file}: ${b.posts.length}편입니다. ${b.posts.length + short}편으로 늘리거나 ${down}편으로 줄이세요(${BATCH_STEP}의 배수).`;
    });

  /* 고유번호가 겹치면 번호로 글을 가리키는 일이 전부 어긋납니다.
     손으로 복사해서 편을 늘릴 때 실제로 생기는 실수라 여기서 잡습니다. */
  const seen = new Map();
  batches.forEach((b) => b.posts.forEach((p) => {
    if (!p.id) return;
    if (seen.has(p.id)) out.push(`고유번호 ${p.id} 가 ${seen.get(p.id)} 와 ${b.file} 에서 겹칩니다.`);
    else seen.set(p.id, b.file);
  }));
  return out;
}

/* 번호가 없는 편에만 번호를 붙입니다. 이미 붙은 번호는 건드리지 않습니다.
   붙는 순서는 나갈 순서(큐 순서)입니다. AA01 이 가장 먼저 나가는 편이 되도록. */
function fillIds(batches) {
  const used = batches.flatMap((b) => b.posts.map((p) => p.id)).filter(Boolean).sort();
  let last = used.length ? used[used.length - 1] : "";
  const assigned = new Map();
  queueOf(batches).forEach((p) => {
    if (p.id) return;
    last = nextId(last);
    if (!last) throw new Error("고유번호를 다 썼습니다(ZZ99).");
    assigned.set(`${p.file}#${p.n}`, last);
  });
  return assigned;
}

/* 큐 배합. 업무 이야기만 줄줄이 이어지면 알려줍니다.
   숫자로 보이지 않으면 "섞어야지" 라는 다짐은 지켜지지 않습니다. */
function queueStats(queue) {
  const left = queue.filter((p) => p.status !== "posted");
  const count = (k) => left.filter((p) => p.kind === k).length;
  let run = 0;
  let worst = 0;
  left.forEach((p) => {
    run = p.kind === "work" ? run + 1 : 0;
    worst = Math.max(worst, run);
  });

  /* 같은 블로그 글에서 뽑은 편이 연달아 나가는 길이.
     편수보다 이쪽이 피로를 만듭니다. 나흘 내리 같은 주제면 기록이 아니라 연재 광고로 읽히고,
     첫 편에 흥미를 느껴 팔로우한 사람이 사흘째에 언팔합니다.
     그래서 배치를 순서대로 흘리지 않고 겹쳐서 흘립니다. */
  let topicRun = 0;
  let worstTopic = 0;
  queue.forEach((p, i) => {
    topicRun = i > 0 && p.source && p.source === queue[i - 1].source ? topicRun + 1 : 1;
    worstTopic = Math.max(worstTopic, topicRun);
  });
  return {
    total: queue.length,
    left: left.length,
    posted: queue.length - left.length,
    work: count("work"),
    life: count("life"),
    // 아직 원고가 안 끝난 편. 이 숫자가 0이어야 큐가 그대로 나갈 수 있습니다.
    draft: left.filter((p) => p.status === "draft").length,
    ready: left.filter((p) => p.status === "ready").length,
    undated: left.filter((p) => !p.date).length,
    /* 올리라고 알림은 갔는데 올렸다는 답이 안 온 편.
       하나쯤은 방금 알림이 간 것이고, 쌓이기 시작하면 알림을 놓치고 있다는 뜻입니다. */
    waiting: left.filter((p) => p.remindedAt).length,
    longestWorkRun: worst,
    longestTopicRun: worstTopic,
  };
}

/* ---------- 초안 씨앗 ----------
   문구를 대신 써주지는 않습니다. 나올 수도 없습니다.
   쓰레드에서 읽힐지 말지를 정하는 것은 첫 두 줄인데, 그건 글 요약이 아니라 장면이라서요.
   대신 빈 화면 앞에 앉지 않도록, 글에서 뽑은 재료를 각 편 옆에 붙여 둡니다. */

// 본문에서 소제목·표·코드·목록을 걷어낸 평문
function plainBody(post) {
  return String(post.rawBody || "")
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .filter((l) => !/^\s*(#{1,6}\s|>|\||[-*+]\s|\d+\.\s)/.test(l))
    .join("\n");
}

/* 훅 후보. 숫자가 들어간 문장을 먼저 봅니다.
   "연 59만원", "이틀 만에" 같은 문장이 그대로 첫 줄이 되는 경우가 많기 때문입니다. */
function hookCandidates(post) {
  const out = [];
  plainBody(post)
    .split(/(?<=[.!?])\s+/)
    .forEach((raw) => {
      const s = raw
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (s.length < 12 || s.length > 110) return;
      if (!/\d/.test(s)) return;
      if (out.includes(s)) return;
      out.push(s);
    });
  if (!out.length && post.description) out.push(String(post.description).trim());
  return out.slice(0, 6);
}

// 글의 소제목 = 편을 나눌 자연스러운 경계
const outline = (post) =>
  String(post.rawBody || "")
    .split("\n")
    .filter((l) => /^##\s+/.test(l))
    .map((l) => l.replace(/^#+\s+/, "").trim());

/* ---------- 발행 시각 ----------
   쓰레드는 아직 팔로우하지 않은 계정의 글을 넓게 노출시키는 단계라, 올리는 횟수가 곧 기회입니다.
   하루 한 편이면 그 기회를 거의 안 쓰고, 열 편을 넘기면 한 계정이 피드를 덮어 오히려 언팔이 늡니다.

   그런데 첫 계정(@kadecho.dev)이 만든 다음 날 정지됐습니다. 걸린 것은 편수가 아니라
   계정을 만들자마자 쏟아낸 활동량이었습니다. 새 계정도 같은 속도로 시작하면 같은 결과가 납니다.
   그래서 편수를 요일로 묶어 고정하고, 시작 며칠은 ramp 로 하루 1편까지 더 낮춰 계정을 데웁니다.

   지금은 평일 2편입니다. 한 글에서 3편만 뽑기로 하면서 같이 내렸습니다.
   소재가 줄었는데 발행 속도를 그대로 두면 큐가 며칠 만에 비고, 그러면 급하게 쓴 편이 나갑니다.
   쉬는 날은 토요일 하나입니다. 쉬는 날이 있어야 나머지 날이 성실해 보입니다.
   일요일은 1편만 둡니다. 일요일에 일 이야기를 쏟아내는 계정은 피곤한데, 그날 저녁에는
   읽는 사람도 다음 주 일을 생각하기 시작하므로 한 편은 남겨 둡니다. 그 한 편은 일상 편이 낫습니다.

   규칙적일수록 손해입니다. 같은 시각, 같은 분에 올라가면 사람이 아니라 예약 발행으로 읽힙니다.
   그렇게 보이는 계정에는 댓글이 안 붙고, 댓글이 안 붙으면 노출이 떨어집니다.
   편수는 위 규칙으로 고정하되, 시간대와 분은 매번 다시 뽑습니다. */

/* 하루 편수별 시간대. 21시대는 한국 사용자가 가장 붐비는 시간이라 몇 편이든 항상 후보에 둡니다.
   한 편만 올리는 날은 아침과 저녁 중에 고릅니다. 매번 같은 시각이면 그것도 규칙이 됩니다.
   평일 기본이 3편이라 3에 한 벌만 두면 평일이 전부 같은 시간표가 됩니다. 그래서 여러 벌을 둡니다. */
const HOUR_SETS = {
  1: [[10], [21]],
  2: [[8, 21], [12, 21], [8, 12]],
  3: [[8, 12, 21], [8, 13, 21], [9, 12, 21], [8, 12, 20], [9, 13, 21]],
  4: [[8, 12, 18, 21]],
};

/* 일요일 한 편은 저녁에 둡니다. 낮에는 일 생각을 안 하고 싶은 날이고,
   저녁이 되어야 다음 주가 눈에 들어옵니다. 그 한 편만 그때 걸리면 됩니다.
   두 벌을 두는 이유는 매주 같은 시각이면 그것도 예약 발행처럼 보이기 때문입니다. */
const SUN_HOURS = [[20], [21]];
const pad = (n) => String(n).padStart(2, "0");
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* 요일별 편수. 일요일 1 · 평일 2 · 토요일 0.
   PER_DOW 를 고치면 큐 전체가 따라옵니다(npm run thread -- --replan). */
const SAT = 6;
const SUN = 0;
const PER_DOW = { 0: 1, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 0 };
const PER_DOW_TEXT = "평일 2편 · 토요일 0편 · 일요일 1편";

const iso = (d) => d.toISOString().slice(0, 10);
const addDay = (d, n) => new Date(d.getTime() + n * 86400000);

/* 예약 시각은 전부 한국 시각입니다. "오늘" 과 "지금 몇 시" 를 UTC 로 물으면 아홉 시간이 어긋나서
   아침에 --replan 을 돌리면 어제부터 다시 짭니다. 그래서 여기서만 시차를 더해 씁니다. */
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstToday = () => kstNow().toISOString().slice(0, 10);
const kstHour = () => kstNow().getUTCHours();

/* 편들이 나갈 날짜와 시각을 정합니다. kinds 는 큐 순서대로의 성격 배열입니다.
   순서는 건드리지 않습니다. 번호와 발행 순서가 어긋나면 앞 편을 가리키며 쓴 문장이 뒤로 갑니다.

   ramp 는 시작 며칠의 편수를 요일 규칙 대신 그대로 씁니다(예: [1, 1, 1]).
   정지된 계정을 새로 만들고 다시 데울 때 쓰는 값이라 요일도 무시합니다.
   계정을 만든 직후에 일요일이라고 하루 통째로 쉬면, 그날 한 편 올리는 것보다 오히려 손해입니다.

   notBefore 는 첫날에만 쓰는 시각 하한(시)입니다. 오늘부터 다시 짤 때 이미 지나간 시각에
   편을 놓지 않기 위한 값입니다. 지난 시각에 놓이면 알림 자동화가 그 편을 지나쳐 버리거나,
   다음 회차가 "지난 날짜" 로 보고 큐를 통째로 멈춥니다. 첫날에 안 들어간 편은 다음 날로 밀립니다.

   주말에 업무 편이 놓이면 경고만 냅니다. 여기서 순서를 바꿔 고치지는 않습니다.
   순서를 바꾸는 값과 날짜를 정하는 값을 한 함수에서 같이 만지면 무엇이 무엇을 밀었는지 알 수 없게 됩니다. */
function planSchedule(kinds, startDate, ramp, notBefore) {
  const out = [];
  const warn = [];
  const head = Array.isArray(ramp) ? ramp : [];
  let i = 0;
  let n = 0;
  let day = new Date(`${startDate}T00:00:00Z`);

  while (i < kinds.length) {
    const dow = day.getUTCDay();
    const rule = n < head.length ? head[n] : PER_DOW[dow];
    const date = iso(day);
    // 마지막 날은 남은 만큼만. ramp 로 시간대 표에 없는 숫자가 들어와도 죽지 않게 4에서 자릅니다.
    const want = Math.min(rule, kinds.length - i, 4);
    if (want > 0) {
      const floor = date === startDate ? notBefore || 0 : 0;
      // 일요일 한 편짜리 자리만 저녁 표를 씁니다. ramp 로 편수가 달라진 날은 평소 표를 그대로 씁니다.
      const table = dow === SUN && want === 1 ? SUN_HOURS : HOUR_SETS[want];
      const sets = table.map((s) => s.filter((h) => h >= floor)).filter((s) => s.length);
      const hours = sets.length ? pick(sets) : []; // 남은 시간대가 없으면 그날은 통째로 건너뜁니다
      if (hours.length && (dow === SAT || dow === SUN)) {
        const work = kinds.slice(i, i + hours.length).filter((k) => k !== "life").length;
        if (work) warn.push(`${date} (${dow === SAT ? "토" : "일"}) 에 업무 편이 ${work}편 놓입니다.`);
      }
      hours.forEach((h) => {
        // 분은 1~59. 정각을 빼는 이유는 08:00 같은 시각이 예약 발행처럼 보이는 대표적인 모양이라서입니다.
        out.push(`${date} ${pad(h)}:${pad(1 + Math.floor(Math.random() * 59))}`);
        i += 1;
      });
    }
    day = addDay(day, 1);
    n += 1;
  }

  return { when: out, warn };
}

/* 성격을 모르는 자리(새 배치 뼈대)에서 부릅니다. 전부 업무로 봅니다.
   주말 자리는 일상 편의 것이라, 업무 배치가 미리 차지하면 경고가 뜹니다. */
function scheduleFor(startDate, count, kinds) {
  return planSchedule(kinds || Array(count).fill("work"), startDate).when;
}

function seedFrom(post, startDate, afterId) {
  const hooks = hookCandidates(post);
  const heads = outline(post);
  let id = afterId || "";
  /* 글 한 편에서 3편만 뽑습니다. 소제목이 여덟 개여도 셋으로 줄입니다.
     소제목 수에 맞춰 아홉 편까지 늘리던 것을 그만뒀습니다. 이유는 BATCH_STEP 주석에 있습니다.
     어느 소제목을 고를지는 사람이 정합니다. 여기서는 앞의 셋을 뼈대로 깔아만 둡니다. */
  const count = BATCH_STEP;
  const when = scheduleFor(startDate, count);

  const body = when
    .map((at, i) => {
      const angle = heads[i] ? `소재: ${heads[i]}` : "소재: 글에서 하나 더 고르세요";
      const hook = hooks[i] ? `\n     첫 줄 후보: ${hooks[i]}` : "";
      const tail = i === count - 1 ? "\n     마지막 편에서만 블로그 링크를 겁니다." : "";
      const [d, t] = at.split(" ");
      id = nextId(id);
      return `=== ${d} ${id} ${t} work\n<!-- ${angle}${hook}${tail} -->\n(여기에 한 편)\n`;
    })
    .join("\n");

  return `---
source: ${post.slug}
kind: work
---

<!-- 한 편에 한 가지만 담습니다. 각 편은 이것만 봐도 말이 되어야 합니다(앞 편을 안 본 사람이 대부분이라).
     업무 이야기가 연달아 서너 편 이어지면 사이에 일상 편을 끼워 넣으세요.
     일상 편은 content/threads/life-*.md 에 따로 모읍니다. -->

${body}`;
}

/* 번호가 없는 편에 번호를 써 넣고, === 줄을 표준 형태로 정리합니다.
   표준 형태:  === 날짜 번호 시각 성격 상태
   (파서는 순서를 가리지 않지만, 파일을 눈으로 볼 때 자리가 고정돼 있어야 읽힙니다) */
function writeIds(dir) {
  const batches = loadThreads(dir);
  const assigned = fillIds(batches);
  let added = 0;
  batches.forEach((b) => {
    const file = path.join(dir, b.file);
    let seen = 0;
    const out = fs.readFileSync(file, "utf8").replace(/^=== .*$/gm, (line) => {
      seen += 1;
      const m = parseMeta(line.replace(/^=== */, ""));
      const id = m.id || assigned.get(`${b.file}#${seen}`) || "";
      if (!m.id && id) added += 1;
      return metaLine(m, { id });
    });
    fs.writeFileSync(file, out);
  });
  return added;
}

/* 편 하나의 === 줄에 표시를 남깁니다. 고유번호로 찾습니다.
   찾지 못하면 조용히 넘어가지 않고 예외를 던집니다. 표시가 안 남으면 같은 편이 두 번 나갑니다. */
function mark(dir, id, patch) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  for (const f of files) {
    const p = path.join(dir, f);
    const src = fs.readFileSync(p, "utf8");
    let hit = false;
    const out = src.replace(/^=== .*$/gm, (line) => {
      const m = parseMeta(line.replace(/^=== */, ""));
      if (m.id !== id || hit) return line;
      hit = true;
      return metaLine(m, patch);
    });
    if (hit) {
      fs.writeFileSync(p, out);
      return f;
    }
  }
  throw new Error(`${id} 를 찾지 못했습니다. 표시를 못 남기면 같은 편이 또 나갑니다.`);
}

/* 발행한 편에 표시를 남깁니다.
   손으로 올린 뒤 텔레그램에 답장하면 알림 자동화가 그 답장을 읽고 여기를 부릅니다.
   올린 시각을 @ 뒤에 남깁니다. 예약 시각과 실제 시각이 얼마나 벌어졌는지 나중에 볼 수 있게. */
function markPosted(dir, id, when) {
  return mark(dir, id, { status: "posted", postedAt: when || "" });
}

/* "이제 이걸 올리세요" 알림을 보낸 편에 표시를 남깁니다. 상태는 준비됨 그대로입니다.

   알림을 보낸 것과 실제로 올린 것은 다른 일이라 표시를 나눕니다.
   알림만 보고 발행됨으로 적어버리면, 알림을 놓친 편이 올라간 것으로 기록되어 조용히 사라집니다.
   ~ 표시가 하는 일은 하나입니다. 같은 편에 알림을 두 번 보내지 않게 하는 것. */
function markReminded(dir, id, when) {
  return mark(dir, id, { remindedAt: when || "" });
}

/* 관리 화면에서 고친 본문을 파일에 다시 씁니다.
   원고의 원본은 언제나 content/threads 의 마크다운입니다. 화면은 그것을 비추기만 합니다.
   그래서 여기서도 그 파일을 직접 고치고, 나머지 줄은 한 글자도 건드리지 않습니다.

   준비됨(ready) 인 편만 고칠 수 있습니다.
   발행됨은 이미 쓰레드에 올라간 글이라 여기서 고쳐봐야 화면과 실제가 어긋나기만 합니다.
   초안은 아직 뼈대라 에디터에서 통째로 쓰는 편이 낫고요. */
function writeText(dir, id, part, text) {
  /* 브라우저의 편집기가 섞어 넣는 것들을 걷어냅니다.
     줄바꿈은 \n 으로, 안 보이는 공백(nbsp)은 보통 공백으로. 안 그러면 파일에 눈에 안 띄는 글자가 남습니다. */
  const clean = String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) throw new Error("내용이 비어 있습니다.");
  // === 나 --- 를 본문에 넣으면 저장하는 순간 한 편이 두 편으로 쪼개집니다.
  if (/^[ \t]*(===|---)[ \t]*$/m.test(clean)) throw new Error("본문에 === 나 --- 만 있는 줄은 넣을 수 없습니다. 편이 쪼개집니다.");
  if (countChars(clean) > LIMIT) throw new Error(`${countChars(clean)}자입니다. 상한 ${LIMIT}자를 넘어 저장하지 않습니다.`);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  for (const f of files) {
    const p = path.join(dir, f);
    /* 줄 끝이 파일마다 다를 수 있습니다.
       깃이 윈도우에서 체크아웃하면 CRLF 로 쓰고, 이 스크립트가 쓰면 LF 입니다.
       읽을 때 LF 로 맞춰서 다루고, 쓸 때 원래 방식으로 되돌립니다.
       안 그러면 손대지 않은 줄까지 전부 바뀐 것으로 잡혀 무엇을 고쳤는지 알아볼 수 없게 됩니다. */
    const raw = fs.readFileSync(p, "utf8");
    const crlf = /\r\n/.test(raw);
    const lines = (crlf ? raw.replace(/\r\n/g, "\n") : raw).split("\n");

    let head = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (!/^=== /.test(lines[i])) continue;
      const m = parseMeta(lines[i].replace(/^=== */, ""));
      if (m.id !== id) continue;
      if (m.status === "posted") throw new Error(`${id} 은 이미 발행된 편입니다. 여기서는 고칠 수 없습니다.`);
      if (m.status !== "ready") throw new Error(`${id} 은 준비됨 상태가 아닙니다. 에디터에서 여세요.`);
      head = i;
      break;
    }
    if (head < 0) continue;

    let end = lines.length;
    for (let i = head + 1; i < lines.length; i += 1) if (/^=== /.test(lines[i])) { end = i; break; }

    const body = lines.slice(head + 1, end).join("\n");
    /* 메모가 섞인 본문은 손대지 않습니다. 화면에는 메모가 지워진 채로 보이므로
       그대로 저장하면 파일에서 메모가 조용히 사라집니다. */
    if (body.includes("<!--")) throw new Error(`${id} 본문에 메모(<!-- -->)가 있습니다. 파일을 직접 여세요.`);

    // 답글 경계는 남기고 해당 조각만 갈아 끼웁니다. 빈 조각은 편으로 세지 않습니다(splitReplies 와 같은 기준).
    const chunks = body.split(/^[ \t]*---[ \t]*$/m);
    const live = chunks.map((c, i) => (c.trim() ? i : -1)).filter((i) => i >= 0);
    const at = live[Number(part || 1) - 1];
    if (at === undefined) throw new Error(`${id} 에 ${part}번째 조각이 없습니다.`);
    /* 앞뒤 빈 줄은 원래 있던 만큼 그대로 둡니다.
       그래야 안 고치고 저장했을 때 파일이 한 바이트도 안 바뀝니다.
       매번 여백이 한 줄씩 달라지면 무엇을 실제로 고쳤는지 커밋 기록에서 알아볼 수 없게 됩니다. */
    const lead = at === 0 ? "" : (chunks[at].match(/^\n*/) || ["\n"])[0] || "\n";
    const tail = (chunks[at].match(/\n*$/) || ["\n"])[0] || "\n";
    chunks[at] = `${lead}${clean}${tail}`;

    const out = [...lines.slice(0, head + 1), ...chunks.join("---").split("\n"), ...lines.slice(end)].join("\n");
    fs.writeFileSync(p, crlf ? out.replace(/\n/g, "\r\n") : out);
    return { file: f, len: countChars(clean) };
  }
  throw new Error(`${id} 을 찾지 못했습니다.`);
}

/* 아직 안 올린 편들의 날짜와 시각을 요일 규칙에 맞춰 다시 짭니다.

   규칙이 바뀌면 이미 짜둔 큐도 같이 바뀌어야 합니다. 마흔 줄을 손으로 고치면 반드시 실수가 납니다.
   순서는 건드리지 않습니다. 번호와 발행 순서가 어긋나면 앞 편을 가리키며 쓴 문장이 뒤로 갑니다.
   발행한 편은 지나간 기록이라 그대로 둡니다. */
function replan(dir, startDate, ramp, notBefore) {
  const queue = queueOf(loadThreads(dir));
  const todo = queue.filter((p) => p.status !== "posted");
  if (!todo.length) return { moved: 0, warn: [], first: "", last: "" };

  const { when, warn } = planSchedule(todo.map((p) => p.kind), startDate, ramp, notBefore);
  const at = new Map(todo.map((p, i) => [p.id, when[i]]));

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  let moved = 0;
  files.forEach((f) => {
    const p = path.join(dir, f);
    const raw = fs.readFileSync(p, "utf8");
    const crlf = /\r\n/.test(raw);
    const out = (crlf ? raw.replace(/\r\n/g, "\n") : raw).replace(/^=== .*$/gm, (line) => {
      const m = parseMeta(line.replace(/^=== */, ""));
      const slot = at.get(m.id);
      if (!slot || m.status === "posted") return line;
      const [date, time] = slot.split(" ");
      moved += 1;
      return metaLine(m, { date, time });
    });
    fs.writeFileSync(p, crlf ? out.replace(/\n/g, "\r\n") : out);
  });

  return { moved, warn, first: when[0], last: when[when.length - 1] };
}

/* 아직 안 올린 편들의 날짜를 통째로 미룹니다.
   큐를 짜둔 뒤 며칠 미루는 일은 늘 생깁니다. 그때 마흔 줄을 손으로 고치면 실수가 납니다.
   이미 posted 인 편은 건드리지 않습니다. 지나간 기록이라서요. */
function shiftDays(dir, days) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  let moved = 0;
  files.forEach((f) => {
    const p = path.join(dir, f);
    const out = fs.readFileSync(p, "utf8").replace(/^=== .*$/gm, (line) => {
      const m = parseMeta(line.replace(/^=== */, ""));
      if (!m.date || m.status === "posted") return line;
      const d = new Date(`${m.date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      moved += 1;
      return metaLine(m, { date: d.toISOString().slice(0, 10) });
    });
    fs.writeFileSync(p, out);
  });
  return moved;
}

/* ---------- CLI ---------- */
function cli(argv) {
  const { loadPosts } = require("./posts");
  const ROOT = path.join(__dirname, "..");
  const CONTENT = path.join(ROOT, "content");
  const THREADS = path.join(CONTENT, "threads");

  if (argv.includes("--ids")) {
    const added = writeIds(THREADS);
    console.log(added ? `고유번호 ${added}개를 붙였습니다.` : "번호가 빠진 편이 없습니다.");
    return;
  }

  /* 손으로 올린 편에 발행 표시를 남깁니다.  npm run thread -- --posted=AA03
     평소에는 텔레그램에 답장하는 것으로 끝나고, 이건 답장이 안 먹혔을 때 쓰는 손잡이입니다.
     번호를 안 주면 알림만 가고 확인이 안 된 편을 전부 발행됨으로 바꿉니다. */
  const postedArg = argv.find((a) => /^--posted(=[A-Z]{2}\d{2}(,[A-Z]{2}\d{2})*)?$/.test(a));
  if (postedArg) {
    const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16);
    const ids = postedArg.includes("=")
      ? postedArg.split("=")[1].split(",")
      : queueOf(loadThreads(THREADS)).filter((p) => p.status !== "posted" && p.remindedAt).map((p) => p.id);
    if (!ids.length) {
      console.log("확인을 기다리는 편이 없습니다.");
      return;
    }
    ids.forEach((id) => {
      try {
        console.log(`${id} 발행됨 (${now.replace("T", " ")}) · ${markPosted(THREADS, id, now)}`);
      } catch (e) {
        console.error(`[건너뜀] ${e.message}`);
      }
    });
    return;
  }

  const replanArg = argv.find((a) => /^--replan(=\d{4}-\d{2}-\d{2})?$/.test(a));
  if (replanArg) {
    const start = replanArg.includes("=") ? replanArg.split("=")[1] : kstToday();
    /* --ramp=1,1,1 은 시작 며칠의 편수를 요일 규칙 대신 그대로 씁니다.
       계정을 새로 만들어 다시 데우는 동안에만 씁니다. */
    const rampArg = argv.find((a) => /^--ramp=\d+(,\d+)*$/.test(a));
    const ramp = rampArg ? rampArg.split("=")[1].split(",").map(Number) : [];
    /* 오늘부터 다시 짜는 경우에만 지금 시각을 넘깁니다. 이미 지난 시간대에 편이 놓이면
       알림이 안 가거나 다음 회차가 지난 날짜로 보고 멈춥니다. 다음 시부터 잡습니다. */
    const notBefore = start === kstToday() ? kstHour() + 1 : 0;
    const r = replan(THREADS, start, ramp, notBefore);
    console.log(`아직 안 올린 ${r.moved}편의 날짜와 시각을 다시 짰습니다.`);
    console.log(`  ${r.first} 부터 ${r.last} 까지`);
    if (notBefore) console.log(`  오늘은 ${notBefore}시 이후 시간대만 씁니다 (지난 시각에 놓지 않으려고)`);
    if (ramp.length) console.log(`  처음 ${ramp.length}일은 ${ramp.join(" · ")}편 (계정 데우기)`);
    console.log(`  그 뒤로 ${PER_DOW_TEXT}`);
    r.warn.forEach((m) => console.log(`  경고: ${m}`));
    console.log("발행한 편은 건드리지 않았습니다.");
    return;
  }

  const shift = argv.find((a) => /^--shift=-?\d+$/.test(a));
  if (shift) {
    const days = Number(shift.split("=")[1]);
    const moved = shiftDays(THREADS, days);
    console.log(`아직 안 올린 ${moved}편을 ${days > 0 ? `${days}일 뒤로` : `${-days}일 앞으로`} 옮겼습니다.`);
    console.log("발행한 편은 건드리지 않았습니다.");
    return;
  }

  const posts = loadPosts(path.join(CONTENT, "posts-kr"));
  const batches = loadThreads(THREADS);
  const queue = queueOf(batches);
  const stats = queueStats(queue);
  const args = argv.filter((a) => !a.startsWith("-"));

  if (!args.length) {
    console.log(`큐: 남은 ${stats.left}편 (업무 ${stats.work} · 일상 ${stats.life} / 준비됨 ${stats.ready} · 초안 ${stats.draft}), 발행 ${stats.posted}편`);
    if (stats.undated) console.log(`  날짜 없는 편 ${stats.undated}개`);
    if (stats.waiting) {
      const wait = queue.filter((p) => p.status !== "posted" && p.remindedAt);
      console.log(`  알림만 가고 발행 확인이 안 된 편 ${stats.waiting}개: ${wait.map((p) => p.id).join(", ")}`);
      console.log("    올렸으면 텔레그램에 답장하거나  npm run thread -- --posted");
    }
    if (stats.longestWorkRun >= 4) console.log(`  업무 글이 연속 ${stats.longestWorkRun}편입니다. 사이에 일상 편을 끼우세요.`);
    batchIssues(batches).forEach((m) => console.log(`  ${m}`));

    const next = queue.filter((p) => p.status !== "posted").slice(0, 5);
    if (next.length) {
      console.log("\n다음에 나갈 순서:");
      next.forEach((p) => {
        const head = (p.parts[0] ? p.parts[0].text : "").split("\n")[0].slice(0, 34);
        console.log(`  ${(p.at || "날짜미정").padEnd(17)} ${KIND[p.kind]}  ${head}...`);
      });
    }

    const covered = new Set(batches.map((b) => b.source).filter(Boolean));
    const todo = posts.filter((p) => !p.draft && !covered.has(p.slug));
    if (todo.length) {
      console.log("\n아직 안 쓴 소재(블로그 글):");
      todo.forEach((p) => console.log(`  ${p.slug}\n    ${p.title}`));
      console.log(`\n배치 만들기:  npm run thread ${todo[0].slug}`);
    }
    return;
  }

  /* 시작 날짜는 인자로 받습니다. 안 주면 큐의 맨 뒤 다음 날입니다.

     오늘로 두면 안 됩니다. 큐는 보통 2~3주치가 이미 차 있어서, 오늘부터 날짜를 매기면
     새 배치가 이미 자리를 잡은 편들 사이에 끼어들어 갑니다. 같은 날 21:28 과 21:29 처럼
     1분 간격으로 두 편이 놓이고, 무엇보다 오늘 쓴 글의 편들이 2주 전 글의 편들보다
     먼저 나갑니다. 쓰레드는 블로그 글이 나온 순서대로 흘러야 합니다.
     맨 뒤에 붙여 놓고 --replan 으로 당기는 것이 순서를 안 깨는 유일한 방향입니다. */
  const startArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const last = queue.filter((p) => p.date).map((p) => p.date).sort().pop();
  const tail = last ? iso(addDay(new Date(`${last}T00:00:00Z`), 1)) : kstToday();
  const start = startArg || tail;

  args.filter((a) => a !== startArg).forEach((slug) => {
    const post = posts.find((p) => p.slug === slug);
    if (!post) {
      console.error(`[건너뜀] ${slug} : 그런 글이 없습니다. (인자 없이 실행하면 목록이 나옵니다)`);
      return;
    }
    const out = path.join(THREADS, `${slug}.md`);
    if (fs.existsSync(out)) {
      // 덮어쓰기는 하지 않습니다. 손으로 쓴 원고가 한 번의 오타로 날아가는 쪽이 훨씬 비쌉니다.
      console.error(`[건너뜀] ${slug} : 배치가 이미 있습니다. ${path.relative(ROOT, out)}`);
      return;
    }
    fs.mkdirSync(THREADS, { recursive: true });
    // 이미 쓰인 번호 다음부터 이어 붙입니다
    const used = loadThreads(THREADS).flatMap((b) => b.posts.map((p) => p.id)).filter(Boolean).sort();
    fs.writeFileSync(out, seedFrom(post, start, used[used.length - 1] || ""), "utf8");
    console.log(`만들었습니다: ${path.relative(ROOT, out)} (${start} 부터${startArg ? "" : ", 큐 맨 뒤"})`);
  });

  console.log("\n원고를 채운 뒤에 날짜를 당깁니다. 그 전에는 큐 맨 뒤에 그대로 둡니다.");
  console.log(`  npm run thread -- --replan=${kstToday()}`);
  console.log("\n관리 페이지의 쓰레드 탭에서 나갈 순서와 편별 글자 수를 봅니다.");
  console.log("  npm run dev → http://localhost:4000/admin");
}

if (require.main === module) cli(process.argv.slice(2));

module.exports = { LIMIT, SOFT, BATCH_STEP, STATUS, KIND, loadThreads, queueOf, queueStats, checkPost, batchIssues, countChars, seedFrom, scheduleFor, nextId, fillIds, writeIds, markPosted, markReminded, writeText, planSchedule, replan };

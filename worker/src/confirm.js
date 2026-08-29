/* 답장을 읽어 발행 표시를 남길 편을 고릅니다.
   scripts/threads-remind.js 의 matchConfirms 를 그대로 옮겼습니다.

   답장 하나가 편 하나를 확인합니다. 어느 편인지는 이 순서로 찾습니다.
     1. 답장 본문에 적은 번호(AA03). 적었는데 확인 대기에 없으면 그 답장은 버립니다.
        "AA03 올렸음" 을 엉뚱한 편의 확인으로 쓰는 것보다 아무 일도 안 하는 쪽이 낫습니다.
     2. 답장이 달린 원래 메시지. 안내문 통이면 거기 번호가, 원고 통이면 원고가 들어 있습니다.
     3. 아무 통에나 그냥 보낸 답장이면 확인 대기 중 가장 오래된 편.

   반드시 알림을 보낸 시각보다 뒤에 온 답장만 봅니다. 텔레그램은 확인 안 한 답장을
   24시간 계속 돌려주기 때문에, 이 조건이 없으면 어제 보낸 "ㅇ" 하나가 오늘 알림까지
   올린 것으로 만듭니다. */

const ID_IN = /\b[A-Za-z]{2}\d{2}\b/g;
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const stampAt = (s) => new Date(`${s}:00+09:00`).getTime();

export function matchConfirms(pending, msgs) {
  const left = [...pending].sort((a, b) => stampAt(a.remindedAt) - stampAt(b.remindedAt));
  const hits = [];
  msgs.forEach((m) => {
    // 안 올렸다는 답장은 확인으로 치지 않습니다. 그 편은 확인 대기로 그대로 둡니다.
    if (/취소|안\s*올|나중|\bskip\b|\bno\b/i.test(m.text)) return;
    const fresh = (p) => m.at >= stampAt(p.remindedAt);
    const quoted = norm(m.replyText);

    const said = (m.text.match(ID_IN) || [])[0];
    let i = said ? left.findIndex((p) => p.id === said.toUpperCase() && fresh(p)) : -1;
    if (said && i < 0) return;

    if (i < 0 && quoted) {
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

    if (i < 0 && !quoted) i = left.findIndex(fresh);
    if (i < 0) return;

    const [p] = left.splice(i, 1);
    hits.push({ id: p.id, at: m.at, text: m.text });
  });
  return { hits, left };
}

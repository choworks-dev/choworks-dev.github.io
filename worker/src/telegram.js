/* 텔레그램으로 보냅니다. 값이 없으면 보내지 않고 false 를 돌려줍니다 —
   원본과 같은 규칙입니다(값 없이 켜도 큐가 조용히 소모되지 않게). */
export async function send(env, text) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`텔레그램 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

/* 답장을 읽습니다. offset 을 쓰지 않고 매번 처음부터 받습니다 — 원본과 같은 방식입니다.
   텔레그램은 확인하지 않은 업데이트를 24시간 돌려주므로 같은 답장을 여러 번 보게 되는데,
   부르는 쪽이 "알림 시각보다 뒤에 온 답장" 만 세고, 한 번 발행 표시가 남으면 그 편은
   확인 대기에서 빠지므로 두 번 세지 않습니다.

   offset 으로 지워버리면 오히려 위험합니다. 우리가 읽고 처리에 실패한 답장이
   영영 사라져 그 편이 확인 안 된 채 남습니다. */
export async function getUpdates(env) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return [];
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getUpdates?limit=100`);
  if (!res.ok) throw new Error(`텔레그램 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const chat = String(env.TELEGRAM_CHAT_ID);
  return (body.result || [])
    .map((u) => u.message || u.edited_message)
    .filter((m) => m && m.text && String(m.chat && m.chat.id) === chat)
    .map((m) => ({
      at: m.date * 1000,
      text: String(m.text).trim(),
      /* 답장이 달린 원래 메시지의 글. 안내문 통이면 편 번호가, 원고 통이면 원고가 들어 있어
         답장 본문("ㅇ") 보다 어느 편인지 훨씬 정확하게 가리킵니다. */
      replyText: String((m.reply_to_message && m.reply_to_message.text) || "").trim(),
    }))
    .sort((a, b) => a.at - b.at);
}

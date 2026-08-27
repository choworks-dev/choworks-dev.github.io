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

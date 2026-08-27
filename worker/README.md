# 쓰레드 알림 워커

깃허브 액션이 하던 예약 알림을 Cloudflare Worker 로 옮기는 중입니다.

## 왜 옮기는가

저장소를 비공개로 돌리면 액션이 **분 단위로 과금**됩니다(무료 2,000분/월).
그런데 지금 알림 워크플로는 예약 시각까지 **최대 120분을 자면서 기다립니다**.
깃허브 크론이 시각을 안 지켜주기 때문에 그렇게 짠 것입니다.

10분마다 × 평균 23분 = 월 9만 분. 공개 저장소라 공짜였을 뿐, 비공개로 가면
감당할 수 없습니다. **무료라서 허용된 설계이지 좋은 설계가 아니었습니다.**

워커 크론은 매분 돌 수 있어서 기다릴 이유가 없습니다. 자는 코드가 통째로 사라집니다.

## 지금 어디까지 왔나

**1단계 — 읽기만 합니다.** 판단은 하지만 저장소에는 아무것도 쓰지 않고,
텔레그램 알림에 `[모의]` 를 붙여 보냅니다. 액션과 같은 결론을 내는지
며칠 대조한 뒤에 권한을 줍니다.

- [x] 큐 파서 이식 — `scripts/threads.js` 원본과 39편 전부 본문까지 동일한 것 확인
- [x] 판단 로직 이식 (안전장치 5개)
- [ ] 배포 · 대조
- [ ] 2단계: 저장소에 `~` `@` 표시 남기기, 텔레그램 답장 읽기
- [ ] 액션의 `schedule:` 제거

## 옮겨온 안전장치

계정을 지키는 규칙입니다. **지우지 마십시오.** 첫 계정이 개설 다음 날 정지됐고,
사유는 편수가 아니라 몰아치는 활동량이었습니다.

- 한 번에 한 편만
- `status: ready` 인 편만. `draft` 는 건드리지 않는다
- 큐에서 가장 이른 편부터. 건너뛰지 않는다
- **지난 날짜의 편은 보내지 않고 멈춘다**
- 하루 상한(`DAILY_CAP = 4`)을 넘기면 보내지 않는다

`worker/src/queue.js` 는 `scripts/threads.js` 의 사본입니다. **한쪽만 고치면
같은 큐를 두 곳이 다르게 읽습니다.** 파서를 건드릴 일이 생기면 양쪽을 함께 고치고
대조 스크립트를 다시 돌리십시오.

## 준비

```bash
npx wrangler login
npx wrangler kv namespace create STATE     # 결과 id 를 wrangler.toml 에 넣습니다
npx wrangler secret put GITHUB_TOKEN       # contents:read
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler deploy
```

## 확인

```bash
npx wrangler tail                # 매분 판단을 그대로 봅니다
curl https://choworks-threads.<계정>.workers.dev/   # 지금 무엇을 할지 한 줄로
```

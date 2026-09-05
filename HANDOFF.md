# choworks.dev 인수인계

**작성 2026-09-05, MA4 오준서 (macmini-2018). 이 문서가 없어 13조 위반이었다.**
여기 적힌 것은 그날 이 머신에서 **직접 재 본 것**이다. 재지 못한 것은 그렇게 적었다.

    저장소   git@github.com:choworks-dev/choworks-dev.github.io   **공개**
    폴더     ~/GitHub/choworks-dev/choworks-dev.github.io
    사이트   https://choworks.dev   (GitHub Pages · Cloudflare 는 DNS 만)
    담당     MA4 오준서 (macmini-2018)
    코드     CD  (coworks 이슈 접두사)

---

## 이 저장소는 **공개**다 — 가장 먼저 알 것

`git add -A` 한 번이면 그대로 세상에 나간다. `.gitignore` 가 그 방어이고,
**그 안의 주석이 실제 사고 기록이다.** 고치기 전에 반드시 읽을 것.

막아 둔 것: `.env.threads` · `.env.analytics` · `.gcp-*.json` · `CLAUDE.md` ·
`README.local.md` · `NAVER.local.md` · `.gsc-profile/` · `.naver-profile/` ·
뿌리의 `screen-*.jpg|png`.

**`/screen-*` 의 앞 `/` 는 뿌리만 막으라는 뜻이다.** 없애면 어느 깊이에서나 걸려
`assets/images/` 의 발행용 이미지까지 삼킨다. 그러면 글에 그림만 안 나오고 오류는 안 난다.

### 2026-09-05 에 지운 것 — 같은 함정을 다시 파지 말 것

`git-server-guide.html` 이 있었다. 집 안 Git 서버에 붙는 절차서였고, 커밋 `e029c7a` 본문은
"사이트 빌드는 content/ 와 assets/ 만 읽으므로 choworks.dev 에는 배포되지 않는다" 고
적고 있었다. **그 말 자체는 맞았다.** 실측으로도 사이트에서는 404 였다.

그런데 **저장소가 공개라 raw 주소로는 로그인 없이 200 이었다.**

    배포되지 않는 것 ≠ 공개되지 않는 것

그 안에 집 안 서버의 호스트명·사설 대역 주소·서비스 포트·계정명이 있었다. 사설 대역이라
밖에서 바로 닿지는 않는다(정찰 정보이지 접근 경로는 아니다). 그래서 이력 수술은 하지 않고
현행 커밋에서만 지웠다 — **PM(ID1) 판단 2026-09-05.**

**여기에 그 값들을 옮겨 적지 않았다.** 옮겨 적으면 지적하려던 노출을 이 문서가 한 번 더 한다.

**이 저장소에 무언가 적을 때마다 "이것이 공개되어도 되는가" 를 먼저 묻는다.**
"사이트에 안 올라간다" 는 답이 되지 않는다.

---

## 어떻게 발행되는가 — **이 머신이 필요 없다**

klausdream 과 여기가 가장 크게 다른 점이다. 발행이 전부 GitHub Actions 안에서 돈다.
로컬 자격증명도, 켜 둘 타이머도 없다.

| 워크플로 | 언제 | 무엇 |
|---|---|---|
| `deploy.yml` | main 푸시 | 빌드 후 Pages 배포. `CC_DEPLOY=1` 로 짓는다 |
| `publish-due.yml` | 10분마다 | `publishAt` 이 찬 `draft: true` 글의 draft 를 지우고 푸시 |
| `stats.yml` · `verify-live.yml` · `threads-*.yml` | 각자 일정 | 방문기록·라이브 점검·쓰레드 |

`deploy.yml` 의 `paths-ignore` 에 `content/stats.json` 등이 있다. **방문기록이 갱신돼도
재배포하지 않는다** — 그래서 `[skip ci]` 커밋이 HEAD 에 있어도 사이트는 그 전 것이 맞다.

**발행하려면 커밋하고 푸시하면 된다.** 그 외에 사람이 할 일이 없다.

---

## 2026-09-05 실측 상태

    HEAD        f38f42e  "방문·검색 기록 갱신 [skip ci]"   미커밋 0
    원고        posts-kr 13 · posts-en 13 · 그중 draft: true 6
    예약        publishAt 걸린 글 **0편**
    빌드        npm ci -> npm run build  통과. 10 KO + 10 EN, 24 URL, 109 파일

**라이브와 바이트 대조까지 했다.** `CC_DEPLOY=1` 로 지으면
`/` · `/en/` · `/sitemap.xml` · `/feed.xml` 네 개가 **라이브와 md5 까지 같다.**
`/admin` 은 배포 산출물에서 빠지는 것도 확인했다.

### 여기서 한 번 잘못 판정했다 — 같은 함정을 밟지 말 것

`CC_DEPLOY` 없이 지어서 라이브와 견주면 `/` 가 **364바이트 다르게** 나온다.
Cloudflare 비컨과 네이버 wcslog 가 빠지기 때문이다. 이것을 "라이브가 앞서 있다" 거나
"분석이 빠졌다" 로 읽으면 틀린다. `scripts/build.js` 의 `webAnalytics()` 가
`if (!DEPLOY || !token) return ""` 로 **일부러** 뺀다 — 로컬에서 새로고침한 것을
방문으로 세면 숫자를 못 믿게 되기 때문이다.

**라이브와 견줄 때는 반드시 `CC_DEPLOY=1` 로 짓는다.**

---

## 함정으로 적어 둘 것

- **`node_modules` 는 git 에 없다.** 새 클론에서는 `npm ci` 를 먼저 한다.
  klausdream 에서는 이것을 빠뜨렸을 때 도구가 "콘텐츠가 막혔다" 로 잘못 보고했다.
  여기서도 도구가 조용히 다르게 굴 수 있으니 **파일이 있다로 끝내지 말고 돌려 볼 것**
- **`site/` 는 gitignore 다.** 푸시만으로 사이트가 바뀌는 것은 맞지만(Actions 가 짓는다),
  로컬 `site/` 는 클론 직후 없다
- Cloudflare 비컨의 **site tag 와 토큰은 다른 값이다.** 형식이 똑같이 생겼고,
  site tag 를 넣으면 스크립트는 멀쩡히 로드되고 **데이터만 어디에도 안 쌓인다**
  (`scripts/build.js` 주석에 그대로 적혀 있다)

---

## 다음에 할 일

1. 이 문서를 세션 끝날 때마다 갱신한다(13조). 없어서 오늘 처음 만들었다
2. GitHub Actions 실행 이력을 실측한다(`gh run list`). 아래 "재지 못한 것" 참조

## 재지 못한 것 (짐작으로 채우지 않는다)

- **GitHub Actions 실행 이력을 못 봤다.** `gh` 로 최근 실행 성공/실패를 확인하지 않았다.
  워크플로 파일이 있다는 것과 실제로 돌고 있다는 것은 다르다
- 쓰레드(Threads) 연동이 지금 살아 있는지 재지 않았다. 토큰 만료 여부 미확인
- `content/drafts/` 6개와 `draft: true` 6개가 같은 것인지 대조하지 않았다

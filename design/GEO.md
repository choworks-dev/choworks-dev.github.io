# GEO — 생성형 엔진 최적화 제안

AI 답변(ChatGPT · Claude · Perplexity 등)에 우리 글이 인용되게 하는 작업입니다.
지역 타깃팅(geo-targeting)이 아니라 Generative Engine Optimization 을 말합니다.

적어 둔 날: 2026-08-27. 아직 **아무것도 적용하지 않았습니다.** 제안 단계입니다.

블로그 글 초안으로도 옮겨 두었습니다: `content/drafts/2026-08-27-geo-ai-answer-optimization.md`

## 지금 상태

일반 SEO 는 이미 갖춰져 있습니다. `scripts/build.js` 안에 canonical, hreflang(ko/en/x-default),
sitemap.xml, feed.xml, robots.txt, BlogPosting JSON-LD 가 전부 들어가 있습니다.
그래서 GEO 는 새로 만드는 일이 아니라 빈 곳을 메우는 일입니다.

## 기계가 읽는 부분 — build.js 손보기

### 1. llms.txt 를 낸다
사이트가 무엇이고 글이 어떤 것들인지 AI 크롤러가 한 파일로 읽어 갑니다.
`content/site.json` 에 설명이 있고 글 목록도 빌드가 이미 알고 있으니,
sitemap 찍어내듯 `write("llms.txt", ...)` 를 옆에 붙이면 됩니다.

### 2. robots.txt 에 AI 크롤러를 이름으로 허용한다
지금은 `User-agent: *` 전체 허용이라 기술적으로는 이미 열려 있습니다.
GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot 을 명시하면 의사가 분명해지고,
나중에 일부만 막고 싶을 때 고칠 자리가 생깁니다. (`build.js` 끝부분 `write("robots.txt", ...)`)

### 3. RSS 를 전문 발행으로 바꾼다
확인해 보니 `buildFeed()` 가 `<description>` 에 머리말의 description 한 줄만 넣습니다.
요약만 나가면 인용할 본문이 없습니다. `<content:encoded>` 로 본문 HTML 을 실어 보냅니다.

### 4. dateModified 를 실제 수정일로 분리한다
`postJsonLd()` 가 datePublished 와 dateModified 에 같은 값(`post.stamp`)을 넣습니다.
글을 고쳐도 최신성이 전달되지 않습니다. 그 파일의 마지막 커밋 시각을 쓰면 됩니다.

### 5. sameAs 에 쓰레드 계정을 넣는다
`site.json` 에 `threadsUrl` 이 있는데 `authorNode()` 의 sameAs 에는 github 만 들어갑니다.
같은 사람이라는 신호가 하나 더 생깁니다.

1~5 는 전부 `build.js` 한 파일이라 한 번에 처리할 수 있습니다.

## 글의 모양 — 사실 이쪽이 더 크게 작용한다

- **글머리에 세 줄 요약.** AI 는 결론 문단을 통째로 인용하는 경향이 있습니다.
- **소제목을 질문형으로.** "게시판 구조" 보다 "세션 네 개가 서로를 모르면 무슨 일이 생기나"
  가 질문 검색에 걸립니다.
- **구체적 수치를 본문에 남긴다.** `publish-due.yml` 주석의
  "128번 돌아야 할 것이 17번 돌았고 평균 간격 80분, 최대 214분" 같은 문장이
  정확히 AI 가 인용하는 형태입니다. 이건 이미 대표님 글의 강점이라 방향만 유지하면 됩니다.

## 급하지 않은 것

FAQ 성격의 글에는 FAQPage JSON-LD 가 도움이 되지만, 지금 글 성격에는 우선순위가 낮습니다.

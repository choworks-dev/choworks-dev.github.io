/* ============================================================
   표지 그림 만들기

       npm run hero            전부 다시 만듭니다
       npm run hero -- 슬러그   그 글 것만

   글마다 맨 위에 오는 표지 그림(히어로)을 assets/diagrams/ 에 네 벌로 만듭니다.
   한국어 가로 · 한국어 세로 · 영문 가로 · 영문 세로.

       hero-<슬러그>.svg          900x300  넓은 화면
       hero-<슬러그>-narrow.svg   360x320  폰(560px 이하)
       hero-<슬러그>-en.svg
       hero-<슬러그>-en-narrow.svg

   본문에서는 머리말 바로 밑에 한 줄 적습니다. scripts/diagram.js 가 펴 넣습니다.

       {{svg: hero-<슬러그>}}         (영문판은 {{svg: hero-<슬러그>-en}})

   왜 손으로 안 그리고 여기서 찍어내는가.
   글 한 편에 네 벌이라 여덟 편이면 서른두 개입니다. 손으로 그리면 테두리 두께나 점 무늬
   간격 같은 것이 파일마다 조금씩 어긋나고, 그러면 글마다 표지가 다른 사이트처럼 보입니다.
   테두리 · 그러데이션 · 점 무늬 · 빛무리 · 오른쪽 위 칩 · 아래 캡션은 전부 여기서 한 번만
   정의하고, 글마다 다른 것은 가운데 그림(motif) 하나뿐입니다.

   색은 전부 사이트 변수(--card --border --muted --accent)로 받습니다.
   그래야 다크/라이트 토글을 따라옵니다. <img> 로 걸면 그림이 페이지의 CSS 를 못 봐서
   토글을 눌러도 그림만 안 바뀝니다. 그래서 diagram.js 가 통째로 펴 넣습니다.

   data-standalone 이 붙은 것은 펴 넣을 때 빠집니다. 파일을 그냥 열어봤을 때만 필요한
   배경색과 OS 테마용 색 지정입니다. 이게 페이지에 남으면 OS 는 라이트인데 사이트를
   다크로 보는 사람에게 그림만 하얗게 나옵니다.

   id 앞에 hero-<약칭>-w / -n 을 붙입니다. 가로와 세로가 한 페이지에 같이 들어가기 때문에
   id 가 겹치면 뒤에 온 쪽이 앞의 것을 가리켜 엉뚱한 그림이 나옵니다.

   표지에 지켜야 하는 것은 README.md 의 "글마다 표지 그림을 넣습니다" 에 적혀 있습니다.
   요약하면 셋입니다. 숫자와 고유명사를 넣지 않는다. 본문을 요약하지 않는다.
   글마다 다른 모양이어야 한다.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "diagrams");

const KO_FONT = "system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const EN_FONT = "system-ui,'Segoe UI',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

const WIDE = { w: 900, h: 300, mode: "w" };
const NARROW = { w: 360, h: 320, mode: "n" };

/* 색은 이름으로만 씁니다. 값은 사이트가 정합니다.
   뒤의 기본값은 CSS 변수를 못 읽는 환경(파일을 그냥 열어본 경우)에서만 쓰입니다. */
const C = "var(--card,#161c26)";
const B = "var(--border,#232b38)";
const M = "var(--muted,#9aa7bd)";
const A = "var(--accent,#6ee7b7)";

const n = (v) => Math.round(v * 100) / 100;

/* 카드 한 장. 표지의 기본 단위입니다. 기록이든 단계든 화면이든 전부 이 모양에서 나옵니다. */
function card(x, y, w, h, o = {}) {
  const st = o.accent ? A : B;
  const sw = o.accent ? 2 : 1.4;
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  const rx = o.rx === undefined ? 6 : o.rx;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${C}" stroke="${st}" stroke-width="${sw}"${op}/>`;
}
/* 글자 대신 놓는 줄. 표지에 진짜 글을 넣으면 언어마다 그림을 다시 그려야 합니다. */
function bar(x, y, w, o = {}) {
  const f = o.fill || M;
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  const h = o.h || 3.6;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${h}" rx="${h / 2}" fill="${f}"${op}/>`;
}
function dot(cx, cy, r, o = {}) {
  const f = o.fill || M;
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${f}"${op}/>`;
}
function ring(cx, cy, r, o = {}) {
  const st = o.stroke || M;
  const sw = o.sw || 1.6;
  const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  const fill = o.fill || "none";
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${st}" stroke-width="${sw}"${dash}${op}/>`;
}
/* 채워지는 도형. 사람 옆얼굴이나 물건처럼 덩어리로 보여야 하는 것에 씁니다.
   선만으로 그리면 배경의 점 무늬가 비쳐서 형태가 안 잡힙니다. */
function shape(d, o = {}) {
  const f = o.fill || C;
  const st = o.stroke || M;
  const sw = o.sw === undefined ? 1.8 : o.sw;
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  const lj = o.join ? ` stroke-linejoin="${o.join}"` : ` stroke-linejoin="round"`;
  return `<path d="${d}" fill="${f}" stroke="${st}" stroke-width="${sw}"${lj}${op}/>`;
}
function line(d, o = {}) {
  const st = o.stroke || M;
  const sw = o.sw || 1.6;
  const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
  const op = o.op === undefined ? "" : ` opacity="${o.op}"`;
  const mk = o.arrow ? ` marker-end="url(#${o.arrow})"` : "";
  return `<path d="${d}" fill="none" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"${dash}${op}${mk}/>`;
}
/* 카드 안에 넣는 글자 자리. 길이를 조금씩 다르게 줘야 찍어낸 것처럼 안 보입니다. */
function cardLines(x, y, w, seed = 0) {
  const a = [0.62, 0.48, 0.7, 0.55, 0.66, 0.42][seed % 6];
  const b = [0.38, 0.6, 0.44, 0.7, 0.36, 0.58][seed % 6];
  return dot(x + 12, y, 3.3, { op: 0.9 }) + bar(x + 25, y - 5.6, w * a) + bar(x + 25, y + 2.4, w * b);
}

/* ------------------------------------------------------------
   틀. 글마다 다른 것은 가운데 그림뿐이고 나머지는 전부 여기서 나옵니다.
   ------------------------------------------------------------ */
function chrome(spec, box, lang) {
  const P = `hero-${spec.key}-${box.mode}-`;
  const { w, h } = box;
  const wide = box.mode === "w";
  const font = lang === "en" ? EN_FONT : KO_FONT;
  const t = spec[lang];

  const chipFs = wide ? 12 : 11.5;
  const chipW = Math.round(spec.chip.length * (wide ? 7.4 : 7.1) + 30);
  const chipH = wide ? 26 : 24;
  const chipX = w - (wide ? 36 : 22) - chipW;
  const chipY = wide ? 24 : 22;

  const cap = wide
    ? `<text x="${w / 2}" y="${h - 23}" fill="${M}" font-size="12.5" text-anchor="middle" style="letter-spacing:0.06em">${t.caption.join(" · ")}</text>`
    : `<g fill="${M}" font-size="12" text-anchor="middle" style="letter-spacing:0.05em">` +
      `<text x="${w / 2}" y="${h - 40}">${t.caption[0]}</text>` +
      `<text x="${w / 2}" y="${h - 21}">${t.caption[1]}</text></g>`;

  const g = spec.glow[box.mode];
  const a11y = wide
    ? `role="img" aria-labelledby="${P}t ${P}d"`
    : `role="img" aria-label="${t.desc}"`;
  const heads = wide ? `\n  <title id="${P}t">${t.title}</title>\n  <desc id="${P}d">${t.desc}</desc>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${a11y} style="font-family:${font}">${heads}
  ${spec.note[lang]}
  <style data-standalone>
    svg { --card:#ffffff; --bg-soft:#f5f7fa; --border:#e2e8f0; --text:#16202e; --muted:#5a6b83; --accent:#0f9d76; --bg:#ffffff; }
    @media (prefers-color-scheme: dark) {
      svg { --card:#161c26; --bg-soft:#141922; --border:#232b38; --text:#e6ebf3; --muted:#9aa7bd; --accent:#6ee7b7; --bg:#0e1116; }
    }
  </style>
  <rect data-standalone x="0" y="0" width="${w}" height="${h}" fill="var(--bg,#ffffff)"/>
  <defs>
    <linearGradient id="${P}panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--bg-soft,#141922)"/>
      <stop offset="0.55" stop-color="var(--bg-soft,#141922)"/>
      <stop offset="1" stop-color="var(--bg,#0e1116)"/>
    </linearGradient>
    <radialGradient id="${P}glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${A}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${A}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${P}dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.2" r="1.2" fill="${M}" opacity="0.16"/>
    </pattern>
    <clipPath id="${P}clip"><rect x="0" y="0" width="${w}" height="${h}" rx="14"/></clipPath>
    <marker id="${P}am" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${M}"/>
    </marker>
    <marker id="${P}aa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${A}"/>
    </marker>
  </defs>
  <g clip-path="url(#${P}clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${P}panel)"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${P}dots)"/>
    <ellipse class="hero-glow" cx="${g[0]}" cy="${g[1]}" rx="${g[2]}" ry="${g[3]}" fill="url(#${P}glow)"/>
  </g>
  <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="14" fill="none" stroke="${B}" stroke-width="1.5"/>
  ${spec.motif(box, P)}
  <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${chipH / 2}" fill="none" stroke="${B}" stroke-width="1.4"/>
  <text x="${chipX + chipW / 2}" y="${chipY + chipH / 2 + 4.5}" fill="${M}" font-size="${chipFs}" font-weight="600" text-anchor="middle" style="font-family:${MONO};letter-spacing:0.08em">${spec.chip}</text>
  ${cap}
</svg>
`;
}

module.exports = { chrome, shape, card, bar, dot, ring, line, cardLines, n, C, B, M, A, WIDE, NARROW, OUT };

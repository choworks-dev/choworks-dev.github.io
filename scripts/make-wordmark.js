/* ============================================================
   워드마크 만들기
   실행:  npm run wordmark

   만들어지는 것 (design/logo/wordmark/ · 커밋되지만 배포되지 않음)
     wordmark-nowing-dark.svg         어두운 테마 · 브랜드 그라데이션
     wordmark-nowing-light.svg        밝은 테마 · 브랜드 그라데이션
     wordmark-nowing-dark-solid.svg   어두운 테마 · 본문 글자색 단색
     wordmark-nowing-light-solid.svg  밝은 테마 · 본문 글자색 단색

   원본은 design/logo/kadechodev-no-wing-logo.svg 입니다.
   design/ 은 커밋되지만 사이트에 올라가지 않습니다. assets/ 는 통째로 배포되는 폴더라
   원본과 작업 파일을 거기 두면 그대로 공개 주소로 열립니다.

   ---------- 원본이 어떻게 생겼는지 ----------
   글자 10개 + 점 + "가리개" 2개로 되어 있습니다.

   가리개는 K 와 V 의 날개를 덮어 감추는 흰색 도형입니다. 날개를 지운 게 아니라 덮은 것이라,
   원본 그대로 쓰면 어두운 테마에서 흰 얼룩 두 개가 남습니다.
   그래서 여기서는 덮지 않고 마스크로 그 부분을 실제로 뚫습니다. 배경이 무엇이든 비칩니다.

   점 둘레의 간격도 같은 방법으로 처리합니다. 점(x 883~917)이 앞 글자 O(~900)와
   뒤 글자 D(910~)에 실제로 겹쳐 있어서, 사이를 뚫지 않으면 셋이 한 덩어리로 뭉칩니다.
   원본은 흰 링을 덧그려 해결했는데, 그것도 배경색을 타므로 마스크로 바꿨습니다.

   결과물은 배경이 비치는 진짜 투명 SVG 라 어디에 올려도 됩니다.

   ---------- 색 ----------
   assets/style.css 의 테마 토큰에서 가져옵니다. 거기를 고쳤으면 아래 THEMES 도 고치고 다시 실행하세요.

   날개가 있던 예전 판은 design/logo/wordmark/wordmark-{dark,light}[-solid].svg 로 남겨 두었습니다.
   원본은 design/logo/kadechodev-withdot-logo.svg 입니다. 이 스크립트는 그쪽을 다시 만들지 않습니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "design", "logo", "kadechodev-no-wing-logo.svg");
/* 결과물은 design/ 아래에 둡니다. 헤더 로고가 글자로 바뀌면서 사이트는 이 파일들을
   더 이상 쓰지 않는데, assets/ 는 통째로 배포되는 폴더라 거기 두면 안 쓰는 그림이
   공개 주소로 계속 열립니다. design/ 은 커밋은 되고 배포에는 안 실립니다. */
const OUT = path.join(ROOT, "design", "logo", "wordmark");

/* 워드마크는 "글자를 그림으로 그린 것"입니다. 화면 낭독기에 읽어 줄 말은 사이트 이름이 아니라
   그림에 실제로 그려진 글자여야 합니다. 원본(SRC)이 kadecho.dev 를 그리고 있으므로 이 값도
   kadecho.dev 입니다. 여기를 site.brand 에 묶으면 도메인만 바꿨을 때 그림은 옛 글자를 그린 채
   라벨만 새 도메인이라고 말하게 됩니다.
   로고 글자를 바꾸려면 design/logo 의 원본을 다시 그려야 하고, 그때 이 값도 같이 고칩니다. */
const ARTWORK = "kadecho.dev";

/* style.css 와 맞춰야 하는 값
     accent / accent2  --accent, --accent-2  (브랜드 그라데이션. .grad 가 쓰는 것과 같은 값)
     text              --text                (본문 글자색) */
const THEMES = {
  dark: { accent: "#6ee7b7", accent2: "#7aa2ff", text: "#e6ebf3" },
  light: { accent: "#0f9d76", accent2: "#3b6fe0", text: "#16202e" },
};

const VIEW = { x: 189, y: 263, w: 1036, h: 249 };
const FLIP = "matrix(1,0,0,-1,0,768)"; // 원본이 y 가 위로 크는 좌표계입니다
const DOT = { cx: 899.95929, cy: -324.30234, rx: 17.424419, ry: 17.639534 };
const GAP = 6.6; // 점 둘레에 뚫을 간격의 두께

const src = fs.readFileSync(SRC, "utf8");
const all = [...src.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
if (all.length !== 12) {
  throw new Error(`경로가 12개가 아닙니다(${all.length}개). 글자 10 + 가리개 2 를 기대합니다. 원본이 바뀌었는지 확인하세요.`);
}
const letters = all.slice(0, 10);
const covers = all.slice(10); // K·V 날개를 덮던 흰 도형. 여기서는 뚫는 데 씁니다.

function build({ fill, gradient }) {
  const grad = gradient
    ? `<linearGradient id="w" x1="${VIEW.x}" y1="0" x2="${VIEW.x + VIEW.w}" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${gradient[0]}"/><stop offset="1" stop-color="${gradient[1]}"/>
</linearGradient>
`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" width="${VIEW.w}" height="${VIEW.h}" role="img" aria-label="${ARTWORK}">
<title>${ARTWORK}</title>
<defs>
${grad}<mask id="cut" maskUnits="userSpaceOnUse" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}">
<rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" fill="#fff"/>
<g transform="${FLIP}">
${covers.map((d) => `<path d="${d}" fill="#000"/>`).join("\n")}
<ellipse cx="${DOT.cx}" cy="${DOT.cy}" rx="${DOT.rx + GAP / 2}" ry="${DOT.ry + GAP / 2}" transform="scale(1,-1)" fill="none" stroke="#000" stroke-width="${GAP}"/>
</g>
</mask>
</defs>
<g mask="url(#cut)">
<g transform="${FLIP}" fill="${fill}" fill-rule="evenodd">
${letters.map((d) => `<path d="${d}"/>`).join("\n")}
<ellipse cx="${DOT.cx}" cy="${DOT.cy}" rx="${DOT.rx}" ry="${DOT.ry}" transform="scale(1,-1)"/>
</g>
</g>
</svg>
`;
}

let made = 0;
Object.entries(THEMES).forEach(([name, t]) => {
  [
    [`wordmark-nowing-${name}.svg`, build({ fill: "url(#w)", gradient: [t.accent, t.accent2] }), `${t.accent}→${t.accent2}`],
    [`wordmark-nowing-${name}-solid.svg`, build({ fill: t.text }), t.text],
  ].forEach(([file, svg, color]) => {
    fs.writeFileSync(path.join(OUT, file), svg);
    made += 1;
    console.log(`${file.padEnd(32)} 글자 ${color.padEnd(16)} ${(svg.length / 1024).toFixed(0)}KB`);
  });
});

/* 파비콘은 만들지 않습니다.
   예전에는 워드마크의 첫 글자 k 를 잘라 32px 파비콘을 만들어 assets/favicon.svg 로 썼습니다.
   사이트에서 파비콘을 걷어내면서 함께 없앴습니다(build.js 는 rel="icon" 을 내보내지 않습니다).
   되살리려면 이 자리에 다시 넣고 build.js 의 <head> 에 링크를 추가하면 됩니다. */

console.log(`\n${made}개 만들었습니다. 배경이 비치는(마스크로 뚫은) 투명 SVG 입니다.`);
console.log("헤더 로고는 글자입니다(site.json 의 brand). 이 그림들은 사이트에서 쓰지 않고");
console.log("design/logo/wordmark/ 에 보관만 합니다.");

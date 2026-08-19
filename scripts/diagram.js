/* ============================================================
   그림 끼워 넣기

   글 본문에 이렇게 한 줄 적으면

       {{svg: threads-remind-flow}}

   assets/diagrams/threads-remind-flow.svg 를 그 자리에 통째로 펴 넣습니다.
   같은 이름에 -narrow 가 붙은 파일이 있으면 그것도 같이 넣고, 폭이 좁을 때 그쪽이 보입니다.

   왜 이미지로 걸지 않고 펴 넣는가.
   이 사이트는 다크와 라이트 두 모드입니다. 색을 --card, --text 같은 변수로 받아야 토글을 따라오는데,
   <img> 로 걸면 그림이 페이지의 CSS 를 못 봅니다. 그래서 펴 넣습니다.

   왜 본문에 직접 박지 않고 파일로 두는가.
   한 그림이 한국어판, 영문판, 가로, 세로로 네 벌입니다. 본문에 박아두면 고칠 곳이 네 군데가 되고,
   한 군데를 빠뜨리면 언어마다 다른 그림이 나갑니다. 파일이 하나면 고칠 곳도 하나입니다.

   data-standalone 이 붙은 것은 펴 넣을 때 뺍니다.
   파일을 그냥 열어봤을 때만 필요한 것들입니다(배경색, OS 테마용 색 지정).
   이걸 그대로 페이지에 넣으면 사이트의 테마 토글을 눌러도 그림만 안 바뀝니다.
   OS 가 라이트인데 사이트를 다크로 보는 사람이 정확히 여기 걸립니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "diagrams");
const TOKEN = /^[ \t]*\{\{\s*svg:\s*([a-zA-Z0-9._-]+)\s*\}\}[ \t]*$/gm;

/* 파일을 그대로 열어볼 때만 쓰는 것들을 걷어냅니다.
   짝이 있는 태그와 혼자 닫는 태그를 따로 봅니다(<style>...</style> 와 <rect ... />). */
function stripStandalone(svg) {
  return svg
    .replace(/<([a-zA-Z]+)\b[^>]*\bdata-standalone\b[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<[a-zA-Z]+\b[^>]*\bdata-standalone\b[^>]*\/>/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    /* 주석은 그리는 사람에게 남긴 말이라 페이지로 내보낼 이유가 없습니다.
       지우는 김에 소스 보기도 깨끗해집니다. */
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* 크기는 CSS 가 정합니다. 파일에 박힌 width/height 를 남기면 그 크기로 굳어서
   본문 폭에 안 맞습니다. viewBox 는 그대로 둡니다. 비율은 거기서 나옵니다. */
/* 펴 넣은 뒤에도 이 덩어리는 마크다운을 통과합니다. 그래서 파일에 있는 대로 두면 안 됩니다.
   marked 는 빈 줄에서 HTML 덩어리를 끊고, 그다음부터는 다시 마크다운으로 읽습니다.
   SVG 는 4칸씩 들여써 있으니 그 줄들이 전부 코드 블록이 되어, 그림 절반이 <pre><code> 로 나갑니다.
   2026-08-18 에 실제로 그렇게 나갔습니다. 브라우저는 오류를 안 내고 조용히 그렇게 그립니다.
   빈 줄을 없애고 들여쓰기를 걷어내면 통째로 한 덩어리로 남습니다.
   SVG 는 태그 사이 공백을 안 따지므로 그림은 그대로입니다. */
function flatten(svg) {
  return svg
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function prepare(svg, cls) {
  const clean = flatten(stripStandalone(svg));
  return clean.replace(/^<svg\b([^>]*)>/, (m, attrs) => {
    const kept = attrs.replace(/\s(width|height|class)="[^"]*"/g, "");
    return `<svg${kept} class="${cls}">`;
  });
}

const read = (name) => {
  const p = path.join(DIR, `${name}.svg`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

/* 마크다운 안의 {{svg: 이름}} 을 전부 펴 넣습니다.
   못 찾은 이름은 조용히 지우지 않고 그 자리에 남겨 둡니다. 빈 자리로 나가면 눈치채지 못합니다. */
function expandDiagrams(md) {
  return String(md).replace(TOKEN, (whole, name) => {
    const wide = read(name);
    if (!wide) {
      console.warn(`  [그림 없음] assets/diagrams/${name}.svg 를 찾지 못했습니다.`);
      return whole;
    }
    const narrow = read(`${name}-narrow`);
    const parts = [prepare(wide, "dg-wide")];
    if (narrow) parts.push(prepare(narrow, "dg-narrow"));
    return `<figure class="diagram${narrow ? " has-narrow" : ""}">\n${parts.join("\n")}\n</figure>`;
  });
}

module.exports = { expandDiagrams, stripStandalone, prepare, flatten };

/* ============================================================
   그림 눈으로 확인하기 (로컬 전용, 배포와 무관)

       npm run preview                     assets/diagrams 의 가로 그림 전부
       npm run preview -- hero-record       이름에 이 말이 들어가는 것만
       npm run preview -- hero- --narrow     세로판으로
       npm run preview -- hero- --light      라이트 모드로

   PNG 를 <저장소>/.preview/ 에 떨굽니다. 이 폴더는 gitignore 입니다.

   왜 필요한가.
   SVG 를 코드로 적으면 좌표는 맞는데 그림이 이상한 경우를 잡을 수 없습니다.
   특히 사람 옆얼굴이나 물건처럼 "그럴듯하게 보여야 하는" 것은 숫자로 검증이 안 됩니다.
   그래서 make-og.js 가 쓰는 방식(이미 깔린 크롬을 헤드리스로 띄워 캡처) 그대로 써서
   그린 것을 실제로 보고 고칩니다.

   여러 장을 한 판에 붙여 찍습니다. 한 장씩 열면 서로 비교가 안 되는데,
   표지에서 제일 중요한 것이 "글마다 달라 보이는가" 라서 나란히 놓고 봐야 합니다.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets", "diagrams");
const OUT = path.join(ROOT, ".preview");

function findChrome() {
  const cands = [
    process.env.CHROME,
    path.join(process.env["ProgramFiles"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["LOCALAPPDATA"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["ProgramFiles"] || "", "Microsoft/Edge/Application/msedge.exe"),
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return cands.find((p) => p && fs.existsSync(p));
}

const args = process.argv.slice(2);
const narrow = args.includes("--narrow");
const light = args.includes("--light");
const filter = args.find((a) => !a.startsWith("--")) || "";

/* 사이트와 같은 색을 씁니다. 여기 값이 assets/style.css 와 어긋나면 미리보기가 거짓말을 합니다. */
const DARK = "--bg:#0e1116;--bg-soft:#141922;--card:#161c26;--card-hover:#1b2230;--border:#232b38;--text:#e6ebf3;--muted:#9aa7bd;--accent:#6ee7b7";
const LIGHT = "--bg:#ffffff;--bg-soft:#f5f7fa;--card:#ffffff;--card-hover:#f7f9fc;--border:#e2e8f0;--text:#16202e;--muted:#5a6b83;--accent:#0f9d76";

/* 파일에 있는 그대로 넣으면 안 됩니다. data-standalone 이 붙은 것은 파일을 혼자 열 때만 쓰는
   배경과 OS 테마 색이라, 그걸 남겨두면 사이트 색이 아니라 OS 색으로 그려집니다.
   즉 실제 페이지에서 보이는 것과 다른 그림을 보게 됩니다. diagram.js 와 같은 규칙을 씁니다. */
const { stripStandalone } = require("./diagram.js");

const files = fs.readdirSync(DIR)
  .filter((f) => f.endsWith(".svg"))
  .filter((f) => (narrow ? f.includes("-narrow") : !f.includes("-narrow")))
  .filter((f) => !f.includes("-en"))
  .filter((f) => f.includes(filter))
  .sort();

if (!files.length) {
  console.error(`  assets/diagrams 에서 "${filter}" 에 맞는 그림을 찾지 못했습니다.`);
  process.exit(1);
}

const chrome = findChrome();
if (!chrome) {
  console.error("크롬이나 엣지를 찾지 못했습니다. CHROME 환경변수에 경로를 지정하세요.");
  process.exit(1);
}

const cols = narrow ? 3 : 2;
const cellW = narrow ? 380 : 920;
const rows = Math.ceil(files.length / cols);
const cellH = narrow ? 400 : 380;

const cards = files.map((f) => {
  const svg = stripStandalone(fs.readFileSync(path.join(DIR, f), "utf8"))
    .replace(/^<svg\b([^>]*)>/, (m, a) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, "")}>`);
  return `<figure><figcaption>${f}</figcaption>${svg}</figure>`;
});

const html = `<!doctype html><meta charset="utf-8"><style>
  :root{${light ? LIGHT : DARK}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);
       font-family:system-ui,'Malgun Gothic',sans-serif;
       display:grid;grid-template-columns:repeat(${cols},1fr);gap:18px;padding:18px}
  figure{margin:0;min-width:0}
  figcaption{font-size:12px;color:var(--muted);margin:0 0 6px;font-family:ui-monospace,monospace}
  svg{width:100%;height:auto;display:block}
</style>${cards.join("\n")}`;

fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(os.tmpdir(), `preview-${Date.now()}.html`);
fs.writeFileSync(tmp, html, "utf8");
const out = path.join(OUT, `${narrow ? "narrow" : "wide"}-${light ? "light" : "dark"}.png`);
if (fs.existsSync(out)) fs.rmSync(out);

const r = spawnSync(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--user-data-dir=${path.join(os.tmpdir(), "preview-profile")}`,
  "--force-device-scale-factor=1",
  `--window-size=${cols * cellW + 36},${rows * cellH + 36}`,
  `--screenshot=${out}`,
  `file:///${tmp.replace(/\\/g, "/")}`,
], { encoding: "utf8", timeout: 60000 });

fs.rmSync(tmp, { force: true });
if (!fs.existsSync(out)) {
  console.error("캡처 실패");
  console.error((r.stderr || r.stdout || "").trim().slice(0, 500));
  process.exit(1);
}
console.log(`${files.length}장을 붙여 찍었습니다.\n  ${out}`);
files.forEach((f) => console.log(`    ${f}`));

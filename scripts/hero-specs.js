/* ============================================================
   표지 그림의 내용

   글 한 편당 항목 하나입니다. 여기서 정하는 것은 넷뿐입니다.

       motif    가운데 그림. 글마다 다른 유일한 부분입니다
       chip     오른쪽 위 작은 표시. 영문 짧은 말. 한국어판도 영문을 씁니다
       caption  아래 한 줄. 두 토막으로 적습니다.
                가로는 " · " 로 이어 붙이고, 세로는 두 줄로 나눠 넣습니다
       glow     빛무리 자리. 그림의 중심에 둡니다

   테두리, 그러데이션, 점 무늬, 글꼴, 색은 hero-kit.js 가 전부 맡습니다.
   여기서 손대지 마세요. 글마다 틀이 달라지면 사이트가 아니라 모음집처럼 보입니다.

   ── 표지마다 그려진 주인공이 하나씩 있습니다 ──

   2026-08-21 에 한 번 갈아엎었습니다. 처음에는 사각형과 선과 눈금만으로 그렸는데,
   여덟 장을 나란히 놓고 보니 배치만 다른 같은 그림이었습니다. 전부 도표였고 그림이 아니었습니다.
   그래서 글마다 "그려진 것"을 하나씩 넣었습니다.

       whyai     펼친 공책에서 길이 뻗어 나가고 그 위에 쓸 글이 놓임
       wix       낡은 집에서 새 집으로 옮기고, 아래의 고정비 막대가 어느 달부터 끊김
       quote     모래시계 옆에서 여러 단계짜리 줄이 두 단계로 줄어듦
       n8n       손잡이 없는 문과 손잡이 있는 문
       me        사람과 그를 둘러싼 한계선이 바깥으로 밀려나고 위에서 무언가 내려옴
       cron      벽시계 옆에서 적어둔 눈금과 실제로 돈 눈금이 어긋남
       socratic  소크라테스 흉상 앞에서 말풍선이 좌우로 오감
       record    기록 더미의 맨 위 한 장에만 값표

   새 글의 주인공은 위 여덟과 겹치지 않는 것으로 고릅니다.
   못 고르겠으면 그건 표지 문제가 아니라 그 글이 무엇에 관한 글인지 아직 안 정해진 것입니다.

   그림은 눈으로 보고 고칩니다. 좌표만 맞추면 사람 얼굴이 사람이 아니게 됩니다.

       npm run hero -- <슬러그>     그림 다시 만들기
       npm run preview -- hero-     여덟 장을 한 판에 붙여서 보기
       npm run preview -- hero- --light   라이트 모드로

   caption 에 숫자와 고유명사를 넣지 않습니다. 이유는 README.md 에 적혀 있습니다.
   ============================================================ */
const { sketch, shape, card, bar, dot, ring, line, cardLines, n, C, B, M, A } = require("./hero-kit.js");

/* ------------------------------------------------------------
   그려진 것들

   전부 왼쪽 위를 원점으로 하는 자기 좌표계에 그리고, 쓸 때 translate/scale 로 앉힙니다.
   그래야 가로판과 세로판이 같은 그림을 크기만 바꿔 씁니다.
   ------------------------------------------------------------ */

/* 펼친 공책. 가운데가 접힌 자리라 종이가 살짝 휩니다. 200x140 */
function notebook() {
  const left = "M12,34 C42,24 72,24 100,36 L100,120 C72,108 42,108 12,118 Z";
  const right = "M100,36 C128,24 158,24 188,34 L188,116 C158,106 128,108 100,120 Z";
  let s = shape(left, { fill: C, stroke: M, sw: 2 }) + shape(right, { fill: C, stroke: M, sw: 2 });
  s += line("M100,36 V120", { op: 0.55, sw: 1.6 });
  [[26, 56, 60], [26, 72, 52], [26, 88, 64]].forEach(([x, y, w]) => (s += bar(x, y, w, { op: 0.4 })));
  [[116, 52, 56], [116, 68, 48]].forEach(([x, y, w]) => (s += bar(x, y, w, { op: 0.4 })));
  /* 오른쪽 페이지의 마지막 줄만 또렷합니다. 지금 쓰고 있는 줄입니다. */
  s += bar(116, 84, 40, { fill: A, op: 0.9 });
  return s;
}

/* 접힌 모서리가 있는 종잇장. 앞으로 쓸 글입니다. 34x44 */
function page(x, y, o = {}) {
  const s = o.op === undefined ? 1 : o.op;
  return `<g opacity="${s}" transform="translate(${x},${y})">` +
    shape("M0,0 H22 L34,13 V44 H0 Z", { fill: C, stroke: o.accent ? A : M, sw: o.accent ? 2 : 1.7 }) +
    line("M22,0 V13 H34", { op: 0.6, sw: 1.5 }) +
    bar(7, 22, 18, { op: 0.45 }) + bar(7, 30, 13, { op: 0.45 }) + "</g>";
}

/* 집. 홈페이지를 집으로 봅니다. 120x110 */
function house(o = {}) {
  const st = o.accent ? A : M;
  const sw = o.accent ? 2.2 : 2;
  return shape("M6,52 L60,10 L114,52", { fill: "none", stroke: st, sw }) +
    shape("M18,50 H102 V104 H18 Z", { fill: C, stroke: st, sw }) +
    shape("M50,74 H70 V104 H50 Z", { fill: "none", stroke: st, sw: sw - 0.4 }) +
    shape("M28,62 H42 V76 H28 Z", { fill: "none", stroke: st, sw: sw - 0.6, op: 0.7 }) +
    shape("M78,62 H92 V76 H78 Z", { fill: "none", stroke: st, sw: sw - 0.6, op: 0.7 });
}

/* 모래시계. 120x180 */
function hourglass() {
  const glassL = "M24,22 C24,62 58,82 58,90 C58,98 24,118 24,158";
  const glassR = "M96,22 C96,62 62,82 62,90 C62,98 96,118 96,158";
  return shape("M12,8 H108 V22 H12 Z", { fill: C, stroke: M, sw: 2 }) +
    shape("M12,158 H108 V172 H12 Z", { fill: C, stroke: M, sw: 2 }) +
    line(glassL, { sw: 2, op: 0.9 }) + line(glassR, { sw: 2, op: 0.9 }) +
    /* 위 칸의 모래는 아직 많고 아래는 조금입니다. 시간이 남아 있다는 뜻이 아니라
       예전에는 저만큼 걸렸다는 뜻입니다. */
    shape("M29,26 C29,58 56,80 60,86 C64,80 91,58 91,26 Z", { fill: M, stroke: "none", sw: 0, op: 0.28 }) +
    shape("M40,154 C44,132 54,120 60,120 C66,120 76,132 80,154 Z", { fill: A, stroke: "none", sw: 0, op: 0.55 }) +
    line("M60,96 V146", { stroke: A, dash: "2 7", sw: 1.6, op: 0.8 });
}

/* 문. 손잡이가 있느냐 없느냐가 이 글의 전부입니다. 100x160 */
function door(o = {}) {
  const st = o.accent ? A : M;
  const sw = o.accent ? 2.2 : 2;
  let s = shape("M8,12 H92 V152 H8 Z", { fill: C, stroke: st, sw }) +
    shape("M20,26 H80 V138 H20 Z", { fill: "none", stroke: st, sw: sw - 0.6, op: 0.6 });
  s += o.accent
    ? ring(74, 84, 5.5, { stroke: A, sw: 2.2, fill: C }) + line("M66,84 H70", { stroke: A, sw: 2 })
    /* 손잡이가 없으면 문처럼 생겼어도 문이 아닙니다. */
    + "" : line("M64,80 L82,88", { op: 0.35, sw: 1.6, dash: "3 5" });
  return s;
}

/* 사람. 머리와 어깨만. 표정을 넣으면 캐릭터가 되고 그러면 글보다 그림이 셉니다. 80x86 */
function person(o = {}) {
  const st = o.accent ? A : M;
  return ring(40, 24, 17, { stroke: st, sw: 2.2, fill: C }) +
    shape("M6,86 C6,58 22,46 40,46 C58,46 74,58 74,86 Z", { fill: C, stroke: st, sw: 2.2 });
}

/* 벽시계. 128x128 */
function clock() {
  let s = ring(64, 64, 56, { stroke: M, sw: 2.2, fill: C }) + ring(64, 64, 48, { stroke: M, sw: 1.4, op: 0.45 });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const r1 = i % 3 === 0 ? 38 : 42;
    s += line(`M${n(64 + Math.sin(a) * r1)},${n(64 - Math.cos(a) * r1)} L${n(64 + Math.sin(a) * 46)},${n(64 - Math.cos(a) * 46)}`,
      { op: i % 3 === 0 ? 0.75 : 0.4, sw: i % 3 === 0 ? 2.2 : 1.5 });
  }
  return s + line("M64,64 L64,34", { stroke: A, sw: 2.6 }) +
    line("M64,64 L88,76", { stroke: M, sw: 2.6, op: 0.8 }) +
    dot(64, 64, 4, { fill: A });
}

/* 소크라테스 흉상. 200x282
   표식은 셋입니다. 벗겨진 넓은 이마, 들창코, 덥수룩한 수염.
   셋 중 하나만 빠져도 그냥 수염 난 아저씨가 됩니다.
   좌표를 감으로 만지지 마세요. 얼굴은 숫자 몇 개만 어긋나도 사람이 아니게 됩니다.
   npm run preview 로 보면서 고칩니다. */
function socratesBust() {
  /* 비례를 두 번 틀렸습니다.
     한 번은 머리를 위로 길쭉하게 그려서 달걀이 됐고,
     한 번은 정수리를 둥글게 부풀리고 얼굴 요소를 머리 한가운데에 두어 새가 됐습니다.

     옆얼굴은 이렇게 짜야 사람으로 읽힙니다.
       · 얼굴 앞면은 거의 수직으로 서고, 뒤통수가 뒤로 튀어나온다
       · 눈은 머리 높이의 한가운데, 그리고 앞쪽에 붙는다. 가운데에 두면 짐승이 된다
       · 코는 앞으로 나오되 아래로 꺾지 않는다. 아래로 꺾으면 부리가 된다
       · 턱 아래에서 목이 한 번 좁아졌다가 수염이 넓어진다.
         목 없이 머리와 수염이 같은 폭으로 이어지면 통짜 덩어리가 된다 */
  const skull =
    "M100,28 " +
    "C126,28 146,42 151,62 " +
    "C155,74 157,82 156,90 " +
    /* 눈썹뼈 아래로 들어갔다가 */
    "C155,96 151,98 148,99 " +
    /* 콧등에서 앞으로. 코끝이 앞으로 나오는 최대 지점입니다 */
    "L158,111 " +
    "C167,116 165,125 153,124 " +
    "L145,122 " +
    /* 인중, 입, 턱 */
    "C154,130 152,140 143,145 " +
    /* 수염 앞선 */
    "C163,158 170,190 158,214 " +
    /* 수염 아래는 물결져야 덥수룩해 보입니다 */
    "C150,228 132,236 116,234 " +
    "C98,232 84,222 78,208 " +
    /* 목. 여기가 좁아져야 머리와 수염이 갈립니다 */
    "C72,196 70,186 68,176 " +
    "C56,166 46,146 44,120 " +
    /* 뒤통수 */
    "C42,92 46,62 62,44 " +
    "C72,33 85,28 100,28 Z";
  /* 수염 결은 두 줄이면 충분합니다. 세 줄 넘게 그으면 결이 아니라 통짜 덩어리로 뭉칩니다 */
  const beardInner = "M143,148 C156,166 158,192 148,210 M116,160 C120,186 116,208 106,224";
  /* 옆머리와 뒷머리만. 정수리와 이마는 비웁니다.
     여기에 곱슬을 얹었더니 대머리로 안 보였습니다. 벗겨진 머리가 소크라테스의 표식입니다 */
  const hair = "M50,82 C50,68 55,56 64,47 M48,106 C46,92 47,78 51,68";
  const curls = "M46,72 C50,62 56,55 63,51";
  return sketch(skull, { fill: C, stroke: M, sw: 2, seed: 11, roughness: 1.1 }) +
    sketch(hair, { stroke: M, sw: 1.6, op: 0.5, seed: 23, roughness: 1.6 }) +
    sketch(curls, { stroke: M, sw: 1.5, op: 0.45, seed: 31, roughness: 1.8 }) +
    /* 눈썹뼈. 눈보다 뒤에서 시작해야 이마와 이어져 보입니다 */
    sketch("M116,86 C127,80 140,82 148,89", { stroke: M, sw: 1.8, op: 0.5, seed: 41, roughness: 1.3 }) +
    /* 눈은 머리 높이의 한가운데, 그리고 앞쪽에.
       조각상이라 눈동자를 넣으면 만화가 되므로 감은 듯한 홈으로 둡니다 */
    sketch("M121,97 C129,92 138,93 145,98", { stroke: M, sw: 2, op: 0.85, seed: 47, roughness: 0.9 }) +
    shape("M126,97 C132,93 139,94 143,98 C137,100 130,100 126,97 Z",
      { fill: M, stroke: "none", sw: 0, op: 0.4 }) +
    /* 콧방울과 콧수염 */
    sketch("M151,120 C147,123 143,123 140,121", { stroke: M, sw: 1.5, op: 0.4, seed: 53, roughness: 1.2 }) +
    sketch("M134,134 C148,137 150,145 141,149", { stroke: M, sw: 1.6, op: 0.42, seed: 59, roughness: 1.4 }) +
    /* 귀. 눈과 같은 높이, 그리고 머리의 가운데쯤 */
    sketch("M88,102 C99,96 108,106 104,120 C101,130 92,130 88,123", { stroke: M, sw: 1.6, op: 0.5, seed: 67, roughness: 1.2 }) +
    sketch(beardInner, { stroke: M, sw: 1.5, op: 0.42, seed: 71, roughness: 1.9 }) +
    /* 좌대. 이게 있어야 사람 얼굴이 아니라 흉상으로 읽힙니다 */
    sketch("M92,231 H146 L156,256 H80 Z", { fill: C, stroke: M, sw: 1.8, seed: 83, roughness: 1.1 }) +
    sketch("M68,256 H168 V272 H68 Z", { fill: C, stroke: M, sw: 1.8, seed: 89, roughness: 1 });
}

const put = (x, y, s, body) => `<g transform="translate(${x},${y}) scale(${s})">${body}</g>`;

/* 말풍선.

   꼬리를 그냥 삼각형으로 얹으면 말풍선이 깨집니다.
   삼각형에 테두리를 세 변 다 그리면 그중 윗변이 말풍선 몸통을 가로지르는 선으로 남고,
   그 선 때문에 꼬리가 말풍선에 붙은 게 아니라 겹쳐 놓은 것처럼 보입니다.

   그래서 세 번에 나눠 그립니다.
     1. 몸통을 테두리까지 그린다
     2. 꼬리를 테두리 없이 채워서, 몸통 아래 테두리의 그 구간을 덮는다
     3. 꼬리의 바깥 두 변만 선으로 잇는다
   이러면 몸통과 꼬리가 한 덩어리가 됩니다. 채우는 색이 몸통과 같아야 하므로 --card 를 씁니다. */
function bubble(x, y, w, h, o = {}) {
  const st = o.accent ? A : B;
  const sw = o.accent ? 2 : 1.4;
  const left = o.left !== false;
  const b1 = left ? x + 34 : x + w - 64;
  const b2 = b1 + 30;
  const tipX = left ? x + 14 : x + w - 14;
  const baseY = y + h - 8;
  const tipY = y + h + 17;
  return card(x, y, w, h, { rx: h / 2, accent: o.accent }) +
    `<path d="M${n(b1)},${n(baseY)} L${n(tipX)},${n(tipY)} L${n(b2)},${n(baseY)} Z" fill="${C}" stroke="none"/>` +
    `<path d="M${n(b1)},${n(baseY)} L${n(tipX)},${n(tipY)} L${n(b2)},${n(baseY)}" fill="none" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/* ------------------------------------------------------------
   가운데 그림
   ------------------------------------------------------------ */
const MOTIF = {};

/* 펼친 공책에서 길이 뻗고 그 위에 앞으로 쓸 글이 놓입니다.
   끝을 안 닫은 것은 첫 글이라 뒤가 아직 없기 때문입니다. */
MOTIF.whyai = (box) => {
  if (box.mode === "w") {
    return put(96, 82, 1, notebook()) +
      line("M292,152 H830", { dash: "2 9", op: 0.7 }) +
      page(420, 130, { accent: true }) + page(560, 130, { op: 0.55 }) + page(700, 130, { op: 0.28 });
  }
  return put(46, 44, 0.68, notebook()) +
    line("M180,148 V276", { dash: "2 9", op: 0.7 }) +
    page(163, 168, { accent: true }) + page(163, 222, { op: 0.4 });
};

/* 낡은 집에서 새 집으로 옮깁니다. 아래의 고정비 막대는 어느 달부터 서지 않습니다. */
MOTIF.wix = (box, P) => {
  const w = box.mode === "w";
  /* 막대 아래 끝(base)과 끊긴 자리 세로선이 캡션에 닿지 않게 잡습니다. */
  const [x0, step, bw, base, top, cut, cnt] = w ? [150, 52, 24, 248, 196, 6, 12] : [46, 34, 20, 258, 220, 4, 8];
  let s = w
    ? put(196, 60, 1.05, house()) + put(548, 60, 1.05, house({ accent: true })) +
      line("M406,116 H502", { arrow: P + "aa", stroke: A, sw: 2 }) +
      put(432, 128, 0.62, page(0, 0, {}))
    : put(24, 46, 0.72, house()) + put(212, 46, 0.72, house({ accent: true })) +
      line("M124,102 H196", { arrow: P + "aa", stroke: A, sw: 2 });
  s += line(`M${x0 - 12},${base} H${n(x0 + cnt * step)}`, { op: 0.4 });
  for (let i = 0; i < cnt; i++) {
    const x = x0 + i * step;
    s += i < cut
      ? `<rect x="${x}" y="${top}" width="${bw}" height="${base - top}" rx="3" fill="${M}" opacity="0.45"/>`
      : bar(x, base - 5, bw, { fill: A, op: 0.4, h: 4 });
  }
  const cx = x0 + cut * step - Math.round(step / 2 - bw / 2) - 4;
  return s + line(`M${cx},${top - 14} V${base + 16}`, { stroke: A, sw: 2, dash: "4 6" });
};

/* 모래시계 옆에서 여러 단계짜리 줄이 두 단계로 줄어듭니다. */
MOTIF.quote = (box, P) => {
  const w = box.mode === "w";
  if (w) {
    let s = put(126, 62, 0.95, hourglass());
    const [x1, y1, sw1, gap1, cnt1] = [346, 106, 56, 16, 7];
    for (let i = 0; i < cnt1; i++) {
      const x = x1 + i * (sw1 + gap1);
      s += `<g opacity="0.45">${card(x, y1, sw1, 28)}${dot(x + sw1 / 2, y1 + 14, 3.2)}</g>`;
      if (i < cnt1 - 1) s += line(`M${x + sw1},${y1 + 14} H${x + sw1 + gap1}`, { op: 0.35, sw: 1.4 });
    }
    /* 아래 줄은 위 줄의 한가운데에 맞춥니다. 어긋나면 줄어든 게 아니라 딴 줄로 보입니다.
       화살표도 그 가운데, 두 칸 사이 빈 자리에 내립니다. 카드 위에 겹치면 안 됩니다. */
    const mid = (x1 + (x1 + cnt1 * sw1 + (cnt1 - 1) * gap1)) / 2;
    const [y2, sw2, gap2] = [196, 116, 48];
    const x2 = mid - (2 * sw2 + gap2) / 2;
    for (let i = 0; i < 2; i++) {
      const x = x2 + i * (sw2 + gap2);
      s += card(x, y2, sw2, 40, { accent: true }) + cardLines(x, y2 + 20, sw2 - 44, i * 3);
      if (i === 0) s += line(`M${x + sw2},${y2 + 20} H${x + sw2 + gap2}`, { stroke: A, sw: 1.6 });
    }
    return s + line(`M${n(mid)},142 V186`, { stroke: A, sw: 2, arrow: P + "aa" });
  }
  let s = put(120, 24, 0.6, hourglass());
  const cnt1 = 5, sw1 = 40, gap1 = 10, x1 = 180 - (cnt1 * sw1 + (cnt1 - 1) * gap1) / 2;
  for (let i = 0; i < cnt1; i++) {
    const x = x1 + i * (sw1 + gap1);
    s += `<g opacity="0.45">${card(x, 148, sw1, 24)}${dot(x + sw1 / 2, 160, 3)}</g>`;
    if (i < cnt1 - 1) s += line(`M${x + sw1},${160} H${x + sw1 + gap1}`, { op: 0.35, sw: 1.4 });
  }
  const sw2 = 100, gap2 = 28, x2 = 180 - (2 * sw2 + gap2) / 2;
  for (let i = 0; i < 2; i++) {
    const x = x2 + i * (sw2 + gap2);
    s += card(x, 214, sw2, 36, { accent: true }) + cardLines(x, 232, sw2 - 44, i * 3);
    if (i === 0) s += line(`M${x + sw2},232 H${x + sw2 + gap2}`, { stroke: A, sw: 1.6 });
  }
  return s + line("M180,180 V206", { stroke: A, sw: 2, arrow: P + "aa" });
};

/* 손잡이 없는 문과 손잡이 있는 문. 같은 자동화인데 남이 열 수 있느냐가 다릅니다. */
MOTIF.n8n = (box, P) => {
  /* 문 바깥에 붙는 것은 그 문 뒤에 무엇이 있는지 보여줍니다.
     왼쪽 문 왼편에는 코드 줄, 오른쪽 문 오른편에는 노드 몇 개.
     문과 겹치지 않게 x 를 잡습니다. 겹치면 무엇이 무엇인지 안 읽힙니다. */
  if (box.mode === "w") {
    return `<g opacity="0.4">${[124, 92, 110].map((v, i) => bar(92, 128 + i * 16, v)).join("")}</g>` +
      put(228, 62, 1.05, door()) +
      line("M446,144 H516", { arrow: P + "aa", stroke: A, sw: 2 }) +
      put(560, 62, 1.05, door({ accent: true })) +
      `<g opacity="0.8">${ring(714, 122, 12, { stroke: A, sw: 1.8, fill: C }) +
        ring(766, 152, 12, { stroke: A, sw: 1.8, fill: C }) +
        ring(714, 182, 12, { stroke: A, sw: 1.8, fill: C }) +
        line("M724,128 L756,146", { stroke: A, op: 0.6 }) + line("M756,158 L724,176", { stroke: A, op: 0.6 })}</g>`;
  }
  return `<g opacity="0.4">${[70, 50].map((v, i) => bar(24, 78 + i * 14, v)).join("")}</g>` +
    put(38, 40, 0.66, door()) +
    line("M128,96 H196", { arrow: P + "aa", stroke: A, sw: 2 }) +
    put(212, 40, 0.66, door({ accent: true })) +
    `<g opacity="0.8">${ring(96, 216, 11, { stroke: A, sw: 1.8, fill: C }) +
      ring(148, 240, 11, { stroke: A, sw: 1.8, fill: C }) +
      ring(200, 216, 11, { stroke: A, sw: 1.8, fill: C }) +
      line("M105,222 L139,235", { stroke: A, op: 0.6 }) + line("M157,235 L191,222", { stroke: A, op: 0.6 })}</g>`;
};

/* 가운데는 나. 점선이 예전 한계선이고 바깥 원이 지금입니다.
   위에서 내려오는 점들은 머리로 들어오는 것입니다. 밀려난 것은 업무가 아니라 나입니다. */
MOTIF.me = (box, P) => {
  const w = box.mode === "w";
  /* 바깥 원이 아래 캡션에 닿지 않아야 합니다. cy + rOut 이 캡션 줄(가로 277, 세로 280)보다 위여야 합니다. */
  const [cx, cy, rIn, rOut, sc] = w ? [450, 146, 66, 108, 0.9] : [180, 156, 58, 96, 0.76];
  let s = "";
  /* 위에서 내려오는 것. 매트릭스에서 조종법이 머리로 들어오던 장면입니다. */
  [-34, 0, 34].forEach((d, i) => {
    s += line(`M${cx + d},${cy - rOut - (w ? 34 : 30)} V${cy - (w ? 46 : 40)}`,
      { stroke: A, dash: "2 8", sw: 1.8, op: [0.4, 0.8, 0.4][i] });
  });
  s += ring(cx, cy, rOut, { stroke: A, sw: 2, op: 0.9 }) + ring(cx, cy, rIn, { dash: "4 7", op: 0.65 });
  const k = 0.7071;
  [[k, k], [-k, k], [k, -k], [-k, -k]].forEach(([dx, dy]) => {
    s += line(`M${n(cx + dx * (rIn + 10))},${n(cy + dy * (rIn + 10))} L${n(cx + dx * (rOut - 8))},${n(cy + dy * (rOut - 8))}`,
      { stroke: A, sw: 1.8, arrow: P + "aa", op: 0.8 });
  });
  return s + put(cx - 40 * sc, cy - 40 * sc, sc, person());
};

/* 벽시계 옆에서 적어둔 눈금과 실제로 돈 눈금이 어긋납니다.
   아래에 그은 괄호가 고장 없이 그냥 안 돈 구간입니다. 이 글의 핵심입니다. */
MOTIF.cron = (box) => {
  const w = box.mode === "w";
  let s = w ? put(122, 88, 1, clock()) : put(116, 24, 0.72, clock());
  const [x0, step, cnt, y1, y2] = w ? [312, 21.5, 23, 122, 196] : [40, 20, 15, 174, 234];
  const span = (cnt - 1) * step;
  s += line(`M${x0 - 10},${y1} H${n(x0 + span + 10)}`, { op: 0.35 }) +
    line(`M${x0 - 10},${y2} H${n(x0 + span + 10)}`, { op: 0.35 });
  for (let i = 0; i < cnt; i++) {
    s += `<rect x="${n(x0 + i * step - 1)}" y="${y1 - 16}" width="2" height="16" rx="1" fill="${M}" opacity="0.45"/>`;
  }
  const hit = w ? [0, 2, 3, 11, 17, 18, 22] : [0, 2, 8, 13];
  hit.forEach((i) => {
    const x = x0 + i * step;
    s += `<rect x="${n(x - 1.4)}" y="${y2 - 20}" width="2.8" height="20" rx="1.4" fill="${A}"/>` +
      dot(x, y2 - 26, 3, { fill: A, op: 0.8 });
  });
  const g1 = x0 + hit[w ? 2 : 1] * step, g2 = x0 + hit[w ? 3 : 2] * step;
  return s + line(`M${n(g1)},${y2 + 15} H${n(g2)}`, { dash: "3 6", op: 0.65 }) +
    line(`M${n(g1)},${y2 + 10} V${y2 + 20}`, { op: 0.65, sw: 1.4 }) +
    line(`M${n(g2)},${y2 + 10} V${y2 + 20}`, { op: 0.65, sw: 1.4 });
};

/* 소크라테스 흉상 앞에서 말풍선이 좌우로 엇갈립니다.
   꼬리 방향이 번갈아 나야 오가는 것으로 읽힙니다. 한쪽으로만 몰리면 그냥 알약 몇 개입니다. */
MOTIF.socratic = (box) => {
  const w = box.mode === "w";
  const bust = put(w ? 88 : 16, w ? 18 : 96, w ? 0.8 : 0.44, socratesBust());
  const bs = w
    ? [[268, 58, 250], [438, 122, 300], [300, 188, 330]]
    : [[112, 40, 220], [58, 100, 252], [96, 160, 248]];
  const bh = w ? 42 : 36;
  let s = bust;
  bs.forEach(([x, y, bw], i) => {
    const last = i === bs.length - 1;
    s += `<g opacity="${[0.5, 0.72, 1][i]}">` +
      bubble(x, y, bw, bh, { accent: last, left: i % 2 === 0 }) +
      cardLines(x + 8, y + bh / 2, bw - 60, i * 2) + `</g>`;
  });
  return s;
};

/* 기록 더미. 아래가 오래된 것이라 흐리고, 값표는 맨 위 한 장에만 붙습니다.
   쌓인 것 전부에 값이 붙은 게 아니라 지금 붙기 시작했다는 뜻입니다.
   이 표지는 사용자가 보고 통과시킨 것이라 모양을 바꾸지 않습니다. */
MOTIF.record = (box, P) => {
  const w = box.mode === "w";
  const tag = `<defs><symbol id="${P}tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 12.6 12.4 20.8 3.4 11.8V3.4h8.4z"/><circle cx="8.2" cy="8.2" r="1.5"/></symbol></defs>`;
  const [x0, y0, cw, ch, dx, dy, cnt] = w ? [280, 224, 300, 26, 8, 24, 7] : [62, 228, 210, 24, 6, 22, 6];
  let s = tag;
  for (let i = 0; i < cnt; i++) {
    const op = n(0.4 + (i / cnt) * 0.6);
    const x = x0 + i * dx, y = y0 - i * dy;
    s += `<g opacity="${op}">${card(x, y, cw, ch)}${cardLines(x, y + ch / 2, cw - 46, i)}</g>`;
  }
  const tx = x0 + cnt * dx, ty = y0 - cnt * dy;
  s += card(tx, ty, cw, ch, { accent: true }) +
    dot(tx + 16, ty + ch / 2, 3.3, { fill: A }) +
    bar(tx + 30, ty + ch / 2 - 5.6, cw * 0.49, { fill: A, op: 0.75 }) +
    bar(tx + 30, ty + ch / 2 + 2.4, cw * 0.36, { fill: A, op: 0.75 });
  if (w) s += line(`M${tx + cw},${ty + ch / 2} H${tx + cw + 28}`, { stroke: A, sw: 1.6 });
  const bx = w ? tx + cw + 46 : tx + cw;
  const by = w ? ty + ch / 2 : ty;
  const br = w ? 17 : 14;
  return s + ring(bx, by, br, { stroke: A, sw: 2, fill: C }) +
    `<use href="#${P}tag" x="${n(bx - br * 0.59)}" y="${n(by - br * 0.59)}" width="${n(br * 1.18)}" height="${n(br * 1.18)}" style="color:${A}"/>`;
};

/* ------------------------------------------------------------
   글마다의 내용

   key   id 앞에 붙는 약칭. 짧게 둡니다
   slug  글 파일 이름에서 날짜를 뺀 것. 그림 파일 이름이 여기서 나옵니다
   ------------------------------------------------------------ */
const SPECS = [
  {
    key: "whyai", slug: "why-ai-transform", motif: MOTIF.whyai,
    chip: "In the Open",
    glow: { w: [300, 150, 320, 150], n: [160, 130, 190, 150] },
    ko: {
      title: "공개로 쌓아가는 기록의 시작",
      desc: "펼친 공책에서 점선 길이 뻗어 나가고 그 위에 앞으로 쓸 종잇장이 놓입니다. 뒤로 갈수록 흐린 것은 아직 쓰지 않은 글입니다.",
      caption: ["왜 시작했나", "왜 굳이 공개로 적나"],
    },
    en: {
      title: "The start of a record kept in the open",
      desc: "A dotted path runs out of an open notebook with pages laid along it. The ones fading toward the end are the posts not written yet.",
      caption: ["Why I started", "Why I write it in public"],
    },
  },
  {
    key: "wix", slug: "wix-to-cloudflare", motif: MOTIF.wix,
    chip: "Fixed Cost",
    glow: { w: [560, 130, 320, 150], n: [230, 110, 190, 140] },
    ko: {
      title: "집을 옮기고 나서 끊긴 고정비",
      desc: "낡은 집에서 새 집으로 옮깁니다. 아래에 달마다 서던 막대가 어느 달부터 서지 않고, 끊긴 자리에 세로선이 있습니다.",
      caption: ["매달 나가던 것이", "어느 달부터 안 나간다"],
    },
    en: {
      title: "The bill that stopped after the move",
      desc: "A move from an old house to a new one. Below, a bar that stood every month stops standing, with a line marking where.",
      caption: ["What went out every month", "stopped going out"],
    },
  },
  {
    key: "quote", slug: "google-apps-script-quote-automation", motif: MOTIF.quote,
    chip: "Automation",
    glow: { w: [500, 170, 320, 150], n: [180, 190, 190, 140] },
    ko: {
      title: "여러 단계가 두 단계가 됐다",
      desc: "모래시계 옆으로 위는 손으로 하던 시절의 긴 단계이고 아래는 지금의 두 단계입니다. 같은 일인데 지나는 자리가 줄었습니다.",
      caption: ["요청 접수부터 발송까지", "지나는 자리가 줄었다"],
    },
    en: {
      title: "Many steps became two",
      desc: "Beside an hourglass, the faded row above is how it used to run by hand and the two steps below are how it runs now. Same job, fewer places to pass through.",
      caption: ["From request to delivery", "with fewer places to pass"],
    },
  },
  {
    key: "n8n", slug: "google-apps-script-to-n8n", motif: MOTIF.n8n,
    chip: "Handover",
    glow: { w: [612, 140, 320, 150], n: [244, 130, 190, 140] },
    ko: {
      title: "손잡이가 없는 문과 있는 문",
      desc: "왼쪽 문에는 손잡이가 없고 오른쪽 문에는 있습니다. 같은 자동화인데 만든 사람 말고 누가 열 수 있느냐가 다릅니다.",
      caption: ["잘 돌아가는가", "내가 없어도 돌아가는가"],
    },
    en: {
      title: "A door with no handle, and a door with one",
      desc: "The left door has no handle and the right one does. Same automation, different answer to who besides the author can open it.",
      caption: ["Does it run", "Does it run without me"],
    },
  },
  {
    key: "me", slug: "ai-transformation-starts-with-me", motif: MOTIF.me,
    chip: "The Operator",
    glow: { w: [450, 150, 320, 150], n: [180, 160, 190, 150] },
    ko: {
      title: "한계선이 바깥으로 밀려났다",
      desc: "가운데가 나이고 점선이 예전 한계선입니다. 바깥의 굵은 원이 지금이며, 위에서 내려오는 점선은 머리로 들어오는 것입니다.",
      caption: ["바뀐 것은 업무가 아니라", "일하는 사람 쪽이었다"],
    },
    en: {
      title: "The limit moved outward",
      desc: "The figure at the center is me and the dotted circle is where my limit used to sit. The solid ring outside is where it sits now, and the dotted lines coming down are what is being loaded in.",
      caption: ["What changed was not the work", "It was the person doing it"],
    },
  },
  {
    key: "cron", slug: "github-actions-cron-delay", motif: MOTIF.cron,
    chip: "Scheduled vs Ran",
    glow: { w: [400, 160, 320, 150], n: [180, 190, 190, 150] },
    ko: {
      title: "적어둔 눈금과 실제로 돈 눈금",
      desc: "벽시계 옆으로 위는 적어둔 대로의 촘촘한 눈금이고 아래는 실제로 돈 드문 눈금입니다. 아래에 그은 괄호가 아무 일도 일어나지 않은 구간입니다.",
      caption: ["적힌 대로 돌지 않는다", "그런데 아무도 안 알려준다"],
    },
    en: {
      title: "The schedule and what actually ran",
      desc: "Beside a wall clock, dense ticks above are what the schedule says and sparse ticks below are what actually ran. The bracket marks a stretch where nothing happened at all.",
      caption: ["It does not run as written", "and nothing tells you"],
    },
  },
  {
    key: "socratic", slug: "socratic-method-in-the-ai-era", motif: MOTIF.socratic,
    chip: "Dialogue",
    glow: { w: [440, 140, 320, 150], n: [180, 130, 190, 150] },
    ko: {
      title: "소크라테스 앞에서 묻고 답이 오간다",
      desc: "소크라테스 흉상 앞에서 말풍선이 좌우로 엇갈립니다. 뒤로 갈수록 또렷해지는 것은 되물을수록 알게 되기 때문입니다.",
      caption: ["한 번 물으면 검색이고", "되물어야 문답이다"],
    },
    en: {
      title: "Question and answer in front of Socrates",
      desc: "Speech bubbles alternate left and right in front of a bust of Socrates, growing sharper toward the end because understanding comes from asking again.",
      caption: ["Ask once and it is a search", "Ask back and it is a dialogue"],
    },
  },
  {
    key: "record", slug: "record-everything", motif: MOTIF.record,
    chip: "Data as Asset",
    glow: { w: [486, 69, 300, 150], n: [200, 108, 180, 130] },
    ko: {
      title: "쌓인 기록이 값이 되는 순간",
      desc: "오래된 기록일수록 아래에 흐릿하게 깔려 있고 위로 갈수록 또렷해집니다. 맨 위 한 장에 값표가 붙어 있습니다.",
      caption: ["이메일 · 메신저 · 소스코드", "그리고 지우지 않은 시간"],
    },
    en: {
      title: "The moment a pile of records becomes an asset",
      desc: "Older records lie faded at the bottom and grow sharper toward the top. A price tag hangs off the topmost one.",
      caption: ["Email · Chat · Source code", "And the years nobody deleted"],
    },
  },
];

module.exports = { SPECS, MOTIF };

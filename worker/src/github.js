/* GitHub 저장소에서 원고를 읽습니다.
   워커에는 파일 시스템이 없어서, 원본이 fs 로 하던 일을 여기서 API 로 합니다.

   ── 매분 다시 받으면 안 됩니다 ──
   처음에는 깨어날 때마다 파일을 전부 받았습니다. 원고가 15편이면 목록 1 + 파일 15 =
   분당 16요청, 시간당 960 입니다. 익명 한도는 시간당 60 이라 배포 직후 바로 막혔고
   (403 rate limit), 인증해도 5,000 한도를 쓸데없이 갉아먹습니다.

   원고는 하루에 몇 번 바뀝니다. 매분 확인할 것은 "바뀌었나" 뿐입니다.
   그래서 브랜치의 커밋 SHA 만 보고(요청 1), 지난번과 같으면 KV 에 넣어둔 것을 씁니다.
   바뀐 회차에만 파일을 다시 받습니다. 평소 분당 1요청, 시간당 60 입니다. */

const API = "https://api.github.com";

function headers(env) {
  const h = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "choworks-threads-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

async function api(env, path) {
  const res = await fetch(`${API}/repos/${env.REPO}${path}`, { headers: headers(env) });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/* 지금 브랜치 끝의 커밋 SHA. 이것만 보면 원고가 바뀌었는지 알 수 있습니다. */
async function headSha(env) {
  const b = await api(env, `/branches/${env.BRANCH}`);
  return b.commit && b.commit.sha;
}

async function fetchAll(env) {
  const list = await api(env, `/contents/${env.THREADS_DIR}?ref=${env.BRANCH}`);
  const files = list
    .filter((f) => f.type === "file" && f.name.endsWith(".md") && !f.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(files.map(async (f) => {
    const res = await fetch(f.download_url, { headers: headers(env) });
    if (!res.ok) throw new Error(`원고 못 읽음 ${f.name}: ${res.status}`);
    return { file: f.name, raw: await res.text() };
  }));
}

/* 원고 파일을 [{file, raw}] 로 돌려줍니다. 두 번째 값은 캐시를 썼는지 여부입니다. */
export async function loadThreadFiles(env) {
  const sha = await headSha(env);
  if (!env.STATE) return [await fetchAll(env), false];

  const cachedSha = await env.STATE.get("threads:sha");
  if (cachedSha === sha) {
    const raw = await env.STATE.get("threads:files");
    if (raw) return [JSON.parse(raw), true];
  }

  const files = await fetchAll(env);
  await env.STATE.put("threads:files", JSON.stringify(files));
  await env.STATE.put("threads:sha", sha);
  return [files, false];
}

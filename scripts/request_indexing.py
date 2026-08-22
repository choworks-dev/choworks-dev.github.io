#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
색인 생성 요청 (구글 서치 콘솔)

    python scripts/request_indexing.py               색인 안 된 주소 전부
    python scripts/request_indexing.py --new         최근 3일 안에 낸 글의 한/영
    python scripts/request_indexing.py --days=7      최근 7일
    python scripts/request_indexing.py <주소> ...     주소를 직접 지정
    python scripts/request_indexing.py --login       로그인만 하고 끝냄
    python scripts/request_indexing.py --dry         무엇을 요청할지만 보여줌

무엇을 하는가
    서치 콘솔의 URL 검사 화면을 브라우저로 열어 "색인 생성 요청" 버튼을 누릅니다.
    사람이 손으로 하던 것을 그대로 대신합니다.

왜 API 를 안 쓰는가
    구글 Indexing API 는 채용공고(JobPosting)와 방송(BroadcastEvent) 전용이라고
    구글이 문서에 못 박아 두었습니다. 일반 페이지에 쓰는 것은 정책 위반입니다.
    그래서 공식적으로 허용된 경로인 서치 콘솔 화면을 그대로 씁니다.

로그인
    처음 한 번만 사람이 합니다. 브라우저 프로필을 .gsc-profile/ 에 남겨 두고
    다음부터는 그 세션을 그대로 씁니다. 구글 계정 로그인을 자동화하지 않습니다.
    자동화하면 구글이 막고, 계정에 보안 경고가 뜹니다.

        python scripts/request_indexing.py --login

하루 한도
    서치 콘솔의 색인 요청은 하루 열 건 남짓입니다. 정확한 숫자는 공개돼 있지 않고
    구글이 조정합니다. 한도에 걸리면 화면에 "할당량 초과" 가 뜨고, 이 스크립트는
    거기서 멈춥니다. 남은 주소는 다음 날 다시 돌리면 됩니다.

    한 편을 내면 한국어와 영문 두 개라 하루 다섯 편까지는 여유롭습니다.

주의
    이건 구글 화면의 버튼을 누르는 방식이라 구글이 화면을 바꾸면 깨집니다.
    깨지면 조용히 실패하지 않고 어느 단계에서 못 찾았는지 찍고 멈춥니다.
    조용히 넘어가면 요청이 안 갔는데 갔다고 믿게 됩니다.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE = ROOT / ".gsc-profile"
SITE = "https://choworks.dev"
PROPERTY = "sc-domain:choworks.dev"
KST = timezone(timedelta(hours=9))

HOME = "https://search.google.com/search-console?resource_id={prop}"

# 검사 입력창. 계정 언어에 따라 글자가 달라서 앞부분만 봅니다.
BOX = ["Inspect any URL", "URL 검사"]

# 화면의 글자는 계정 언어에 따라 다릅니다. 둘 다 봅니다.
BTN_REQUEST = ["색인 생성 요청", "REQUEST INDEXING", "Request indexing"]
TXT_INDEXED = ["URL이 Google에 등록되어 있음", "URL is on Google"]
TXT_QUOTA = ["할당량", "quota", "Quota"]
TXT_DONE = ["색인 생성이 요청됨", "Indexing requested", "요청됨"]


# 윈도우 콘솔은 기본이 CP949 라 한글이 깨집니다. 출력만 UTF-8 로 돌립니다.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def log(msg):
    print(msg, flush=True)


def post_urls(days):
    """최근 며칠 안에 발행된 글의 한/영 주소를 뽑습니다.
    draft 인 글은 아직 사이트에 없으므로 제외합니다. 없는 주소를 요청하면 그 요청만 낭비됩니다."""
    since = (datetime.now(KST) - timedelta(days=days)).date()
    out = []
    for sub, prefix in (("posts-kr", "/posts/"), ("posts-en", "/en/posts/")):
        d = ROOT / "content" / sub
        if not d.exists():
            continue
        for f in sorted(d.glob("*.md")):
            head = f.read_text(encoding="utf-8").split("---")[1] if "---" in f.read_text(encoding="utf-8") else ""
            if re.search(r"^\s*draft\s*:\s*true", head, re.M):
                continue
            m = re.search(r"^\s*date\s*:\s*(\d{4})-(\d{2})-(\d{2})", head, re.M)
            if not m:
                continue
            when = datetime(int(m[1]), int(m[2]), int(m[3])).date()
            if when < since:
                continue
            slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", f.stem)
            out.append(f"{SITE}{prefix}{slug}/")
    return out


def unindexed_urls():
    """content/search.json 에서 아직 색인 안 된 주소를 뽑습니다.
    npm run search 가 채우는 파일이라, 오래됐으면 먼저 그걸 돌리세요."""
    p = ROOT / "content" / "search.json"
    if not p.exists():
        log("  content/search.json 이 없습니다. 먼저 npm run search 를 돌리세요.")
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    rows = [x for x in data.get("index", []) if x.get("verdict") != "PASS"]
    when = data.get("updated", "")[:10]
    log(f"  content/search.json 기준({when}) 색인 안 된 주소 {len(rows)}개")
    return [x["url"] for x in rows]


def wait_login(page, minutes=5):
    """로그인이 끝날 때까지 기다립니다. 자동으로 로그인하지 않습니다.

    구글 계정 로그인을 자동화하면 구글이 막고 계정에 보안 경고가 뜹니다.
    그래서 창만 띄워 두고 사람이 하기를 기다립니다. 한 번 하면 프로필에 남습니다."""
    said = False
    end = time.time() + minutes * 60
    while time.time() < end:
        url = page.url
        signed_in = "search.google.com/search-console" in url and "accounts.google.com" not in url
        if signed_in:
            try:
                body = page.inner_text("body", timeout=5000)
                if not any(w in body for w in ("로그인", "Sign in to continue", "계정에 로그인")):
                    log("  로그인 확인됨")
                    return True
            except Exception:
                pass
        if not said:
            log("  브라우저 창에서 구글 로그인을 해주세요. 서치 콘솔 화면이 뜨면 저절로 넘어갑니다.")
            log(f"  (최대 {minutes}분 기다립니다. 로그인은 프로필에 저장되어 다음부터는 안 물어봅니다)")
            said = True
        time.sleep(3)
    return False


def find_box(page):
    """URL 검사 입력창. aria-label 이 "Inspect any URL in <속성>" 입니다."""
    for label in BOX:
        loc = page.locator(f'input[aria-label^="{label}"]')
        try:
            if loc.count() and loc.first.is_visible():
                return loc.first
        except Exception:
            pass
    return None


def find_button(page):
    """색인 생성 요청 버튼을 찾습니다. 서치 콘솔은 span 안에 글자를 넣습니다."""
    for label in BTN_REQUEST:
        loc = page.get_by_text(label, exact=False)
        try:
            if loc.count():
                return loc.first
        except Exception:
            pass
    return None


def has_text(page, words):
    body = page.inner_text("body", timeout=10000)
    return any(w in body for w in words)


def snapshot(page, tag):
    """막힌 자리의 화면을 남깁니다. 이걸 안 남기면 왜 안 됐는지 추측만 하게 됩니다."""
    d = ROOT / ".gsc-shots"
    d.mkdir(exist_ok=True)
    png = d / f"{tag}.png"
    try:
        page.screenshot(path=str(png), full_page=True)
    except Exception:
        pass
    try:
        lines = page.inner_text("body", timeout=5000).splitlines()
        head = " / ".join(lines[:6])[:220]
    except Exception:
        head = "(본문을 못 읽음)"
    return f"{png.name} 남김 | 주소 {page.url[:70]} | 화면: {head}"


def request_one(page, url, dry=False):
    # 딥링크(/search-console/inspect)는 없는 경로라 404 가 납니다. 사람이 하는 동선을 그대로 씁니다.
    # 속성 화면을 열고 위쪽 검사 입력창에 주소를 쳐 넣습니다. 구글이 딥링크를 바꿔도 안 깨집니다.
    if PROPERTY not in page.url:
        page.goto(HOME.format(prop=quote(PROPERTY, safe="")), wait_until="domcontentloaded")
        time.sleep(6)
    box = find_box(page)
    if box is None:
        return "검사 입력창을 못 찾았습니다 → " + snapshot(page, "no-box")
    box.click()
    box.fill("")
    box.type(url, delay=10)
    box.press("Enter")
    time.sleep(3)
    # 검사 결과가 나올 때까지 기다립니다. 결과 전에 버튼을 찾으면 늘 못 찾습니다.
    for _ in range(40):
        time.sleep(1.5)
        try:
            if has_text(page, TXT_INDEXED + BTN_REQUEST + TXT_QUOTA):
                break
        except Exception:
            continue
    else:
        # 조용히 실패하면 무엇이 막았는지 영영 모릅니다. 화면을 남깁니다.
        return "결과를 못 읽었습니다 → " + snapshot(page, "no-result")

    if has_text(page, TXT_INDEXED):
        return "이미 색인됨. 건너뜁니다"
    if has_text(page, TXT_QUOTA):
        return "QUOTA"

    btn = find_button(page)
    if btn is None:
        return "요청 버튼을 못 찾았습니다 → " + snapshot(page, "no-button")
    if dry:
        return "버튼 찾음 (dry 라 안 누름)"

    btn.click()
    # 요청은 몇십 초 걸립니다. 끝나기 전에 다음 주소로 넘어가면 요청이 취소됩니다.
    for _ in range(60):
        time.sleep(2)
        try:
            if has_text(page, TXT_DONE):
                return "요청함"
            if has_text(page, TXT_QUOTA):
                return "QUOTA"
        except Exception:
            continue
    return "눌렀는데 확인 문구를 못 봤습니다. 화면을 직접 보세요"


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    login_only = "--login" in args
    days_arg = next((a for a in args if a.startswith("--days=")), None)
    days = int(days_arg.split("=")[1]) if days_arg else 3
    urls = [a for a in args if a.startswith("http")]

    if not urls and not login_only:
        urls = post_urls(days) if ("--new" in args or days_arg) else unindexed_urls()

    if not login_only:
        if not urls:
            log("요청할 주소가 없습니다.")
            return
        log(f"요청할 주소 {len(urls)}개")
        for u in urls:
            log(f"  {u}")
        if len(urls) > 10:
            log("\n  [주의] 하루 한도가 열 건 남짓입니다. 넘는 것은 다음 날 다시 돌리세요.")
        log("")

    from playwright.sync_api import sync_playwright

    PROFILE.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(PROFILE),
            headless=False,  # 로그인 세션을 사람이 확인해야 하므로 창을 띄웁니다
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        page.goto("https://search.google.com/search-console", wait_until="domcontentloaded")
        time.sleep(3)

        # 엔터를 기다리지 않습니다. 이 스크립트는 사람이 붙어 있지 않은 자리에서도 불릴 수 있고,
        # 그때 input() 은 EOF 로 죽습니다. 대신 로그인이 끝났는지를 화면으로 확인합니다.
        if not wait_login(page, minutes=10 if login_only else 5):
            log("  [멈춤] 로그인을 확인하지 못했습니다. 브라우저에서 로그인하고 다시 돌리세요.")
            ctx.close()
            return
        if login_only:
            log("로그인 상태를 저장했습니다. 다음부터는 안 물어봅니다.")
            ctx.close()
            return

        ok = skip = fail = 0
        for i, u in enumerate(urls, 1):
            log(f"[{i}/{len(urls)}] {u}")
            try:
                r = request_one(page, u, dry)
            except Exception as e:
                r = f"오류: {e}"
            if r == "QUOTA":
                log("    하루 한도에 걸렸습니다. 여기서 멈춥니다. 남은 것은 내일 다시 돌리세요.")
                fail += 1
                break
            log(f"    {r}")
            if r.startswith("요청함") or "dry" in r:
                ok += 1
            elif "건너뜁니다" in r:
                skip += 1
            else:
                fail += 1

        log(f"\n요청 {ok} · 건너뜀 {skip} · 실패 {fail}")
        log("색인은 요청한다고 바로 되지 않습니다. 대기열에 들어가는 것이고 며칠 걸립니다.")
        log("결과는 npm run search 로 다시 재보면 됩니다.")
        ctx.close()


if __name__ == "__main__":
    main()

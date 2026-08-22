#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
네이버 서치어드바이저 조작용 브라우저를 띄워 놓습니다.

    python scripts/naver_browser.py          창을 띄우고 계속 살려 둡니다

왜 이렇게 하는가
    서치어드바이저 등록은 한 번에 끝나지 않습니다. 로그인 → 사이트 등록 →
    소유확인용 메타태그 받아오기 → 빌드·배포 → 다시 와서 확인 누르기 →
    사이트맵 제출. 중간에 사람이 하는 일(로그인)과 저장소 작업(배포)이 끼어듭니다.

    그래서 한 번 실행하고 끝나는 스크립트로는 못 합니다. 창을 띄운 채로 두고
    원격 디버깅 포트를 열어 두면, 밖에서 붙어서 한 단계씩 조작할 수 있습니다.

    로그인은 자동화하지 않습니다. 네이버는 자동 로그인을 막고 계정에 경고가 뜹니다.
    사람이 창에서 직접 하고, 세션은 .naver-profile/ 에 남아 다음부터 안 물어봅니다.

끄기
    이 프로세스를 죽이면 창도 같이 닫힙니다.
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE = ROOT / ".naver-profile"
PORT = 9222

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from playwright.sync_api import sync_playwright

PROFILE.mkdir(exist_ok=True)
with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        str(PROFILE),
        headless=False,  # 사람이 로그인해야 하므로 창을 띄웁니다
        viewport={"width": 1400, "height": 950},
        args=[
            f"--remote-debugging-port={PORT}",
            "--disable-blink-features=AutomationControlled",
        ],
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://searchadvisor.naver.com/", wait_until="domcontentloaded")
    print(f"창을 띄웠습니다. 디버깅 포트 {PORT}. 로그인해 주세요.", flush=True)
    print("이 프로세스가 살아 있는 동안 창이 유지됩니다.", flush=True)
    while True:
        time.sleep(5)
        if not ctx.pages:
            print("창이 모두 닫혔습니다. 종료합니다.", flush=True)
            break

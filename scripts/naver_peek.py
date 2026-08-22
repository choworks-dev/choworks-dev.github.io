#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""띄워 둔 브라우저에 붙어 지금 화면을 보고합니다.

    python scripts/naver_peek.py            주소 + 본문 글자 + 화면 캡처
    python scripts/naver_peek.py <파일이름>   캡처 파일 이름 지정

화면을 못 보면 다음 단계를 짐작으로 누르게 됩니다. 그러면 조용히 엉뚱한 것을 누릅니다.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / ".naver-shots"

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from playwright.sync_api import sync_playwright


def attach(pw):
    """띄워 둔 창에 붙습니다. 새로 띄우지 않습니다."""
    b = pw.chromium.connect_over_cdp("http://localhost:9222")
    ctx = b.contexts[0]
    return b, ctx, (ctx.pages[-1] if ctx.pages else ctx.new_page())


if __name__ == "__main__":
    tag = sys.argv[1] if len(sys.argv) > 1 else "now"
    SHOTS.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        b, ctx, page = attach(pw)
        print(f"주소: {page.url}")
        print(f"제목: {page.title()}")
        try:
            print("--- 본문 ---")
            print(page.inner_text("body", timeout=8000)[:3000])
        except Exception as e:
            print(f"(본문을 못 읽음: {e})")
        png = SHOTS / f"{tag}.png"
        try:
            page.screenshot(path=str(png))
            print(f"--- 캡처: {png}")
        except Exception as e:
            print(f"(캡처 실패: {e})")
        b.close()

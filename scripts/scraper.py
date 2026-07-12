"""
Scraper Study4 - phiên bản sửa lỗi: phân tích trang login trước.
"""
import asyncio
import json
from pathlib import Path
# pyrefly: ignore [missing-import]
from playwright.async_api import async_playwright

EMAIL    = "nguyenlinh13125@gmail.com"
PASSWORD = "13102005az"
OUT_FILE = Path(__file__).parent.parent / "data" / "words.json"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Mở cửa sổ để debug
        page    = await browser.new_page()

        # ── Xem trang login thật ──
        print("▶ Mở trang login...")
        await page.goto("https://study4.com/accounts/login/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        # Dump tất cả input fields
        inputs = await page.evaluate("""
        () => [...document.querySelectorAll('input')].map(el => ({
            type: el.type, name: el.name, id: el.id, placeholder: el.placeholder,
            className: el.className.substring(0,80)
        }))
        """)
        print("Inputs found:", json.dumps(inputs, ensure_ascii=False, indent=2))

        # ── Thử login với nhiều selector ──
        filled_email = False
        for sel in ['input[name="login"]','input[name="email"]','input[type="email"]','#id_login','#id_email','input[autocomplete="email"]']:
            try:
                await page.fill(sel, EMAIL, timeout=2000)
                print(f"   ✓ Email field: {sel}")
                filled_email = True
                break
            except: pass

        if not filled_email:
            # Thử fill bằng index
            try:
                await page.locator('input').first.fill(EMAIL)
                print("   ✓ Email: first input")
                filled_email = True
            except: pass

        filled_pw = False
        for sel in ['input[type="password"]','input[name="password"]','#id_password']:
            try:
                await page.fill(sel, PASSWORD, timeout=2000)
                print(f"   ✓ Password field: {sel}")
                filled_pw = True
                break
            except: pass

        if not filled_pw:
            try:
                inputs_list = await page.locator('input').all()
                if len(inputs_list) >= 2:
                    await inputs_list[1].fill(PASSWORD)
                    print("   ✓ Password: second input")
                    filled_pw = True
            except: pass

        if not (filled_email and filled_pw):
            print("❌ Không tìm thấy form đăng nhập!")
            html = await page.content()
            (Path(__file__).parent / "debug_login.html").write_text(html, encoding='utf-8')
            await browser.close()
            return

        # Submit
        for sel in ['button[type="submit"]','input[type="submit"]','.btn-login','.btn-primary']:
            try:
                await page.click(sel, timeout=2000)
                print(f"   ✓ Submit: {sel}")
                break
            except: pass

        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        print(f"   Sau login: {page.url}")

        # ── Mở trang flashcard list ──
        TARGET = "https://study4.com/flashcards/lists/45123/"
        print(f"▶ Mở {TARGET}...")
        await page.goto(TARGET, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Cuộn trang
        for _ in range(20):
            await page.keyboard.press("End")
            await page.wait_for_timeout(500)
        await page.keyboard.press("Home")
        await page.wait_for_timeout(1000)

        # ── Dump HTML để phân tích cấu trúc ──
        html = await page.content()
        text = await page.evaluate("() => document.body.innerText")
        (Path(__file__).parent / "debug_page.html").write_text(html[:80000], encoding='utf-8')
        (Path(__file__).parent / "debug_text.txt").write_text(text[:15000], encoding='utf-8')
        print(f"   Text dump (first 3000):\n{text[:3000]}")

        # ── Thử extract ──
        words = await page.evaluate("""
        () => {
            const results = [];
            let id = 1;
            // Dump all classes for analysis
            const cls = new Set();
            document.querySelectorAll('*').forEach(el => {
                if(el.className && typeof el.className === 'string')
                    el.className.split(' ').forEach(c => c && cls.add(c));
            });
            return {words: results, classes: [...cls].join(',')};
        }
        """)
        print(f"\nAll CSS classes: {words['classes'][:2000]}")

        await page.wait_for_timeout(5000)  # Cho người dùng xem
        await browser.close()

asyncio.run(main())

from playwright.async_api import Page


async def scroll_page(
    page: Page,
    scroll_limit: int,
    wait_ms: int,
    no_change_limit: int,
):
    """동적 페이지의 추가 콘텐츠가 로드되도록 반복 스크롤."""
    previous_height = 0
    unchanged = 0

    for i in range(scroll_limit):
        current_height = await page.evaluate(
            "document.documentElement.scrollHeight"
        )

        await page.evaluate(
            "window.scrollTo(0, document.documentElement.scrollHeight)"
        )

        await page.wait_for_timeout(wait_ms)

        new_height = await page.evaluate(
            "document.documentElement.scrollHeight"
        )

        print(
            f"[스크롤] {i + 1}/{scroll_limit} "
            f"| height={new_height}"
        )

        if new_height == current_height or new_height == previous_height:
            unchanged += 1
        else:
            unchanged = 0

        if unchanged >= no_change_limit:
            break

        previous_height = new_height

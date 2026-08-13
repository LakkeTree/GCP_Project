import asyncio

from config import (
    ENABLE_GOOGLE_PLAY,
    ENABLE_APP_STORE,
    ENABLE_GALAXY_STORE,
    ENABLE_ONE_STORE,
)
from scraper.google_play import scrape_google_play
from scraper.app_store import scrape_app_store
from scraper.galaxy_store import scrape_galaxy_store
from scraper.one_store import scrape_one_store
from merger import create_master_database


async def main():
    print("=" * 70)
    print("Mobile Game Data Collector")
    print("=" * 70)

    if ENABLE_GOOGLE_PLAY:
        await scrape_google_play()

    if ENABLE_APP_STORE:
        await scrape_app_store()

    if ENABLE_GALAXY_STORE:
        await scrape_galaxy_store()

    if ENABLE_ONE_STORE:
        await scrape_one_store()

    create_master_database()

    print("\n완료되었습니다.")


if __name__ == "__main__":
    asyncio.run(main())

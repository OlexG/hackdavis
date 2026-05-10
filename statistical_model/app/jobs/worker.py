import logging
import time

from app.core.config import get_settings
from app.db.mongo import get_db


def main() -> None:
    logging.basicConfig(level=get_settings().log_level)
    logging.info("farm optimizer worker started")
    get_db().command("ping")
    while True:
        # MVP worker keeps the container alive and provides a place for future queued jobs.
        time.sleep(60)


if __name__ == "__main__":
    main()


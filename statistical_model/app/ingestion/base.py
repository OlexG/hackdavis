from datetime import UTC, datetime

import requests
from pymongo.database import Database


def store_raw_source_document(db: Database, source: str, endpoint: str, params: dict, payload: dict | list) -> None:
    db.raw_source_documents.insert_one({
        "source": source,
        "endpoint": endpoint,
        "params": params,
        "payload": payload,
        "pulled_at": datetime.now(UTC),
        "quality_flag": "raw_unvalidated",
    })


def get_json(url: str, params: dict | None = None, headers: dict | None = None, timeout: int = 30) -> dict:
    response = requests.get(url, params=params, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.json()


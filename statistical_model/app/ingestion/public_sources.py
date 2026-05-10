from app.core.config import get_settings
from app.db.mongo import get_db
from app.ingestion.base import get_json, store_raw_source_document


def ingest_nass_quickstats(params: dict) -> dict:
    settings = get_settings()
    query = {**params, "format": "JSON"}
    if settings.nass_api_key:
        query["key"] = settings.nass_api_key
    payload = get_json("https://quickstats.nass.usda.gov/api/api_GET/", params=query)
    store_raw_source_document(get_db(), "USDA_NASS_QUICKSTATS", "api_GET", query, payload)
    return payload


def ingest_nasa_power(params: dict) -> dict:
    payload = get_json("https://power.larc.nasa.gov/api/temporal/daily/point", params=params)
    store_raw_source_document(get_db(), "NASA_POWER", "daily_point", params, payload)
    return payload


def ingest_nws_forecast_gridpoint(office: str, grid_x: int, grid_y: int) -> dict:
    endpoint = f"https://api.weather.gov/gridpoints/{office}/{grid_x},{grid_y}/forecast"
    payload = get_json(endpoint, headers={"User-Agent": "sunpatch-farm-optimizer/0.1"})
    store_raw_source_document(get_db(), "NWS", endpoint, {}, payload)
    return payload


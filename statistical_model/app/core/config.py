from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://mongo:27017"
    mongo_db: str = "farm_optim"
    log_level: str = "INFO"
    nass_api_key: str = ""
    ams_api_key: str = ""
    noaa_token: str = ""
    openet_api_key: str = ""
    default_farm_id: str = "farm_001"
    default_season_year: int = 2026

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


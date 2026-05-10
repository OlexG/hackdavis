from pymongo import ASCENDING, GEOSPHERE
from pymongo.database import Database


def ensure_indexes(db: Database) -> None:
    db.farms.create_index([("farm_id", ASCENDING)], unique=True)

    db.fields.create_index([("farm_id", ASCENDING)])
    db.fields.create_index([("geometry", GEOSPHERE)])
    db.fields.create_index([("location", GEOSPHERE)])

    db.crops.create_index([("crop_name", ASCENDING)])
    db.crops.create_index([("crop_family", ASCENDING)])
    db.crops.create_index([("crop_id", ASCENDING)], unique=True)

    db.crop_families.create_index([("crop_family", ASCENDING)], unique=True)
    db.crop_rotation_rules.create_index([("crop_family", ASCENDING)])
    db.field_crop_history.create_index([("field_id", ASCENDING), ("crop_year", ASCENDING), ("crop_id", ASCENDING)])

    db.soil_properties.create_index([("field_id", ASCENDING)])
    db.weather_daily.create_index([("date", ASCENDING)])
    db.weather_daily.create_index([("source", ASCENDING)])
    db.weather_daily.create_index([("location_id", ASCENDING)])
    db.weather_daily.create_index([("location_id", ASCENDING), ("date", ASCENDING)])
    db.weather_forecasts.create_index([("forecast_date", ASCENDING), ("valid_date", ASCENDING)])
    db.weather_forecasts.create_index([("source", ASCENDING), ("location_id", ASCENDING)])

    db.market_prices.create_index([("crop_id", ASCENDING), ("market_location", ASCENDING), ("date", ASCENDING)])
    db.market_prices.create_index([("source", ASCENDING)])
    db.fertilizer_prices.create_index([("date", ASCENDING), ("nutrient", ASCENDING), ("product", ASCENDING), ("region", ASCENDING)])
    db.labor_rates.create_index([("date", ASCENDING), ("region", ASCENDING), ("labor_class", ASCENDING)])
    db.water_allocations.create_index(
        [("farm_id", ASCENDING), ("field_id", ASCENDING), ("season_year", ASCENDING), ("period_start", ASCENDING), ("period_end", ASCENDING)]
    )
    db.crop_enterprise_budgets.create_index([("crop_id", ASCENDING), ("region", ASCENDING), ("year", ASCENDING)])
    db.feature_snapshots.create_index([("farm_id", ASCENDING), ("run_id", ASCENDING), ("crop_id", ASCENDING), ("field_id", ASCENDING)])
    db.scenario_sets.create_index([("farm_id", ASCENDING), ("scenario_set_id", ASCENDING)], unique=True)
    db.scenario_sets.create_index([("created_at", ASCENDING)])
    db.model_runs.create_index([("farm_id", ASCENDING), ("run_id", ASCENDING)], unique=True)
    db.model_runs.create_index([("created_at", ASCENDING)])
    db.optimization_results.create_index([("farm_id", ASCENDING), ("run_id", ASCENDING)], unique=True)
    db.optimization_results.create_index([("created_at", ASCENDING)])
    db.raw_source_documents.create_index([("source", ASCENDING), ("pulled_at", ASCENDING)])


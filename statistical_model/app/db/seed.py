from datetime import UTC, datetime

from pymongo.database import Database

from app.db.indexes import ensure_indexes


def seed_database(db: Database) -> None:
    ensure_indexes(db)
    now = datetime.now(UTC)

    db.farms.replace_one(
        {"farm_id": "farm_001"},
        {
            "_id": "farm_001",
            "farm_id": "farm_001",
            "name": "Davis Risk-Adjusted Demo Farm",
            "region": "Yolo County, CA",
            "state": "CA",
            "currency": "USD",
            "units": {
                "area": "acres",
                "water": "acre_feet",
                "yield": "crop_specific_per_acre",
                "labor": "hours",
            },
            "source": {"name": "local_seed", "confidence": "demo"},
            "created_at": now,
            "updated_at": now,
        },
        upsert=True,
    )

    fields = [
        {
            "_id": "field_001",
            "farm_id": "farm_001",
            "name": "North 40",
            "acres": 40.2,
            "irrigation_method": "drip",
            "water_source": "district",
            "pump_efficiency": 0.72,
            "geometry": rectangle(-121.755, 38.540, 0.010, 0.006),
            "location": {"type": "Point", "coordinates": [-121.75, 38.543]},
            "source": {"name": "local_seed", "quality_flag": "estimated_boundary"},
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": "field_002",
            "farm_id": "farm_001",
            "name": "West Block",
            "acres": 31.7,
            "irrigation_method": "sprinkler",
            "water_source": "well",
            "pump_efficiency": 0.66,
            "geometry": rectangle(-121.767, 38.533, 0.008, 0.006),
            "location": {"type": "Point", "coordinates": [-121.763, 38.536]},
            "source": {"name": "local_seed", "quality_flag": "estimated_boundary"},
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": "field_003",
            "farm_id": "farm_001",
            "name": "South Clay",
            "acres": 24.5,
            "irrigation_method": "furrow",
            "water_source": "district",
            "pump_efficiency": 0.58,
            "geometry": rectangle(-121.751, 38.525, 0.007, 0.005),
            "location": {"type": "Point", "coordinates": [-121.7475, 38.5275]},
            "source": {"name": "local_seed", "quality_flag": "estimated_boundary"},
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": "field_004",
            "farm_id": "farm_001",
            "name": "River Loam",
            "acres": 18.9,
            "irrigation_method": "drip",
            "water_source": "district",
            "pump_efficiency": 0.76,
            "geometry": rectangle(-121.739, 38.535, 0.006, 0.004),
            "location": {"type": "Point", "coordinates": [-121.736, 38.537]},
            "source": {"name": "local_seed", "quality_flag": "estimated_boundary"},
            "created_at": now,
            "updated_at": now,
        },
    ]
    upsert_many(db.fields, fields)

    crop_families = [
        {"_id": "solanaceae", "crop_family": "solanaceae", "name": "Nightshades", "source": seed_source(now), "updated_at": now},
        {"_id": "poaceae", "crop_family": "poaceae", "name": "Grasses", "source": seed_source(now), "updated_at": now},
        {"_id": "fabaceae", "crop_family": "fabaceae", "name": "Legumes", "source": seed_source(now), "updated_at": now},
        {"_id": "cucurbitaceae", "crop_family": "cucurbitaceae", "name": "Cucurbits", "source": seed_source(now), "updated_at": now},
        {"_id": "brassicaceae", "crop_family": "brassicaceae", "name": "Brassicas", "source": seed_source(now), "updated_at": now},
    ]
    upsert_many(db.crop_families, crop_families)

    crops = [
        crop("tomatoes", "Processing Tomatoes", "solanaceae", "tons_per_acre", "ton", 44, 34, 55, 118, 96, 145, 10, 25, 33, 18),
        crop("corn", "Sweet Corn", "poaceae", "cwt_per_acre", "cwt", 190, 145, 230, 28, 22, 34, 12, 21, 31, 16),
        crop("alfalfa", "Alfalfa Hay", "fabaceae", "tons_per_acre", "ton", 7.1, 5.4, 8.4, 230, 180, 285, 4, 14, 40, 20),
        crop("winter_squash", "Winter Squash", "cucurbitaceae", "tons_per_acre", "ton", 18, 13, 24, 420, 310, 540, 11, 23, 38, 15),
        crop("broccoli", "Broccoli", "brassicaceae", "cartons_per_acre", "carton", 740, 570, 900, 13.5, 10.5, 17.5, 3, 10, 18, 11),
    ]
    upsert_many(db.crops, crops)

    rotation_rules = [
        {"_id": "rot_solanaceae", "crop_family": "solanaceae", "lookback_years": 3, "max_same_family_count": 0, "source": seed_source(now), "updated_at": now},
        {"_id": "rot_cucurbitaceae", "crop_family": "cucurbitaceae", "lookback_years": 2, "max_same_family_count": 0, "source": seed_source(now), "updated_at": now},
        {"_id": "rot_brassicaceae", "crop_family": "brassicaceae", "lookback_years": 2, "max_same_family_count": 1, "source": seed_source(now), "updated_at": now},
        {"_id": "rot_poaceae", "crop_family": "poaceae", "lookback_years": 2, "max_same_family_count": 1, "source": seed_source(now), "updated_at": now},
        {"_id": "rot_fabaceae", "crop_family": "fabaceae", "lookback_years": 1, "max_same_family_count": 1, "source": seed_source(now), "updated_at": now},
    ]
    upsert_many(db.crop_rotation_rules, rotation_rules)

    history = [
        hist("field_001", 2025, "tomatoes", "solanaceae"),
        hist("field_001", 2024, "corn", "poaceae"),
        hist("field_002", 2025, "alfalfa", "fabaceae"),
        hist("field_002", 2024, "alfalfa", "fabaceae"),
        hist("field_003", 2025, "broccoli", "brassicaceae"),
        hist("field_004", 2025, "winter_squash", "cucurbitaceae"),
    ]
    upsert_many(db.field_crop_history, history)

    soil = [
        soil_doc("field_001", 0.86, 28, 6.7, "loam", now),
        soil_doc("field_002", 0.73, 22, 6.4, "sandy_loam", now),
        soil_doc("field_003", 0.58, 38, 7.2, "clay_loam", now),
        soil_doc("field_004", 0.91, 31, 6.8, "silt_loam", now),
    ]
    upsert_many(db.soil_properties, soil)

    budgets = [budget(c, now) for c in crops]
    upsert_many(db.crop_enterprise_budgets, budgets)

    prices = [
        market_price(crop_id, c["expected_price_per_unit_usd"], c["price_p10_usd"], c["price_p90_usd"], now)
        for crop_id, c in ((c["_id"], c) for c in crops)
    ]
    upsert_many(db.market_prices, prices)

    fertilizer = [
        fert("nitrogen", "urea_46_0_0", 0.72, "usd_per_lb_nutrient", now),
        fert("phosphorus", "map_11_52_0", 0.86, "usd_per_lb_nutrient", now),
        fert("potassium", "potash_0_0_60", 0.61, "usd_per_lb_nutrient", now),
    ]
    upsert_many(db.fertilizer_prices, fertilizer)

    labor = [
        {"_id": "labor_general_2026", "date": "2026-01-01", "region": "Yolo County, CA", "labor_class": "general", "wage_rate_usd_per_hour": 21.5, "source": seed_source(now), "updated_at": now},
        {"_id": "labor_harvest_2026", "date": "2026-01-01", "region": "Yolo County, CA", "labor_class": "harvest", "wage_rate_usd_per_hour": 24.75, "source": seed_source(now), "updated_at": now},
    ]
    upsert_many(db.labor_rates, labor)

    water_allocations = [
        {
            "_id": f"water_farm_001_2026_w{week:02d}",
            "farm_id": "farm_001",
            "field_id": None,
            "season_year": 2026,
            "period_start": f"2026-W{week:02d}",
            "period_end": f"2026-W{week:02d}",
            "allocation_acre_feet": 26.5 if 15 <= week <= 38 else 6.0,
            "cost_usd_per_acre_foot": 82.0,
            "source": seed_source(now),
            "updated_at": now,
        }
        for week in range(1, 53)
    ]
    upsert_many(db.water_allocations, water_allocations)

    db.labor_availability.delete_many({"farm_id": "farm_001", "season_year": 2026})
    db.labor_availability.insert_many([
        {
            "_id": f"labor_avail_farm_001_2026_w{week:02d}",
            "farm_id": "farm_001",
            "season_year": 2026,
            "week": week,
            "available_hours": 520 if 10 <= week <= 42 else 240,
            "unit": "hours",
            "source": seed_source(now),
            "updated_at": now,
        }
        for week in range(1, 53)
    ])

    db.weather_daily.replace_one(
        {"_id": "weather_yolo_normals_2026"},
        {
            "_id": "weather_yolo_normals_2026",
            "location_id": "yolo_county_ca",
            "date": "2026-01-01",
            "source": "NASA_POWER_seed_fallback",
            "rainfall_inches_seasonal": 17.4,
            "gdd_base50": 2940,
            "heat_stress_days_over_95f": 21,
            "quality_flag": "fallback_climatology",
            "source_metadata": seed_source(now),
            "updated_at": now,
        },
        upsert=True,
    )


def rectangle(lon: float, lat: float, width: float, height: float) -> dict:
    coords = [
        [lon, lat],
        [lon + width, lat],
        [lon + width, lat + height],
        [lon, lat + height],
        [lon, lat],
    ]
    return {"type": "Polygon", "coordinates": [coords]}


def seed_source(now: datetime) -> dict:
    return {"name": "local_seed", "pulled_at": now, "confidence": "demo"}


def crop(
    crop_id: str,
    crop_name: str,
    family: str,
    yield_unit: str,
    market_unit: str,
    y_mean: float,
    y_p10: float,
    y_p90: float,
    price: float,
    price_p10: float,
    price_p90: float,
    plant_start_week: int,
    plant_end_week: int,
    harvest_week: int,
    harvest_duration_weeks: int,
) -> dict:
    return {
        "_id": crop_id,
        "crop_id": crop_id,
        "crop_name": crop_name,
        "crop_family": family,
        "yield_unit": yield_unit,
        "market_unit": market_unit,
        "baseline_yield_per_acre": y_mean,
        "yield_p10_per_acre": y_p10,
        "yield_p90_per_acre": y_p90,
        "expected_price_per_unit_usd": price,
        "price_p10_usd": price_p10,
        "price_p90_usd": price_p90,
        "planting_window": {"start_week": plant_start_week, "end_week": plant_end_week},
        "harvest_window": {"start_week": harvest_week, "end_week": min(52, harvest_week + harvest_duration_weeks)},
        "nutrient_need_lbs_per_acre": {"nitrogen": 130, "phosphorus": 45, "potassium": 80},
        "source": {"name": "local_seed", "confidence": "demo"},
    }


def hist(field_id: str, crop_year: int, crop_id: str, family: str) -> dict:
    return {
        "_id": f"{field_id}_{crop_year}_{crop_id}",
        "field_id": field_id,
        "crop_year": crop_year,
        "crop_id": crop_id,
        "crop_family": family,
        "acres": None,
        "source": {"name": "local_seed", "confidence": "demo"},
    }


def soil_doc(field_id: str, quality: float, clay_pct: float, ph: float, texture: str, now: datetime) -> dict:
    return {
        "_id": f"soil_{field_id}",
        "field_id": field_id,
        "soil_quality_index": quality,
        "clay_percent": clay_pct,
        "ph": ph,
        "texture_class": texture,
        "organic_matter_percent": round(1.4 + quality * 2.1, 2),
        "source_metadata": seed_source(now),
        "quality_flag": "demo_estimate",
        "updated_at": now,
    }


def budget(crop_doc: dict, now: datetime) -> dict:
    crop_id = crop_doc["_id"]
    multipliers = {
        "tomatoes": (620, 390, 280, 540, 350, 180),
        "corn": (230, 210, 160, 220, 160, 90),
        "alfalfa": (180, 120, 70, 260, 120, 80),
        "winter_squash": (300, 240, 190, 420, 230, 120),
        "broccoli": (450, 360, 310, 680, 410, 160),
    }
    seed, chemical, machinery, harvest, transport, other = multipliers[crop_id]
    return {
        "_id": f"budget_{crop_id}_yolo_2026",
        "crop_id": crop_id,
        "region": "Yolo County, CA",
        "year": 2026,
        "seed_cost_usd_per_acre": seed,
        "chemical_cost_usd_per_acre": chemical,
        "machinery_cost_usd_per_acre": machinery,
        "harvest_cost_usd_per_acre": harvest,
        "transport_storage_cost_usd_per_acre": transport,
        "other_variable_costs_usd_per_acre": other,
        "source": seed_source(now),
        "updated_at": now,
    }


def market_price(crop_id: str, price: float, p10: float, p90: float, now: datetime) -> dict:
    return {
        "_id": f"market_{crop_id}_yolo_2026",
        "crop_id": crop_id,
        "date": "2026-01-01",
        "market_location": "Yolo/Sacramento regional",
        "source": "local_seed_ams_fallback",
        "expected_price_usd_per_unit": price,
        "p10_price_usd_per_unit": p10,
        "p90_price_usd_per_unit": p90,
        "quality_flag": "demo_estimate",
        "updated_at": now,
    }


def fert(nutrient: str, product: str, price: float, unit: str, now: datetime) -> dict:
    return {
        "_id": f"fert_{nutrient}_2026",
        "date": "2026-01-01",
        "nutrient": nutrient,
        "product": product,
        "region": "Northern California",
        "price_usd_per_unit": price,
        "unit": unit,
        "source": seed_source(now),
        "updated_at": now,
    }


def upsert_many(collection, docs: list[dict]) -> None:
    for doc in docs:
        collection.replace_one({"_id": doc["_id"]}, doc, upsert=True)

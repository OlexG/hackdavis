from datetime import UTC, datetime
from uuid import uuid4

from pymongo.database import Database

from app.models.price_model import estimate_price
from app.models.yield_model import estimate_yield

WEEKS = range(1, 53)


def build_feature_snapshots(db: Database, farm_id: str, season_year: int, run_id: str | None = None) -> list[dict]:
    run_id = run_id or f"run_{uuid4().hex[:12]}"
    now = datetime.now(UTC)

    fields = list(db.fields.find({"farm_id": farm_id}))
    crops = list(db.crops.find({}))
    soils = {doc["field_id"]: doc for doc in db.soil_properties.find({"field_id": {"$in": [f["_id"] for f in fields]}})}
    weather = db.weather_daily.find_one({"location_id": "yolo_county_ca"}, sort=[("date", -1)])
    budgets = {doc["crop_id"]: doc for doc in db.crop_enterprise_budgets.find({"year": season_year})}
    market_prices = {
        doc["crop_id"]: doc
        for doc in db.market_prices.find({}, sort=[("date", -1)])
    }
    fertilizer_prices = {
        doc["nutrient"]: float(doc["price_usd_per_unit"])
        for doc in db.fertilizer_prices.find({}, sort=[("date", -1)])
    }
    labor_rate = db.labor_rates.find_one({"labor_class": "general"}, sort=[("date", -1)]) or {"wage_rate_usd_per_hour": 22.0}

    docs: list[dict] = []
    for field in fields:
        for crop in crops:
            rotation = rotation_status(db, field["_id"], crop, season_year)
            y = estimate_yield(crop, field, soils.get(field["_id"]), weather, rotation["eligible"])
            p = estimate_price(crop, market_prices.get(crop["_id"]))
            budget = budgets.get(crop["_id"], {})
            nutrient_need = crop.get("nutrient_need_lbs_per_acre", {})
            fertilizer_cost = {
                nutrient: round(float(lbs) * fertilizer_prices.get(nutrient, 0.75), 2)
                for nutrient, lbs in nutrient_need.items()
            }
            weekly_labor = weekly_labor_requirement(crop)
            weekly_water = weekly_water_requirement(crop, field)
            labor_cost = sum(weekly_labor.values()) * float(labor_rate["wage_rate_usd_per_hour"])
            irrigation_cost = sum(weekly_water.values()) * 82.0
            static_costs = {
                "seed_cost_usd_per_acre": float(budget.get("seed_cost_usd_per_acre", 250)),
                "chemical_cost_usd_per_acre": float(budget.get("chemical_cost_usd_per_acre", 160)),
                "machinery_cost_usd_per_acre": float(budget.get("machinery_cost_usd_per_acre", 180)),
                "harvest_cost_usd_per_acre": float(budget.get("harvest_cost_usd_per_acre", 300)),
                "transport_storage_cost_usd_per_acre": float(budget.get("transport_storage_cost_usd_per_acre", 140)),
                "other_variable_costs_usd_per_acre": float(budget.get("other_variable_costs_usd_per_acre", 100)),
            }
            revenue = y["expected_yield_per_acre"] * p["expected_price_usd_per_unit"]
            variable_costs = sum(static_costs.values()) + sum(fertilizer_cost.values()) + labor_cost + irrigation_cost

            docs.append({
                "_id": f"{run_id}_{field['_id']}_{crop['_id']}",
                "run_id": run_id,
                "farm_id": farm_id,
                "season_year": season_year,
                "field_id": field["_id"],
                "field_name": field["name"],
                "field_acres": float(field["acres"]),
                "crop_id": crop["_id"],
                "crop_name": crop["crop_name"],
                "crop_family": crop["crop_family"],
                "yield": y,
                "price": p,
                "nutrient_need_lbs_per_acre": nutrient_need,
                "fertilizer_cost_by_nutrient_usd_per_acre": fertilizer_cost,
                "labor_cost_usd_per_acre": round(labor_cost, 2),
                "irrigation_water_cost_usd_per_acre": round(irrigation_cost, 2),
                **static_costs,
                "expected_revenue_usd_per_acre": round(revenue, 2),
                "expected_gross_margin_usd_per_acre": round(revenue - variable_costs, 2),
                "rotation": rotation,
                "planting_window": crop["planting_window"],
                "harvest_window": crop["harvest_window"],
                "weekly_labor_hours_per_acre": weekly_labor,
                "weekly_water_acre_feet_per_acre": weekly_water,
                "units": {
                    "area": "acres",
                    "water": "acre_feet",
                    "labor": "hours",
                    "currency": "USD",
                    "yield": y["yield_unit"],
                    "market_price": f"usd_per_{p['market_unit']}",
                },
                "source_metadata": {
                    "created_from": ["fields", "crops", "soil_properties", "market_prices", "fertilizer_prices", "labor_rates"],
                    "generated_at": now,
                    "quality_flag": "demo_mvp",
                },
                "created_at": now,
                "updated_at": now,
            })

    db.feature_snapshots.delete_many({"farm_id": farm_id, "run_id": run_id})
    if docs:
        db.feature_snapshots.insert_many(docs)
    return docs


def rotation_status(db: Database, field_id: str, crop: dict, season_year: int) -> dict:
    rule = db.crop_rotation_rules.find_one({"crop_family": crop["crop_family"]}) or {
        "lookback_years": 1,
        "max_same_family_count": 1,
    }
    cutoff = season_year - int(rule["lookback_years"])
    history = list(db.field_crop_history.find({"field_id": field_id, "crop_year": {"$gt": cutoff, "$lt": season_year}}))
    same_family_count = sum(1 for row in history if row.get("crop_family") == crop["crop_family"])
    eligible = same_family_count <= int(rule.get("max_same_family_count", 0))
    return {
        "eligible": eligible,
        "reason": "passes rotation rule" if eligible else f"{crop['crop_family']} planted too recently",
        "lookback_years": int(rule["lookback_years"]),
        "same_family_count": same_family_count,
    }


def weekly_labor_requirement(crop: dict) -> dict[str, float]:
    plant = crop["planting_window"]
    harvest = crop["harvest_window"]
    weekly = {week: 0.0 for week in WEEKS}
    for week in range(int(plant["start_week"]), int(plant["end_week"]) + 1):
        weekly[week] += 1.3
    for week in range(int(harvest["start_week"]), int(harvest["end_week"]) + 1):
        weekly[week] += 2.8 if crop["_id"] in {"tomatoes", "broccoli", "winter_squash"} else 1.4
    for week in range(plant["end_week"] + 1, harvest["start_week"]):
        if week % 3 == 0:
            weekly[week] += 0.35
    return {str(week): round(value, 3) for week, value in weekly.items() if value > 0}


def weekly_water_requirement(crop: dict, field: dict) -> dict[str, float]:
    plant = int(crop["planting_window"]["end_week"])
    harvest = int(crop["harvest_window"]["start_week"])
    crop_factor = {
        "tomatoes": 0.115,
        "corn": 0.095,
        "alfalfa": 0.13,
        "winter_squash": 0.075,
        "broccoli": 0.06,
    }.get(crop["_id"], 0.08)
    efficiency = max(0.45, float(field.get("pump_efficiency", 0.7)))
    weekly = {}
    for week in range(max(1, plant), min(52, harvest + 2) + 1):
        heat_multiplier = 1.18 if 24 <= week <= 36 else 1.0
        weekly[str(week)] = round((crop_factor * heat_multiplier) / efficiency, 4)
    return weekly

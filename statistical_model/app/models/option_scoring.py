from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from typing import Any

import numpy as np
from pymongo.database import Database


SQUARE_FEET_PER_ACRE = 43_560

PLANT_CATEGORY_DEFAULTS = {
    "sprouts": {"price": 3.5, "labor": 210, "seed": 900, "fertilizer": 220, "market": 0.58, "scale": 0.42, "gross_cap": 80_000},
    "microgreen": {"price": 5.0, "labor": 260, "seed": 1200, "fertilizer": 180, "market": 0.62, "scale": 0.38, "gross_cap": 90_000},
    "herb": {"price": 3.25, "labor": 145, "seed": 580, "fertilizer": 260, "market": 0.72, "scale": 0.64, "gross_cap": 55_000},
    "leafy_green": {"price": 1.75, "labor": 130, "seed": 420, "fertilizer": 420, "market": 0.78, "scale": 0.78, "gross_cap": 48_000},
    "vegetable": {"price": 1.35, "labor": 120, "seed": 360, "fertilizer": 520, "market": 0.74, "scale": 0.82, "gross_cap": 36_000},
    "root": {"price": 1.15, "labor": 95, "seed": 260, "fertilizer": 440, "market": 0.68, "scale": 0.84, "gross_cap": 30_000},
    "fruit": {"price": 1.85, "labor": 150, "seed": 620, "fertilizer": 500, "market": 0.76, "scale": 0.74, "gross_cap": 42_000},
    "fruit_tree": {"price": 2.3, "labor": 110, "seed": 950, "fertilizer": 620, "market": 0.72, "scale": 0.70, "gross_cap": 24_000},
    "tree_nut": {"price": 3.4, "labor": 85, "seed": 1100, "fertilizer": 700, "market": 0.82, "scale": 0.78, "gross_cap": 18_000},
    "grain": {"price": 0.34, "labor": 35, "seed": 150, "fertilizer": 340, "market": 0.64, "scale": 0.92, "gross_cap": 3_500},
    "legume": {"price": 0.75, "labor": 55, "seed": 180, "fertilizer": 220, "market": 0.66, "scale": 0.86, "gross_cap": 5_500},
    "succulent": {"price": 2.4, "labor": 90, "seed": 300, "fertilizer": 120, "market": 0.52, "scale": 0.48, "gross_cap": 38_000},
}

ANIMAL_DEFAULTS = {
    "chickens": {"meat_price": 6.0, "annual_yield": 270, "yield_price": 0.34, "feed": 34, "labor": 7.0, "market": 0.78},
    "ducks": {"meat_price": 6.5, "annual_yield": 230, "yield_price": 0.55, "feed": 48, "labor": 7.8, "market": 0.70},
    "quails": {"meat_price": 8.0, "annual_yield": 280, "yield_price": 0.12, "feed": 9, "labor": 4.5, "market": 0.56},
    "rabbits": {"meat_price": 9.5, "annual_yield": 5, "yield_price": 24.0, "feed": 42, "labor": 6.5, "market": 0.58},
    "pigs": {"meat_price": 4.2, "annual_yield": 1, "yield_price": 0, "feed": 520, "labor": 14, "market": 0.74},
    "cows": {"meat_price": 4.0, "annual_yield": 1, "yield_price": 0, "feed": 760, "labor": 28, "market": 0.76},
    "sheep": {"meat_price": 8.5, "annual_yield": 1, "yield_price": 36, "feed": 160, "labor": 11, "market": 0.68},
    "goats": {"meat_price": 9.0, "annual_yield": 1, "yield_price": 80, "feed": 185, "labor": 12, "market": 0.70},
}


def score_all_options(
    db: Database,
    farm_id: str,
    season_year: int,
    scenario_count: int,
    random_seed: int,
    risk_tolerance: float,
    farm_area_acres: float | None = None,
    location: dict[str, float] | None = None,
    current_plan: dict[str, Any] | None = None,
) -> dict:
    now = datetime.now(UTC)
    area_acres = usable_area_acres(db, farm_id, farm_area_acres, current_plan)
    weather = latest_weather(db)
    soil = average_soil(db, farm_id)
    market_prices = latest_market_prices(db)
    labor_rate = latest_labor_rate(db)
    water = water_context(db, farm_id, season_year)
    rng = np.random.default_rng(random_seed)

    context = {
        "farm_area_acres": round(area_acres, 3),
        "farm_area_square_feet": round(area_acres * SQUARE_FEET_PER_ACRE, 1),
        "location": location,
        "weather": weather,
        "soil": soil,
        "labor_rate_usd_per_hour": labor_rate,
        "water_cost_usd_per_acre_foot": water["cost_usd_per_acre_foot"],
        "seasonal_water_allocation_acre_feet": water["seasonal_allocation_acre_feet"],
        "scenario_count": scenario_count,
        "random_seed": random_seed,
        "risk_tolerance": risk_tolerance,
    }

    plant_docs = load_plants(db)
    animal_docs = load_animals(db)
    plant_scores = [
        score_plant(doc, area_acres, weather, soil, market_prices, labor_rate, water, scenario_count, rng, risk_tolerance)
        for doc in plant_docs
    ]
    animal_scores = [
        score_animal(doc, area_acres, weather, labor_rate, scenario_count, rng, risk_tolerance)
        for doc in animal_docs
    ]

    ranked = sorted(plant_scores + animal_scores, key=lambda item: (-item["score"], item["name"]))
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index

    return {
        "farm_id": farm_id,
        "season_year": season_year,
        "generated_at": now.isoformat(),
        "ranked_options": ranked,
        "plant_options": [item for item in ranked if item["category"] == "plant"],
        "animal_options": [item for item in ranked if item["category"] == "animal"],
        "context": context,
    }


def score_plant(
    plant: dict,
    area_acres: float,
    weather: dict,
    soil: dict,
    market_prices: dict[str, dict],
    labor_rate: float,
    water: dict,
    scenario_count: int,
    rng: np.random.Generator,
    risk_tolerance: float,
) -> dict:
    option_id = str(plant.get("crop_id") or plant.get("_id") or slugify(str(plant.get("common_name", "plant"))))
    name = str(plant.get("common_name") or plant.get("crop_name") or option_id.replace("-", " ").title())
    category = str(plant.get("crop_category") or "vegetable")
    defaults = category_defaults(category)
    ideal_space = positive_float(plant.get("ideal_space"), 25)
    capacity = max(1, int((area_acres * SQUARE_FEET_PER_ACRE) / ideal_space))
    capacity_per_acre = max(1, int(SQUARE_FEET_PER_ACRE / ideal_space))
    yield_count = positive_float(plant.get("yield_count"), 1)
    market = market_prices.get(option_id) or market_prices.get(slugify(name)) or {}
    unit_price = positive_float(market.get("expected_price_usd_per_unit"), defaults["price"])
    climate_score = plant_climate_score(plant, weather)
    soil_score = plant_soil_score(plant, soil)
    water_score = plant_water_score(plant, water, area_acres)
    space_score = plant_space_score(ideal_space, area_acres)
    market_score = clamp(float(defaults["market"]) + (0.08 if market else 0), 0.2, 0.95)
    scale_factor = float(defaults["scale"])

    raw_gross_per_acre = capacity_per_acre * yield_count * unit_price * scale_factor * climate_score * soil_score
    gross_per_acre = compressed_gross_per_acre(raw_gross_per_acre, float(defaults["gross_cap"]))
    management_penalty = 1 + max(0, 1 - ideal_space) * 0.18
    cost_per_acre = (
        float(defaults["seed"])
        + float(defaults["fertilizer"]) * (0.85 + 0.3 * (1 - soil_score))
        + float(defaults["labor"]) * labor_rate * management_penalty
        + plant_water_cost_per_acre(plant, water)
        + 420
    )
    expected_profit_per_acre = gross_per_acre - cost_per_acre
    total_expected_profit = expected_profit_per_acre * area_acres
    scenario_profits = plant_scenario_profits(
        total_expected_profit,
        scenario_count,
        rng,
        climate_score,
        market_score,
        water_score,
        category,
    )
    p10_profit = percentile(scenario_profits, 10)
    probability_of_loss = float(np.mean(np.array(scenario_profits) < 0))
    risk_resilience = clamp(1 - probability_of_loss - max(0, -p10_profit) / max(1, abs(total_expected_profit) + 10_000), 0, 1)
    profit_component = clamp((expected_profit_per_acre + 2_000) / 12_000, 0, 1)
    score = 100 * (
        0.34 * profit_component
        + 0.18 * climate_score
        + 0.14 * space_score
        + 0.12 * market_score
        + 0.12 * water_score
        + 0.10 * risk_resilience
    )
    score -= risk_tolerance * probability_of_loss * 18
    score = clamp(score, 0, 100)

    warnings = []
    if area_acres < 1:
        warnings.append("Farm area is below the intended 1 acre minimum; score is directional only.")
    if climate_score < 0.55:
        warnings.append("Climate fit is weak for the current weather assumptions.")
    if water_score < 0.55:
        warnings.append("Water requirement may be high for available allocation.")
    if not market:
        warnings.append("No direct local market price found; category fallback price used.")

    return {
        "option_id": option_id,
        "category": "plant",
        "name": name,
        "score": round(score, 2),
        "rank": 0,
        "expected_profit_usd": round(total_expected_profit, 2),
        "expected_profit_usd_per_acre": round(expected_profit_per_acre, 2),
        "p10_profit_usd": round(p10_profit, 2),
        "probability_of_loss": round(probability_of_loss, 4),
        "capacity_units": capacity,
        "ideal_space_square_feet": round(ideal_space, 2),
        "score_breakdown": {
            "profit": round(profit_component * 100, 2),
            "climate": round(climate_score * 100, 2),
            "space": round(space_score * 100, 2),
            "market": round(market_score * 100, 2),
            "water": round(water_score * 100, 2),
            "risk": round(risk_resilience * 100, 2),
        },
        "assumptions": {
            "yield_count_per_unit": yield_count,
            "price_usd_per_unit": round(unit_price, 2),
            "category": category,
            "source_collection": "plants",
        },
        "reasons": top_reasons("plant", profit_component, climate_score, space_score, market_score, water_score, risk_resilience),
        "warnings": warnings,
    }


def score_animal(
    animal: dict,
    area_acres: float,
    weather: dict,
    labor_rate: float,
    scenario_count: int,
    rng: np.random.Generator,
    risk_tolerance: float,
) -> dict:
    option_id = str(animal.get("livestock_id") or animal.get("animal_id") or animal.get("_id") or slugify(str(animal.get("name", "animal"))))
    name = str(animal.get("name") or option_id.replace("-", " ").title())
    defaults = ANIMAL_DEFAULTS.get(option_id, ANIMAL_DEFAULTS.get(slugify(name), {"meat_price": 6.0, "annual_yield": 1, "yield_price": 0, "feed": 120, "labor": 8, "market": 0.55}))
    ideal_space = positive_float(animal.get("ideal_space"), 100)
    capacity = max(1, int((area_acres * SQUARE_FEET_PER_ACRE) / ideal_space))
    meat_yield = positive_float(animal.get("meat_yield"), 1)
    market_score = float(defaults["market"])
    climate_score = animal_climate_score(option_id, weather)
    space_score = animal_space_score(ideal_space, area_acres)
    labor_hours = float(defaults["labor"])
    revenue_per_head = meat_yield * float(defaults["meat_price"]) + float(defaults["annual_yield"]) * float(defaults["yield_price"])
    cost_per_head = float(defaults["feed"]) + labor_hours * labor_rate + 28
    expected_profit_per_head = (revenue_per_head - cost_per_head) * climate_score
    expected_profit = expected_profit_per_head * capacity
    expected_profit_per_acre = expected_profit / max(0.01, area_acres)
    scenario_profits = animal_scenario_profits(expected_profit, scenario_count, rng, climate_score, market_score)
    p10_profit = percentile(scenario_profits, 10)
    probability_of_loss = float(np.mean(np.array(scenario_profits) < 0))
    risk_resilience = clamp(1 - probability_of_loss - max(0, -p10_profit) / max(1, abs(expected_profit) + 10_000), 0, 1)
    profit_component = clamp((expected_profit_per_acre + 1_000) / 8_000, 0, 1)
    score = 100 * (
        0.35 * profit_component
        + 0.17 * climate_score
        + 0.20 * space_score
        + 0.13 * market_score
        + 0.15 * risk_resilience
    )
    score -= risk_tolerance * probability_of_loss * 18
    score = clamp(score, 0, 100)

    warnings = []
    if area_acres < 1:
        warnings.append("Farm area is below the intended 1 acre minimum; score is directional only.")
    if capacity < 2 and option_id not in {"cows", "pigs"}:
        warnings.append("Available mapped space supports very few animals for this option.")
    if climate_score < 0.6:
        warnings.append("Heat or weather stress reduces suitability under current assumptions.")

    return {
        "option_id": option_id,
        "category": "animal",
        "name": name,
        "score": round(score, 2),
        "rank": 0,
        "expected_profit_usd": round(expected_profit, 2),
        "expected_profit_usd_per_acre": round(expected_profit_per_acre, 2),
        "p10_profit_usd": round(p10_profit, 2),
        "probability_of_loss": round(probability_of_loss, 4),
        "capacity_units": capacity,
        "ideal_space_square_feet": round(ideal_space, 2),
        "score_breakdown": {
            "profit": round(profit_component * 100, 2),
            "climate": round(climate_score * 100, 2),
            "space": round(space_score * 100, 2),
            "market": round(market_score * 100, 2),
            "risk": round(risk_resilience * 100, 2),
        },
        "assumptions": {
            "meat_yield_kg_per_head": meat_yield,
            "revenue_usd_per_head": round(revenue_per_head, 2),
            "cost_usd_per_head": round(cost_per_head, 2),
            "source_collection": "livestock",
        },
        "reasons": top_reasons("animal", profit_component, climate_score, space_score, market_score, 1, risk_resilience),
        "warnings": warnings,
    }


def load_plants(db: Database) -> list[dict]:
    plants = list(db.plants.find({}, {"_id": 0}).sort("common_name", 1))
    if plants:
        return plants
    return [
        {
            "crop_id": crop.get("crop_id"),
            "common_name": crop.get("crop_name"),
            "crop_category": "vegetable",
            "yield_count": crop.get("baseline_yield_per_acre", 1),
            "ideal_space": SQUARE_FEET_PER_ACRE,
        }
        for crop in db.crops.find({}, {"_id": 0})
    ]


def load_animals(db: Database) -> list[dict]:
    livestock = list(db.livestock.find({}, {"_id": 0}).sort("name", 1))
    if livestock:
        return livestock
    return list(db.animals.find({}, {"_id": 0}).sort("name", 1))


def usable_area_acres(db: Database, farm_id: str, farm_area_acres: float | None, current_plan: dict[str, Any] | None) -> float:
    if farm_area_acres and farm_area_acres > 0:
        return max(0.01, farm_area_acres)
    plan_area = (((current_plan or {}).get("boundary") or {}).get("areaSquareFeet"))
    if isinstance(plan_area, (int, float)) and plan_area > 0:
        return max(0.01, float(plan_area) / SQUARE_FEET_PER_ACRE)
    field_acres = sum(positive_float(field.get("acres"), 0) for field in db.fields.find({"farm_id": farm_id}, {"acres": 1}))
    return max(1.0, field_acres)


def latest_weather(db: Database) -> dict:
    doc = db.weather_daily.find_one({}, {"_id": 0}, sort=[("date", -1)]) or {}
    rainfall_inches = positive_float(doc.get("rainfall_inches_seasonal"), 17.4)
    heat_stress_days = positive_float(doc.get("heat_stress_days_over_95f"), 21)
    return {
        "rainfall_inches_seasonal": rainfall_inches,
        "rainfall_mm_seasonal": rainfall_inches * 25.4,
        "gdd_base50": positive_float(doc.get("gdd_base50"), 2940),
        "heat_stress_days_over_95f": heat_stress_days,
        "mean_growing_temp_c": clamp(22.5 + heat_stress_days / 25, 10, 34),
        "source": doc.get("source", "fallback_climatology"),
    }


def average_soil(db: Database, farm_id: str) -> dict:
    fields = [field["_id"] for field in db.fields.find({"farm_id": farm_id}, {"_id": 1})]
    docs = list(db.soil_properties.find({"field_id": {"$in": fields}}, {"_id": 0}))
    if not docs:
        return {"soil_quality_index": 0.68, "ph": 6.8, "texture_class": "loam"}
    return {
        "soil_quality_index": sum(positive_float(doc.get("soil_quality_index"), 0.68) for doc in docs) / len(docs),
        "ph": sum(positive_float(doc.get("ph"), 6.8) for doc in docs) / len(docs),
        "texture_class": docs[0].get("texture_class", "loam"),
    }


def latest_market_prices(db: Database) -> dict[str, dict]:
    prices: dict[str, dict] = {}
    for doc in db.market_prices.find({}, {"_id": 0}).sort("date", -1):
        crop_id = str(doc.get("crop_id", ""))
        if crop_id and crop_id not in prices:
            prices[crop_id] = doc
    return prices


def latest_labor_rate(db: Database) -> float:
    doc = db.labor_rates.find_one({}, {"_id": 0}, sort=[("date", -1)]) or {}
    return positive_float(doc.get("wage_rate_usd_per_hour"), 22)


def water_context(db: Database, farm_id: str, season_year: int) -> dict:
    docs = list(db.water_allocations.find({"farm_id": farm_id, "season_year": season_year}, {"_id": 0}))
    if not docs:
        return {"seasonal_allocation_acre_feet": 2.8, "cost_usd_per_acre_foot": 85}
    allocation = sum(positive_float(doc.get("allocation_acre_feet"), 0) for doc in docs)
    costs = [positive_float(doc.get("cost_usd_per_acre_foot"), 85) for doc in docs]
    return {
        "seasonal_allocation_acre_feet": allocation,
        "cost_usd_per_acre_foot": sum(costs) / len(costs),
    }


def plant_climate_score(plant: dict, weather: dict) -> float:
    mean_temp = float(weather["mean_growing_temp_c"])
    min_temp = positive_float(plant.get("temperature_min"), 5)
    max_temp = positive_float(plant.get("temperature_max"), 35)
    if min_temp <= mean_temp <= max_temp:
        temp_score = 1
    else:
        distance = min(abs(mean_temp - min_temp), abs(mean_temp - max_temp))
        temp_score = clamp(1 - distance / 18, 0.15, 1)
    rainfall_max = positive_float(plant.get("rainfall_max_ml"), 800)
    rainfall_mm = float(weather["rainfall_mm_seasonal"])
    rain_score = clamp(1 - max(0, rainfall_mm - rainfall_max) / max(300, rainfall_max), 0.35, 1)
    heat_score = clamp(1 - float(weather["heat_stress_days_over_95f"]) / 90, 0.35, 1)
    return clamp(0.52 * temp_score + 0.28 * rain_score + 0.20 * heat_score, 0.05, 1)


def plant_soil_score(plant: dict, soil: dict) -> float:
    quality = clamp(positive_float(soil.get("soil_quality_index"), 0.68), 0, 1)
    ph = positive_float(soil.get("ph"), 6.8)
    ph_min = positive_float(plant.get("soil_ph_min"), 5.8)
    ph_max = positive_float(plant.get("soil_ph_max"), 7.6)
    ph_score = 1 if ph_min <= ph <= ph_max else clamp(1 - min(abs(ph - ph_min), abs(ph - ph_max)) / 2.5, 0.25, 1)
    return clamp(0.65 * quality + 0.35 * ph_score, 0.05, 1)


def plant_water_score(plant: dict, water: dict, area_acres: float) -> float:
    water_ml = positive_float(plant.get("water_consumption_ml"), 650)
    estimated_af_per_acre = clamp(water_ml / 430, 0.25, 4.5)
    available_af_per_acre = float(water["seasonal_allocation_acre_feet"]) / max(1, area_acres)
    return clamp(available_af_per_acre / max(0.1, estimated_af_per_acre), 0.12, 1)


def plant_space_score(ideal_space: float, area_acres: float) -> float:
    if ideal_space < 1 and area_acres >= 1:
        return 0.58
    if ideal_space > area_acres * SQUARE_FEET_PER_ACRE:
        return 0.2
    return clamp(0.62 + math.log10(max(1, area_acres * SQUARE_FEET_PER_ACRE / ideal_space)) / 6, 0.25, 1)


def animal_space_score(ideal_space: float, area_acres: float) -> float:
    supported = area_acres * SQUARE_FEET_PER_ACRE / max(1, ideal_space)
    if supported < 1:
        return 0.1
    if supported < 3:
        return 0.45
    return clamp(0.58 + math.log10(supported) / 4, 0.35, 1)


def animal_climate_score(option_id: str, weather: dict) -> float:
    heat_days = float(weather["heat_stress_days_over_95f"])
    heat_sensitivity = 1.2 if option_id in {"rabbits", "chickens", "quails"} else 0.85 if option_id in {"cows", "pigs"} else 0.7
    return clamp(1 - heat_sensitivity * heat_days / 120, 0.35, 1)


def plant_water_cost_per_acre(plant: dict, water: dict) -> float:
    water_ml = positive_float(plant.get("water_consumption_ml"), 650)
    estimated_af_per_acre = clamp(water_ml / 430, 0.25, 4.5)
    return estimated_af_per_acre * float(water["cost_usd_per_acre_foot"])


def plant_scenario_profits(
    expected_profit: float,
    scenario_count: int,
    rng: np.random.Generator,
    climate_score: float,
    market_score: float,
    water_score: float,
    category: str,
) -> list[float]:
    volatility = 0.18 + (1 - climate_score) * 0.18 + (1 - market_score) * 0.16 + (1 - water_score) * 0.12
    if category in {"sprouts", "microgreen", "herb"}:
        volatility += 0.08
    shocks = rng.normal(1.0, volatility, scenario_count)
    return [expected_profit * max(0.05, shock) for shock in shocks]


def animal_scenario_profits(
    expected_profit: float,
    scenario_count: int,
    rng: np.random.Generator,
    climate_score: float,
    market_score: float,
) -> list[float]:
    volatility = 0.20 + (1 - climate_score) * 0.16 + (1 - market_score) * 0.14
    shocks = rng.normal(1.0, volatility, scenario_count)
    return [expected_profit * max(0.05, shock) for shock in shocks]


def compressed_gross_per_acre(raw_gross_per_acre: float, gross_cap: float) -> float:
    if raw_gross_per_acre <= gross_cap:
        return raw_gross_per_acre
    overage = raw_gross_per_acre - gross_cap
    return gross_cap + math.sqrt(overage * gross_cap) * 0.05


def top_reasons(
    category: str,
    profit: float,
    climate: float,
    space: float,
    market: float,
    water: float,
    risk: float,
) -> list[str]:
    labels = [
        ("profit", profit, "strong expected profit"),
        ("climate", climate, "good climate fit"),
        ("space", space, "efficient use of mapped space"),
        ("market", market, "healthy market assumptions"),
        ("water", water, "water demand fits allocation"),
        ("risk", risk, "resilient downside scenarios"),
    ]
    if category == "animal":
        labels = [item for item in labels if item[0] != "water"]
    top = sorted(labels, key=lambda item: item[1], reverse=True)[:3]
    return [reason for _, value, reason in top if value >= 0.55] or ["score is driven by fallback assumptions"]


def category_defaults(category: str) -> dict:
    normalized = slugify(category).replace("-", "_")
    if normalized in PLANT_CATEGORY_DEFAULTS:
        return PLANT_CATEGORY_DEFAULTS[normalized]
    for key, value in PLANT_CATEGORY_DEFAULTS.items():
        if key in normalized:
            return value
    return PLANT_CATEGORY_DEFAULTS["vegetable"]


def positive_float(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number) or number <= 0:
        return default
    return number


def percentile(values: list[float], pct: int) -> float:
    if not values:
        return 0
    return float(np.percentile(np.array(values), pct))


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "option"

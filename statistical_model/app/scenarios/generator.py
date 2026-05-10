from datetime import UTC, datetime
from uuid import uuid4

import numpy as np
from pymongo.database import Database


def generate_scenario_set(
    db: Database,
    farm_id: str,
    scenario_count: int,
    season_year: int,
    random_seed: int,
) -> dict:
    scenario_count = min(500, max(100, scenario_count))
    rng = np.random.default_rng(random_seed)
    scenario_set_id = f"scn_{uuid4().hex[:12]}"
    scenarios = []

    for index in range(scenario_count):
        weather_shock = clipped_normal(rng, 1.0, 0.10, 0.72, 1.22)
        yield_shock = clipped_normal(rng, weather_shock, 0.12, 0.58, 1.35)
        price_shock = clipped_normal(rng, 1.0, 0.14, 0.65, 1.45)
        fertilizer_shock = clipped_normal(rng, 1.0, 0.16, 0.70, 1.60)
        wage_shock = clipped_normal(rng, 1.0, 0.07, 0.85, 1.25)
        water_allocation_shock = clipped_normal(rng, 1.0, 0.12, 0.65, 1.15)
        scenarios.append({
            "scenario_index": index,
            "yield_shock": round(yield_shock, 5),
            "market_price_shock": round(price_shock, 5),
            "fertilizer_price_shock": round(fertilizer_shock, 5),
            "wage_rate_shock": round(wage_shock, 5),
            "water_allocation_shock": round(water_allocation_shock, 5),
            "weather_et_shock": round(weather_shock, 5),
        })

    doc = {
        "_id": scenario_set_id,
        "scenario_set_id": scenario_set_id,
        "farm_id": farm_id,
        "season_year": season_year,
        "scenario_count": scenario_count,
        "assumptions": {
            "yield_shock_distribution": "truncated_normal(mean=weather_shock, sd=0.12)",
            "market_price_shock_distribution": "truncated_normal(mean=1, sd=0.14)",
            "fertilizer_price_shock_distribution": "truncated_normal(mean=1, sd=0.16)",
            "wage_rate_shock_distribution": "truncated_normal(mean=1, sd=0.07)",
            "water_allocation_shock_distribution": "truncated_normal(mean=1, sd=0.12)",
            "units": "multipliers",
        },
        "random_seed": random_seed,
        "scenarios": scenarios,
        "generated_at": datetime.now(UTC),
        "created_at": datetime.now(UTC),
    }
    db.scenario_sets.replace_one({"_id": scenario_set_id}, doc, upsert=True)
    return doc


def clipped_normal(rng: np.random.Generator, mean: float, sd: float, low: float, high: float) -> float:
    return float(np.clip(rng.normal(mean, sd), low, high))


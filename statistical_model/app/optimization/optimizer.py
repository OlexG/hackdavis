from datetime import UTC, datetime
from statistics import mean
from uuid import uuid4

import pandas as pd
from ortools.sat.python import cp_model
from pymongo.database import Database

from app.features.candidates import build_feature_snapshots
from app.scenarios.generator import generate_scenario_set


def run_optimization(
    db: Database,
    farm_id: str,
    season_year: int,
    scenario_count: int,
    lambda_risk: float,
    target_profit_usd: float,
    random_seed: int = 42,
) -> dict:
    run_id = f"run_{uuid4().hex[:12]}"
    now = datetime.now(UTC)
    db.model_runs.insert_one({
        "_id": run_id,
        "run_id": run_id,
        "farm_id": farm_id,
        "season_year": season_year,
        "status": "running",
        "parameters": {
            "scenario_count": scenario_count,
            "lambda_risk": lambda_risk,
            "target_profit_usd": target_profit_usd,
            "random_seed": random_seed,
        },
        "created_at": now,
        "updated_at": now,
    })

    candidates = build_feature_snapshots(db, farm_id, season_year, run_id=run_id)
    scenario_set = generate_scenario_set(db, farm_id, scenario_count, season_year, random_seed)
    result = solve_and_score(db, run_id, farm_id, season_year, candidates, scenario_set, lambda_risk, target_profit_usd)

    db.model_runs.update_one(
        {"_id": run_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(UTC), "updated_at": datetime.now(UTC)}},
    )
    return result


def solve_and_score(
    db: Database,
    run_id: str,
    farm_id: str,
    season_year: int,
    candidates: list[dict],
    scenario_set: dict,
    lambda_risk: float,
    target_profit_usd: float,
) -> dict:
    eligible = [c for c in candidates if c["rotation"]["eligible"]]
    if not eligible:
        raise ValueError("No rotation-eligible crop-field candidates were generated")

    df = pd.DataFrame(flatten_candidate(c) for c in eligible)
    model = cp_model.CpModel()
    variables = {row.candidate_id: model.NewBoolVar(row.candidate_id) for row in df.itertuples()}

    for field_id, group in df.groupby("field_id"):
        model.Add(sum(variables[row.candidate_id] for row in group.itertuples()) == 1)

    water_alloc = {
        week: float(doc["allocation_acre_feet"])
        for doc in db.water_allocations.find({"farm_id": farm_id, "season_year": season_year})
        for week in [week_from_period(str(doc["period_start"]))]
    }
    labor_alloc = {
        int(doc["week"]): float(doc["available_hours"])
        for doc in db.labor_availability.find({"farm_id": farm_id, "season_year": season_year})
    }

    for week in range(1, 53):
        water_terms = []
        labor_terms = []
        for row in df.itertuples():
            water_terms.append(int(row.weekly_water.get(str(week), 0) * row.field_acres * 1000) * variables[row.candidate_id])
            labor_terms.append(int(row.weekly_labor.get(str(week), 0) * row.field_acres * 1000) * variables[row.candidate_id])
        if water_terms:
            model.Add(sum(water_terms) <= int(water_alloc.get(week, 0) * 1000))
        if labor_terms:
            model.Add(sum(labor_terms) <= int(labor_alloc.get(week, 0) * 1000))

    nutrient_caps = {"nitrogen": 18_000, "phosphorus": 8_000, "potassium": 12_000}
    for nutrient, cap_lbs in nutrient_caps.items():
        terms = []
        for row in df.itertuples():
            terms.append(int(row.nutrients.get(nutrient, 0) * row.field_acres * 1000) * variables[row.candidate_id])
        model.Add(sum(terms) <= cap_lbs * 1000)

    model.Maximize(
        sum(int(row.expected_gross_margin_usd_per_acre * row.field_acres * 100) * variables[row.candidate_id] for row in df.itertuples())
    )
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20
    solver.parameters.num_search_workers = 2
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ValueError(f"Optimizer could not find a feasible crop plan: status={solver.StatusName(status)}")

    selected = [
        c for c in eligible
        if solver.Value(variables[f"{c['field_id']}::{c['crop_id']}"]) == 1
    ]
    score = score_plan(selected, scenario_set["scenarios"], target_profit_usd, lambda_risk)
    constraints = summarize_constraints(selected, water_alloc, labor_alloc)
    now = datetime.now(UTC)
    doc = {
        "_id": run_id,
        "run_id": run_id,
        "farm_id": farm_id,
        "season_year": season_year,
        "scenario_set_id": scenario_set["scenario_set_id"],
        "solver": {"name": "OR-Tools CP-SAT", "status": solver.StatusName(status), "objective_expected_margin_cents": solver.ObjectiveValue()},
        "recommended_allocation": [allocation_doc(c) for c in selected],
        "expected_profit_usd": score["expected_profit_usd"],
        "p10_profit_usd": score["p10_profit_usd"],
        "probability_of_loss": score["probability_of_loss"],
        "downside_risk_usd": score["downside_risk_usd"],
        "objective_value_usd": score["objective_value_usd"],
        "fertilizer_cost_by_crop_and_nutrient": fertilizer_summary(selected),
        "water_use_by_week_vs_allocation": constraints["water"],
        "labor_use_by_week_vs_availability": constraints["labor"],
        "binding_constraints": constraints["binding"],
        "top_sensitivity_drivers": score["top_sensitivity_drivers"],
        "assumptions": {
            "profit_equation": "revenue - fertilizer - labor - water - seed - chemical - machinery - harvest - transport_storage - other_variable_costs",
            "objective": "mean_profit - lambda_risk * downside_risk",
            "downside_risk": "max(0, target_profit - p10_profit) + probability_of_loss_penalty",
            "units": {"currency": "USD", "area": "acres", "water": "acre_feet", "labor": "hours"},
        },
        "created_at": now,
        "updated_at": now,
    }
    db.optimization_results.replace_one({"_id": run_id}, doc, upsert=True)
    return doc


def flatten_candidate(c: dict) -> dict:
    return {
        "candidate_id": f"{c['field_id']}::{c['crop_id']}",
        "field_id": c["field_id"],
        "crop_id": c["crop_id"],
        "field_acres": float(c["field_acres"]),
        "expected_gross_margin_usd_per_acre": float(c["expected_gross_margin_usd_per_acre"]),
        "weekly_water": c["weekly_water_acre_feet_per_acre"],
        "weekly_labor": c["weekly_labor_hours_per_acre"],
        "nutrients": c.get("nutrient_need_lbs_per_acre", {}),
    }


def allocation_doc(c: dict) -> dict:
    return {
        "field_id": c["field_id"],
        "field_name": c["field_name"],
        "crop_id": c["crop_id"],
        "crop_name": c["crop_name"],
        "acres": c["field_acres"],
        "expected_gross_margin_usd": round(c["expected_gross_margin_usd_per_acre"] * c["field_acres"], 2),
        "expected_yield": round(c["yield"]["expected_yield_per_acre"] * c["field_acres"], 2),
        "yield_unit": c["yield"]["yield_unit"],
        "why_selected": [
            "highest feasible expected margin within field, water, labor, and rotation constraints",
            c["rotation"]["reason"],
        ],
    }


def score_plan(selected: list[dict], scenarios: list[dict], target_profit_usd: float, lambda_risk: float) -> dict:
    profits = []
    for scenario in scenarios:
        profit = 0.0
        for c in selected:
            acres = c["field_acres"]
            revenue = c["expected_revenue_usd_per_acre"] * scenario["yield_shock"] * scenario["market_price_shock"]
            fertilizer = sum(c["fertilizer_cost_by_nutrient_usd_per_acre"].values()) * scenario["fertilizer_price_shock"]
            labor = c["labor_cost_usd_per_acre"] * scenario["wage_rate_shock"]
            water = c["irrigation_water_cost_usd_per_acre"] * scenario["water_allocation_shock"]
            other = (
                c["seed_cost_usd_per_acre"]
                + c["chemical_cost_usd_per_acre"]
                + c["machinery_cost_usd_per_acre"]
                + c["harvest_cost_usd_per_acre"]
                + c["transport_storage_cost_usd_per_acre"]
                + c["other_variable_costs_usd_per_acre"]
            )
            profit += (revenue - fertilizer - labor - water - other) * acres
        profits.append(profit)

    profits_sorted = sorted(profits)
    p10 = profits_sorted[max(0, int(len(profits_sorted) * 0.10) - 1)]
    expected = mean(profits)
    probability_of_loss = sum(1 for p in profits if p < 0) / len(profits)
    probability_penalty = target_profit_usd * probability_of_loss * 0.15
    downside = max(0, target_profit_usd - p10) + probability_penalty
    return {
        "expected_profit_usd": round(expected, 2),
        "p10_profit_usd": round(p10, 2),
        "probability_of_loss": round(probability_of_loss, 4),
        "downside_risk_usd": round(downside, 2),
        "objective_value_usd": round(expected - lambda_risk * downside, 2),
        "top_sensitivity_drivers": [
            "market_price_shock",
            "yield_shock",
            "fertilizer_price_shock",
            "wage_rate_shock",
            "water_allocation_shock",
        ],
    }


def summarize_constraints(selected: list[dict], water_alloc: dict[int, float], labor_alloc: dict[int, float]) -> dict:
    water = []
    labor = []
    binding = []
    for week in range(1, 53):
        water_use = sum(c["weekly_water_acre_feet_per_acre"].get(str(week), 0) * c["field_acres"] for c in selected)
        labor_use = sum(c["weekly_labor_hours_per_acre"].get(str(week), 0) * c["field_acres"] for c in selected)
        water_limit = water_alloc.get(week, 0)
        labor_limit = labor_alloc.get(week, 0)
        if water_use or water_limit:
            water.append({"week": week, "used_acre_feet": round(water_use, 3), "allocation_acre_feet": water_limit})
            if water_limit and water_use / water_limit >= 0.95:
                binding.append(f"week {week} irrigation water")
        if labor_use or labor_limit:
            labor.append({"week": week, "used_hours": round(labor_use, 2), "available_hours": labor_limit})
            if labor_limit and labor_use / labor_limit >= 0.95:
                binding.append(f"week {week} labor")
    return {"water": water, "labor": labor, "binding": binding[:12]}


def fertilizer_summary(selected: list[dict]) -> list[dict]:
    rows = []
    for c in selected:
        rows.append({
            "crop_id": c["crop_id"],
            "crop_name": c["crop_name"],
            "field_id": c["field_id"],
            "acres": c["field_acres"],
            "cost_by_nutrient_usd": {
                nutrient: round(cost * c["field_acres"], 2)
                for nutrient, cost in c["fertilizer_cost_by_nutrient_usd_per_acre"].items()
            },
        })
    return rows


def week_from_period(period: str) -> int:
    try:
        return int(period.split("W", 1)[1])
    except (IndexError, ValueError):
        return 0

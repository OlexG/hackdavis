def estimate_yield(crop: dict, field: dict, soil: dict | None, weather: dict | None, rotation_eligible: bool) -> dict:
    baseline = float(crop["baseline_yield_per_acre"])
    soil_quality = float((soil or {}).get("soil_quality_index", 0.72))
    heat_days = float((weather or {}).get("heat_stress_days_over_95f", 20))
    rainfall = float((weather or {}).get("rainfall_inches_seasonal", 16))
    irrigation_method = field.get("irrigation_method", "sprinkler")

    soil_factor = 0.82 + soil_quality * 0.28
    heat_factor = max(0.86, 1 - max(0, heat_days - 18) * 0.006)
    rainfall_factor = 0.96 + min(0.08, rainfall / 250)
    irrigation_factor = {"drip": 1.04, "sprinkler": 0.99, "furrow": 0.94}.get(irrigation_method, 0.98)
    rotation_factor = 1.0 if rotation_eligible else 0.0
    expected = baseline * soil_factor * heat_factor * rainfall_factor * irrigation_factor * rotation_factor

    uncertainty_low = float(crop["yield_p10_per_acre"]) / baseline if baseline else 0.75
    uncertainty_high = float(crop["yield_p90_per_acre"]) / baseline if baseline else 1.25

    return {
        "expected_yield_per_acre": round(expected, 3),
        "p10_yield_per_acre": round(expected * uncertainty_low, 3),
        "p90_yield_per_acre": round(expected * uncertainty_high, 3),
        "yield_unit": crop["yield_unit"],
        "model": "rule_based_v1",
        "drivers": {
            "soil_factor": round(soil_factor, 3),
            "heat_factor": round(heat_factor, 3),
            "rainfall_factor": round(rainfall_factor, 3),
            "irrigation_factor": irrigation_factor,
            "rotation_factor": rotation_factor,
        },
    }


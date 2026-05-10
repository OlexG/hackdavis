def estimate_price(crop: dict, latest_market_price: dict | None) -> dict:
    source = latest_market_price or crop
    expected = float(source.get("expected_price_usd_per_unit", crop["expected_price_per_unit_usd"]))
    p10 = float(source.get("p10_price_usd_per_unit", crop["price_p10_usd"]))
    p90 = float(source.get("p90_price_usd_per_unit", crop["price_p90_usd"]))

    return {
        "expected_price_usd_per_unit": round(expected, 3),
        "p10_price_usd_per_unit": round(p10, 3),
        "p90_price_usd_per_unit": round(p90, 3),
        "market_unit": crop["market_unit"],
        "model": "regional_price_fallback_v1",
        "source": (latest_market_price or {}).get("source", crop.get("source", {}).get("name", "local_seed")),
    }


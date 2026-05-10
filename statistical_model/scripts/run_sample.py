from app.core.config import get_settings
from app.db.mongo import get_db
from app.optimization.optimizer import run_optimization


def main() -> None:
    settings = get_settings()
    result = run_optimization(
        db=get_db(),
        farm_id=settings.default_farm_id,
        season_year=settings.default_season_year,
        scenario_count=200,
        lambda_risk=0.5,
        target_profit_usd=150_000,
        random_seed=42,
    )
    print({
        "run_id": result["run_id"],
        "expected_profit_usd": result["expected_profit_usd"],
        "p10_profit_usd": result["p10_profit_usd"],
        "probability_of_loss": result["probability_of_loss"],
        "allocation": result["recommended_allocation"],
    })


if __name__ == "__main__":
    main()


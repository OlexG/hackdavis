from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    farm_id: str = Field(default="farm_001")
    season_year: int = Field(default=2026, ge=2000, le=2100)
    scenario_count: int = Field(default=200, ge=100, le=500)
    lambda_risk: float = Field(default=0.5, ge=0, le=10)
    target_profit_usd: float = Field(default=150_000, ge=0)
    random_seed: int = Field(default=42)


class RunResponse(BaseModel):
    run_id: str
    farm_id: str
    status: str
    expected_profit_usd: float
    p10_profit_usd: float
    probability_of_loss: float
    objective_value_usd: float
    recommended_fields: int


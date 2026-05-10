from typing import Any, Literal

from pydantic import BaseModel, Field


class OptionScoreRequest(BaseModel):
    farm_id: str = Field(default="farm_001")
    season_year: int = Field(default=2026, ge=2000, le=2100)
    scenario_count: int = Field(default=200, ge=100, le=500)
    random_seed: int = Field(default=42)
    risk_tolerance: float = Field(default=0.5, ge=0, le=1)
    farm_area_acres: float | None = Field(default=None, ge=0)
    location: dict[str, float] | None = None
    current_plan: dict[str, Any] | None = None


class OptionScore(BaseModel):
    option_id: str
    category: Literal["plant", "animal"]
    name: str
    score: float
    rank: int
    expected_profit_usd: float
    expected_profit_usd_per_acre: float
    p10_profit_usd: float
    probability_of_loss: float
    capacity_units: int
    ideal_space_square_feet: float
    score_breakdown: dict[str, float]
    assumptions: dict[str, Any]
    reasons: list[str]
    warnings: list[str]


class OptionScoreResponse(BaseModel):
    farm_id: str
    season_year: int
    generated_at: str
    ranked_options: list[OptionScore]
    plant_options: list[OptionScore]
    animal_options: list[OptionScore]
    context: dict[str, Any]

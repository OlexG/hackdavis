from fastapi import FastAPI, HTTPException

from app.core.config import get_settings
from app.db.indexes import ensure_indexes
from app.db.mongo import get_db
from app.optimization.optimizer import run_optimization
from app.schemas.run import RunRequest, RunResponse

app = FastAPI(
    title="Farm Profit Optimization API",
    version="0.1.0",
    description="Scenario-based constrained crop allocation optimizer for a mid-sized farm.",
)


@app.get("/health")
def health() -> dict:
    db = get_db()
    db.command("ping")
    settings = get_settings()
    return {"status": "ok", "mongo_db": settings.mongo_db}


@app.post("/v1/admin/init-db")
def init_db() -> dict:
    ensure_indexes(get_db())
    return {"status": "ok", "message": "MongoDB indexes ensured"}


@app.get("/v1/farms")
def list_farms() -> dict:
    farms = list(get_db().farms.find({}, {"_id": 0}).sort("farm_id", 1))
    return {"farms": farms}


@app.get("/v1/farms/{farm_id}/fields")
def list_fields(farm_id: str) -> dict:
    fields = list(get_db().fields.find({"farm_id": farm_id}, {"_id": 0}).sort("name", 1))
    return {"farm_id": farm_id, "fields": fields}


@app.post("/v1/runs", response_model=RunResponse)
def create_run(request: RunRequest) -> RunResponse:
    try:
        result = run_optimization(
            db=get_db(),
            farm_id=request.farm_id,
            season_year=request.season_year,
            scenario_count=request.scenario_count,
            lambda_risk=request.lambda_risk,
            target_profit_usd=request.target_profit_usd,
            random_seed=request.random_seed,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RunResponse(
        run_id=result["run_id"],
        farm_id=result["farm_id"],
        status="completed",
        expected_profit_usd=result["expected_profit_usd"],
        p10_profit_usd=result["p10_profit_usd"],
        probability_of_loss=result["probability_of_loss"],
        objective_value_usd=result["objective_value_usd"],
        recommended_fields=len(result["recommended_allocation"]),
    )


@app.get("/v1/runs/{run_id}")
def get_run(run_id: str) -> dict:
    db = get_db()
    run = db.model_runs.find_one({"run_id": run_id}, {"_id": 0})
    result = db.optimization_results.find_one({"run_id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run": run, "result": result}


@app.get("/v1/runs/{run_id}/allocation")
def get_allocation(run_id: str) -> dict:
    result = get_db().optimization_results.find_one({"run_id": run_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Optimization result not found")
    return {
        "run_id": run_id,
        "recommended_allocation": result["recommended_allocation"],
        "expected_profit_usd": result["expected_profit_usd"],
        "p10_profit_usd": result["p10_profit_usd"],
        "probability_of_loss": result["probability_of_loss"],
        "binding_constraints": result["binding_constraints"],
        "top_sensitivity_drivers": result["top_sensitivity_drivers"],
    }


@app.get("/v1/runs/{run_id}/features")
def get_features(run_id: str, limit: int = 100) -> dict:
    docs = list(get_db().feature_snapshots.find({"run_id": run_id}, {"_id": 0}).limit(min(limit, 500)))
    return {"run_id": run_id, "features": docs}


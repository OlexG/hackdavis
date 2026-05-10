# Farm Profit Optimization MVP

Scenario-based constrained crop allocation optimizer for a mid-sized farm.

The MVP answers:

> Given current expected crop prices, fertilizer prices, labor constraints, irrigation water costs and allocation limits, field history, and rotation rules, what crop should be planted on each field to maximize risk-adjusted farm profit?

## Stack

- Python 3.11
- FastAPI
- MongoDB
- PyMongo
- OR-Tools CP-SAT
- pandas / NumPy
- Shapely / GeoPandas dependency path for geometry preprocessing
- scikit-learn dependency path for later yield/price models
- Docker Compose

## Services

`docker-compose.yml` starts:

- `mongo`: MongoDB 7 with WiredTiger cache pinned to 1 GB
- `api`: FastAPI service on port 8000
- `worker`: placeholder worker container for scheduled/queued jobs

## Environment

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

The MVP works with seed data and no public API keys.

Optional keys:

- `NASS_API_KEY`
- `AMS_API_KEY`
- `NOAA_TOKEN`
- `OPENET_API_KEY`

## Run Locally Or On Server

```bash
docker compose up -d --build
docker compose exec api python -m scripts.init_db
docker compose exec api python -m scripts.seed_data
docker compose exec api python -m scripts.run_sample
```

Verify:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/v1/farms
open http://localhost:8000/docs
```

Run optimization:

```bash
curl -X POST http://localhost:8000/v1/runs \
  -H 'Content-Type: application/json' \
  -d '{"farm_id":"farm_001","season_year":2026,"scenario_count":200,"lambda_risk":0.5,"target_profit_usd":150000}'
```

Then:

```bash
curl http://localhost:8000/v1/runs/RUN_ID
curl http://localhost:8000/v1/runs/RUN_ID/allocation
curl http://localhost:8000/v1/runs/RUN_ID/features
```

## MongoDB Collections

The initialization and seed path supports these collections:

- `farms`
- `fields`
- `crops`
- `crop_families`
- `crop_rotation_rules`
- `field_crop_history`
- `soil_properties`
- `weather_daily`
- `weather_forecasts`
- `market_prices`
- `fertilizer_prices`
- `labor_rates`
- `water_allocations`
- `crop_enterprise_budgets`
- `feature_snapshots`
- `scenario_sets`
- `model_runs`
- `optimization_results`
- `raw_source_documents`
- `labor_availability`

Field boundaries are stored as GeoJSON polygons in `fields.geometry`; centroids/representative points are stored in `fields.location`.

## Model Assumptions

The first version is intentionally transparent:

- Yield uses rule-based coefficients for soil quality, heat stress, rainfall, irrigation efficiency, and rotation eligibility.
- Price uses regional seeded market values with p10/p90 uncertainty bands.
- Candidate features are generated per crop-field-season and written to `feature_snapshots`.
- Scenario variables include yield, market price, fertilizer price, wage rate, water allocation, and weather/ET shocks.
- The optimizer first solves deterministic expected gross margin with OR-Tools, constrained by one crop per field, weekly water, seasonal water via weekly allocations, weekly labor, fertilizer caps, rotation eligibility, and crop windows.
- The selected plan is scored across 100-500 scenarios.

Objective:

```text
profit_s =
  revenue_s
  - fertilizer_cost_s
  - labor_cost_s
  - irrigation_water_cost_s
  - seed_cost
  - chemical_cost
  - machinery_cost
  - harvest_cost_s
  - transport_storage_cost_s
  - other_variable_costs

downside_risk =
  max(0, target_profit - p10_profit)
  + probability_of_loss_penalty

objective =
  mean(profit_s) - lambda_risk * downside_risk
```

## Public Data Ingestion

`app/ingestion/public_sources.py` includes starter ingestion functions for:

- USDA NASS Quick Stats
- NASA POWER
- National Weather Service forecasts

Raw responses are stored in `raw_source_documents` before processing. Missing API keys are allowed; the MVP seed data path remains fully runnable.

## Server Notes

On AlmaLinux 9:

```bash
sudo dnf -y install dnf-plugins-core git
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

Then deploy this directory to `/opt/farm-optim` and run the Docker commands above.


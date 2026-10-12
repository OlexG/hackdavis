# Sunpatch

Sunpatch is an AI-assisted farm planning and local-produce marketplace built for DavisHacks. It turns a real plot boundary and a grower's constraints into a spatial farm plan, then connects that plan to inventory, production forecasts, farm economics, and neighborhood trading.

The project combines a Next.js web application, MongoDB-backed APIs, a standalone TypeScript farm-layout engine, and an Expo mobile client. Its visual system borrows from cozy farming games, while the underlying workflows are designed around real decisions: what fits on a plot, what a household can maintain, what a season can produce, and how surplus can be exchanged locally.

**Live demo:** [sunpatch-nine.vercel.app](https://sunpatch-nine.vercel.app)

## What the app does

- Draw a real farm boundary on an interactive MapLibre map.
- Generate an AI-assisted crop, livestock, structure, budget, and labor plan from the boundary and user preferences.
- Validate and render the generated plan as a spatial farm layout rather than treating model output as trusted geometry.
- Track inventory and connect current stock to yield forecasts.
- Model monthly operating costs, production, and expected value.
- Browse nearby farm storefronts, list surplus, make offers, and leave reviews.
- Use the same authentication and application data from the Next.js web app and Expo mobile client.

## Architecture

```text
Browser / Expo client
        |
        v
Next.js App Router
  - Server-rendered product surfaces
  - Route handlers for auth, farms, inventory, AI, and marketplace flows
        |
        +----> MongoDB Atlas
        |       Users, sessions, farms, plans, inventory, listings, offers,
        |       reviews, notifications, and generated reports
        |
        +----> Gemini or OpenAI
        |       Structured farm-plan intent and intelligence generation
        |
        +----> Statistical forecast service
                Optional production-model integration

Farm Manager runtime
  - TypeScript geometry and rendering modules
  - Compiled to a browser bundle and loaded by the Next.js farm workspace
```

### Project structure

```text
src/
  app/
    api/                    Next.js route handlers
    app/                    Authenticated farm, inventory, marketplace, and AI UI
    login/ and signup/      Authentication screens
  lib/                      Domain logic, persistence, auth, planning, and forecasts
farmManager/
  src/                      Framework-independent map, geometry, state, and renderer code
  dist/                     Compiled farm-manager runtime
mobile/                     Expo client sharing the web API and MongoDB-backed data
public/farm-manager/        Browser-ready farm-manager build published during `npm run build`
scripts/                    Database seed and migration utilities
```

## Major engineering decisions

### AI proposes intent; deterministic code owns the layout

The model selects and explains crops, structures, livestock, budget allocation, and operational trade-offs. Deterministic TypeScript then sanitizes the response, scores candidate crops against the site and season, converts the intent into geometry, checks containment and overlap, and persists a versioned plan.

This split makes the creative part of planning flexible without allowing probabilistic model output to directly control spatial correctness. The trade-off is additional planner code and validation logic, but the resulting plans are reproducible, inspectable, and safer to render or edit.

### Provider fallback instead of a single-model dependency

Farm-plan generation prefers OpenAI when `OPENAI_API_KEY` is configured, otherwise uses Gemini, and can fall back to catalog-driven planning when a model request fails. This improves demo resilience and keeps the core workflow usable without tying it to one provider. The cost is maintaining multiple response paths and accepting that fallback plans are less context-sensitive than model-generated ones.

### One Next.js application for UI and backend APIs

The App Router hosts both the server-rendered product and its route handlers. That kept a hackathon-sized team moving quickly, avoided a separate API deployment, and made HTTP-only session cookies straightforward. The trade-off is tighter coupling between presentation and backend deployment; the domain logic therefore lives in `src/lib` instead of route files so it can be tested and extracted later.

### MongoDB for a rapidly evolving domain model

Farm plans contain nested boundaries, generated objects, budgets, forecasts, and marketplace state that changed quickly during development. MongoDB made those documents easy to evolve and supports geospatial indexes for nearby farms. The trade-off is that relationships and invariants that a relational schema might enforce must instead be maintained in application code and indexes.

### Standalone farm engine embedded in React

The farm planner began as an independent TypeScript prototype. Rather than rewrite it during the hackathon, the production app compiles and publishes it as a browser runtime that the React shell loads and synchronizes with API state. This preserved a working geometry/rendering system and kept it framework-independent, but it creates an explicit build/publish step and a boundary between React state and the imperative renderer.

### Shared API for web and mobile

The Expo app consumes the same authentication, marketplace, inventory, social, and notification endpoints as the web client. This avoids duplicating backend rules and demonstrates a multi-client architecture. It also means local mobile development must point at a LAN-accessible Next.js server, and push notifications require an Expo/EAS project configuration.

## Technology

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- MongoDB Atlas with geospatial and TTL indexes
- Gemini and OpenAI model integrations with structured-response validation
- MapLibre GL for boundary mapping and Leaflet for marketplace maps
- Expo / React Native for the mobile client
- Vercel for web hosting and serverless route handlers

## Local development

### Prerequisites

- Node.js 22 LTS or newer supported LTS release
- npm
- A MongoDB database
- At least one AI provider key for generated farm plans

### Environment

Create `.env.local` in the repository root:

```bash
MONGODB_URI=mongodb+srv://...
MONGODB_DB=sunpatch

# Configure at least one provider. OpenAI is preferred when both are present.
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

# Optional external statistical model.
STAT_MODEL_URL=https://...
```

Only server-side code reads provider and database secrets. Do not prefix secrets with `NEXT_PUBLIC_` or commit an environment file.

### Install and run

```bash
npm install
cd mobile && npm install && cd ..
npm run dev
```

`npm run dev` starts the Next.js server on the local network and the Expo development server. To run only the web app:

```bash
npm run dev:web
```

### Validate a change

```bash
npm run lint
npm run build
npm audit --omit=dev
```

The production build first compiles the standalone farm manager and copies its output into `public/farm-manager` before building Next.js.

## Deployment

The web application is designed for Vercel. Configure `MONGODB_URI`, `MONGODB_DB`, and the selected AI-provider variables in the Vercel project for Production, Preview, and Development as appropriate, then deploy from the repository root.

MongoDB Atlas must allow connections from the deployment environment. Keep all credentials in Vercel's encrypted environment-variable store rather than in source control.

The Expo client is a separate deployment target; see [`mobile/README.md`](mobile/README.md) for device networking and push-notification configuration.

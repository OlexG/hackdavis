# Sunpatch mobile

Expo SDK 54 client for the Sunpatch farm-stand marketplace. Pulls farm data
from the Next.js + MongoDB backend and renders a real map (Apple/Google Maps
on native via `react-native-maps`, Leaflet/CARTO Voyager on web).

## One-command setup

From the repo root:

```bash
npm install            # installs Next.js deps + concurrently
cd mobile && npm install && cd ..   # installs Expo deps (one time)
npm run dev            # starts Next.js + Expo together
```

`npm run dev` runs:

- `next dev -H 0.0.0.0` on `http://localhost:3000` (the `0.0.0.0` host is what
  lets your phone reach the API over the LAN)
- `npx expo start` in the `mobile/` folder

`.env.local` at the repo root must define:

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=sunpatch
```

The marketplace API is **strictly read-only** — it never writes to MongoDB.
It reads documents from the `marketplace_farms` collection and returns them
as-is. If your collection is empty, you'll get an empty list.

If you want to populate test data manually, there's an opt-in helper:

```bash
npm run db:seed:marketplace   # one-shot insert of demo farms (manual, not automatic)
```

Scan the QR with Expo Go on a phone that's on the same Wi-Fi as your Mac.

## API base URL

The mobile app figures out the API base automatically:

1. `EXPO_PUBLIC_API_BASE` env var, e.g.
   `EXPO_PUBLIC_API_BASE=http://172.20.10.2:3000 npm run dev`.
2. The Expo dev server host on port 3000 (the IP shown above the QR code).
   On Android emulators we automatically rewrite `localhost` to `10.0.2.2`.
3. `http://localhost:3000` as a last resort (works for iOS Simulator + web).

The Market screen shows a status chip that reads `Live from MongoDB`,
`Fallback dataset`, or `Offline (cached)` so you can tell at a glance whether
the device actually fetched from your API.

## Map implementations

- `components/NativeFarmMap.native.tsx` — `react-native-maps`, Apple Maps on
  iOS / Google Maps on Android. Real tiles, pan + zoom, custom farm-stand
  markers.
- `components/NativeFarmMap.tsx` — stub returning `null` so Metro doesn't try
  to bundle the native module on web.
- `LeafletFarmMap` (in `App.tsx`) — Leaflet + CARTO Voyager tiles for the web
  build only.

## What lives where

- `lib/api.ts` — base URL resolution + typed fetch wrapper.
- `lib/marketplace.ts` — types and `fetchMarketplaceSnapshot()`.
- `App.tsx` — `MarketScreen` calls `fetchMarketplaceSnapshot()` on mount with
  retry + offline fallback.

## Just the mobile side

If you only need Expo (no backend):

```bash
npm run dev:mobile
```

Or just the backend:

```bash
npm run dev:web
```

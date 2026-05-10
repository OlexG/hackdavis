# Sunpatch mobile

Expo SDK 54 client for Sunpatch. The mobile app uses the same Next.js + MongoDB
auth, shop, inventory, and social data as the web app.

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

## Push notifications

Expo SDK 54 requires an EAS project ID before it can mint an Expo push token.
Set `EXPO_PUBLIC_EAS_PROJECT_ID` when starting Expo, or add the same value to
`extra.eas.projectId` in `mobile/app.json`. Use a development build for the
most reliable push behavior; Expo Go has notification limitations.

## What lives where

- `lib/api.ts` — base URL resolution + typed fetch wrapper.
- `lib/auth.ts` — login, signup, logout calls against the web auth API.
- `lib/shop.ts` — shop and inventory display types from `/api/shop/display`.
- `lib/social.ts` — public farm shopfronts and reviews from `/api/social`.
- `App.tsx` — login/signup, social browsing, reviews, and my-shop display.

## Just the mobile side

If you only need Expo (no backend):

```bash
npm run dev:mobile
```

Or just the backend:

```bash
npm run dev:web
```

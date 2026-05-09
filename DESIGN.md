# Sunpatch Design Notes

## Product Idea

Sunpatch is a cozy farm planning app where people design their own gardens,
learn how to grow them, simulate the season, track progress, and eventually
trade real fruits, vegetables, herbs, and other produce with nearby people.

The product should feel like a bridge between a farming game and a practical
local food tool. It should be playful enough to make planning feel rewarding,
but clear enough that users trust it for real gardening decisions.

## Inspiration

- Solar-punk villages with greenery, renewable energy, bright skies, and
  optimistic community infrastructure.
- Stardew Valley and indie farming games: cozy progress loops, crop tiles,
  quests, badges, small-town trading, and satisfying seasonal growth.
- Hand-painted countryside scenes: soft hills, gardens, sunlight, clouds,
  warm skies, and an inviting horizon.
- Pixel/retro UI influence: chunky borders, compact panels, grid-based farm
  layouts, status meters, and game-like progression.

## Mood

- Warm, colorful, optimistic, and inviting.
- Cozy rather than corporate.
- Practical, but still game-like.
- Solar-punk, not sci-fi cold.
- Bright and airy, with shadows used sparingly.
- The overall direction should feel lighter over time: less heavy shadow,
  less dark overlay, more sunlight, more cream, more sky, and more breathing
  room.

## Visual Principles

- Use the farm, sky, crops, and community market as first-viewport signals.
- Avoid generic SaaS landing-page patterns.
- Avoid dark, blurry, stock-like imagery.
- Keep UI elements crisp and legible, especially on mobile.
- Prefer simple, chunky, readable shapes over detailed illustration.
- Keep corners mostly square or lightly rounded.
- Use cards only for individual repeated items, panels, stats, and notes.
- Do not nest cards inside cards.
- Let sections be full-width color bands or unframed layouts.

## Palette

Core colors currently used:

- Cream parchment: `#fff3cf`
- Warm cream highlight: `#fff8dc`
- Deep soil text: `#2d2313`
- Leaf green: `#2f6f4e`
- Medium green: `#4e9f5d`
- Soft field green: `#7eb56b`
- Sky blue: `#48b9df`
- Soft sky blue: `#76d4eb`
- Squash gold: `#f2bd4b`
- Sun gold: `#ffd667`
- Warm field gold: `#f6c765`
- Tomato red: `#e9503f`
- Clay red: `#d84933`
- Carrot orange: `#e9823a`
- Clay brown: `#c9823e`
- Berry purple: `#7067c7`

Palette guidance:

- Keep cream and sky as the biggest color fields.
- Use green as the product anchor.
- Use gold/yellow for primary calls to action and sunlight.
- Use red/orange/purple as crop accents, not dominant page colors.
- Avoid making the entire interface one hue family.

## Typography

Primary font:

- Geist Sans, loaded through `next/font/google`.

Mono font:

- Geist Mono for future codes, metrics, IDs, or technical labels.

Current type behavior:

- Hero headline is large, heavy, and compact.
- Section headings are bold and direct.
- Small labels use uppercase and heavy weight.
- Body copy is warm, readable, and practical.
- Letter spacing should remain normal.
- Do not scale font size with viewport width.

## Layout

Current page structure:

- Hero section with animated solar-punk sky.
- Farm builder section with three core steps.
- Pixel-style farm planning board.
- Real produce marketplace section.
- Design outline section.

Preferred hero direction:

- The hero should cover the whole screen.
- The hero should feel bright, airy, and polished.
- The first viewport should clearly show the product mood before scrolling.
- The next section can peek subtly, but the hero should own the screen.

Spacing:

- Use generous vertical space in the hero.
- Keep tool panels dense enough to feel like a real app.
- Use consistent section padding.
- Keep content constrained with a max width around the current `max-w-7xl`.

## Hero System

The hero no longer depends on a low-resolution raster image. It should use a
crisp animated sky scene built from CSS layers:

- Sunrise gradient.
- Large warm sun.
- Sun rings.
- Soft drifting clouds.
- Small solar-punk airships.
- Rolling green hills.
- Field strips near the bottom.
- Cream fade into the next section.

Hero animation ideas:

- Clouds drift slowly.
- Airships float gently.
- Sun breathes subtly.
- Sun rings rotate slowly.
- Respect reduced-motion preferences.

Hero readability:

- Text must stay readable over the sky.
- Use lighter overlays where possible.
- Prefer subtle text shadow or contrast layers over heavy drop shadows.
- Avoid making the hero feel muddy or overly dark.

## UI Components

Navigation:

- Compact wordmark using the working name `Sunpatch`.
- Small square emblem with `SP`.
- Simple anchor links: Planner, Trading, Design.

Buttons:

- Chunky, rectangular, high-contrast.
- Primary button uses squash gold.
- Secondary button uses warm cream.
- Shadows should be restrained. Use borders and color before heavy shadow.

Cards and panels:

- Use 2px dark borders for the game-like look.
- Prefer cream card backgrounds.
- Use colored accent shadows only when they support the indie-game style.
- Keep radius low or square.

Farm board:

- Grid-based layout.
- Crop tiles include Tomato, Kale, Corn, Berry, Carrot, and Herbs.
- Each crop has a distinct color swatch.
- Stats currently include Soil, Water, and Yield.

## Product Content

Core loop:

1. Sketch your patch.
2. Simulate the season.
3. Trade the surplus.

Feature ideas:

- Pixel-style farm planner.
- Growing quests and badges.
- Season and weather simulator.
- Seed-to-harvest lessons.
- Neighborhood produce exchange.
- Progress journal for every bed.

Tone:

- Use clear, optimistic language.
- Avoid generic marketing filler.
- Keep the product grounded in real gardening and local trading.
- Make progress feel playful and useful.

## Motion Guidelines

- Motion should feel slow, warm, and ambient.
- Avoid fast or distracting animation.
- Use animation mostly in the hero and small delight moments.
- Provide `prefers-reduced-motion` handling.
- Do not animate layout in a way that shifts text or controls.

## Accessibility

- Maintain strong text contrast over animated backgrounds.
- Keep important hero art decorative with `aria-hidden`.
- Use semantic sections and real links.
- Ensure buttons/links have readable labels.
- Avoid relying on color alone for important information.
- Make sure text fits on mobile without overlapping.

## Implementation Notes

- App uses Next.js App Router.
- Current route is `src/app/page.tsx`.
- Global theme and hero animation styles live in `src/app/globals.css`.
- Fonts are configured in `src/app/layout.tsx`.
- Keep the homepage as a Server Component unless interactivity requires a
  smaller Client Component.
- Continue using Tailwind utilities for layout and local CSS for complex
  scene animation.


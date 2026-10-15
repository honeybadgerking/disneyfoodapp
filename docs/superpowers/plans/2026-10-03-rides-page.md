# Rides Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A no-sign-in `rides.html` page listing every Disneyland Resort ride with live status/waits, plus a refurbishment section that merges live status with hand-kept notes from `rides.json`.

**Architecture:** Pure data functions in `public/js/rides.js` (browser global `window.Rides`, `require`-able in Node), a hand-maintained `public/rides.json`, and a static `public/rides.html` that fetches the ThemeParks.wiki live endpoint plus `rides.json` and renders with DOM APIs. Same pattern as `events.html` and `public/js/map-links.js`.

**Tech Stack:** Plain HTML/CSS/JS (no build), `node:test` via `npm test`, Firebase Hosting (auto-deployed on merge to `main`).

**Spec:** `docs/superpowers/specs/2026-10-03-rides-page-design.md`

## Global Constraints

- Live endpoint: `https://api.themeparks.wiki/v1/entity/bfc89fd6-314d-44b4-b89e-df1a89cf991e/live`; use only `entityType === "ATTRACTION"`.
- Park IDs: `7340550b-c14d-4def-80bb-acdb51d49a66` → `dl`; `832fcd51-ea19-4e77-85c7-75d5843b127c` → `dca`.
- Statuses: `OPERATING`, `DOWN`, `CLOSED`, `REFURBISHMENT`. Pill labels: Open / Down / Closed / Refurb.
- Rides without a land go under **Other**, sorted last; lands otherwise alphabetical, rides alphabetical.
- No `innerHTML` with data; links from `rides.json` must match `^https://`.
- Refresh live data every 5 minutes; fetch `rides.json` with `cache: 'no-cache'`.
- Copy: "Reopening date not announced", "No rides are down for refurbishment right now 🎉", "Live ride status is unavailable right now. Try again shortly.", "Couldn't load ride status".
- Must not horizontally scroll at 375px.

## Review Focus

- A ride `OPERATING` with no `queue.STANDBY.waitTime` (walkthroughs, null waits) → shows "Open" with no minutes, never "null min".
- After park close every ride is `CLOSED` → page still renders all lands, refurb section still correct (refurb status persists overnight).
- An attraction whose `parkId` is neither park → dropped, not rendered under a bogus section.
- A `rides.json` refurb entry whose `starts` is malformed or missing → treated as a current (not upcoming) note; never throws.
- API down → refurb notes still render (nothing treated as stale) and park sections show the unavailable message.

---

### Task 1: Ride data functions

**Files:**
- Create: `public/js/rides.js`
- Test: `tests/rides.test.js`

**Interfaces:**
- Produces (exported as `module.exports` in Node, `window.Rides` in the browser):
  - `normalizeRides(liveData: object[]) -> Ride[]` where `Ride = { id, name, park: 'dl'|'dca', status, wait: number|null, lightningLane: boolean, singleRider: boolean }`. Drops non-attractions and unknown parks. `wait` only when `status === 'OPERATING'` and `STANDBY.waitTime` is a number. `lightningLane` = `RETURN_TIME` or `PAID_RETURN_TIME` present.
  - `refurbList(rides: Ride[]|null, meta: object|null, today: 'YYYY-MM-DD') -> { current: Refurb[], upcoming: Refurb[] }` where `Refurb = { id, name, park: 'dl'|'dca'|null, expectedReopen: string|null, note: string|null, url: string|null, starts: string|null }`. `current` = every live `REFURBISHMENT` ride (merged with its note) plus, when `rides` is `null` (API down), every note without a future `starts`. `upcoming` = notes with a valid `starts` > `today`. A note for a ride that is live and not in refurb, with no future `starts`, is dropped. Both lists sorted by name.
  - `downList(rides: Ride[]) -> Ride[]` (status `DOWN`, sorted by name).
  - `groupByLand(rides: Ride[], meta: object|null) -> { dl: {land, rides}[], dca: {land, rides}[] }`.

- [ ] **Step 1: Write the failing tests** in `tests/rides.test.js` (`node:test` + `node:assert`), using small realistic fixtures copied from the live API shape:
  - `normalizeRides`: maps both park IDs; drops `RESTAURANT` and an unknown `parkId`; `wait === 40` for `{status:'OPERATING', queue:{STANDBY:{waitTime:40}}}`; `wait === null` for OPERATING with no STANDBY and for `CLOSED` with `waitTime: 15`; `lightningLane` true for `RETURN_TIME` and for `PAID_RETURN_TIME`; `singleRider` true for `SINGLE_RIDER`.
  - `refurbList`: live refurb + matching note → `expectedReopen`/`note`/`url` merged; live refurb with no note → `expectedReopen === null`; note for a ride now `OPERATING` with no `starts` → absent from both lists; note with `starts: '2026-12-01'`, ride `OPERATING`, `today: '2026-10-03'` → in `upcoming` only; note with `starts: 'soon'` → in `current` only when ride is in refurb, else dropped; `rides === null` → notes without future `starts` appear in `current` with `park: null`.
  - `downList`: returns only `DOWN` rides, sorted.
  - `groupByLand`: rides with lands group correctly; a ride with no land entry → `Other`; `Other` is last; `meta === null` → everything under `Other`.

- [ ] **Step 2: Run to verify failure**
Run: `node --test tests/rides.test.js`
Expected: FAIL, `Cannot find module '../public/js/rides.js'`

- [ ] **Step 3: Implement the four functions** in `public/js/rides.js` with the same IIFE/UMD wrapper as `public/js/map-links.js`. A date string is a valid `starts` only if it matches `^\d{4}-\d{2}-\d{2}$`; compare as strings.

- [ ] **Step 4: Run to verify pass**
Run: `node --test tests/rides.test.js`
Expected: all pass

- [ ] **Step 5: Commit**: `git add public/js/rides.js tests/rides.test.js && git commit -m "Add ride status data functions"`

### Task 2: Hand-kept ride metadata

**Files:**
- Create: `public/rides.json`
- Test: `tests/rides.test.js` (append)

**Interfaces:**
- Consumes: schema from the spec (`updated`, `lands: {id: land}`, `refurbs: [{id, name, expectedReopen, note, url?, starts?}]`).
- Produces: the file `rides.html` fetches at `/rides.json`.

- [ ] **Step 1: Write the failing test** `rides.json is well-formed`: parses; `updated` matches `^\d{4}-\d{2}-\d{2}$`; every `lands` value is a non-empty string; every refurb has string `id` and `name`; any `url` matches `^https://`; any `starts` matches the date pattern; `Object.keys(lands).length >= 70`.
- [ ] **Step 2: Run** `node --test tests/rides.test.js`. Expected: FAIL (file missing).
- [ ] **Step 3: Create `public/rides.json`.** Fill `lands` for every current attraction from the live endpoint (look up each ride's land on the official park map; use the in-park land name, e.g. "Avengers Campus", "Pixar Pier"). Add `refurbs` entries for the rides currently in refurbishment (Indiana Jones™ Adventure, Mad Tea Party) with `expectedReopen` and `note` only from a citable source in `url`; if none is found, set `expectedReopen` to null and omit `note`.
- [ ] **Step 4: Run** `node --test tests/rides.test.js`. Expected: all pass.
- [ ] **Step 5: Commit**: `git add public/rides.json tests/rides.test.js && git commit -m "Add hand-kept ride lands and refurbishment notes"`

### Task 3: Rides page and navigation

**Files:**
- Create: `public/rides.html`
- Modify: `public/events.html` (`.nav` block), `public/index.html` (`.page-nav` block)

**Interfaces:**
- Consumes: `window.Rides.{normalizeRides, refurbList, downList, groupByLand}` (Task 1), `/rides.json` (Task 2).

- [ ] **Step 1: Build `public/rides.html`** copying `events.html`'s `:root` tokens, `.paper`, `.nav`, `.masthead`, `.section h2` and `.footer` styles. Sections and copy exactly as the spec's "Page layout". Load `/js/rides.js` as a classic script. `today` = Anaheim date via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })`. Fetch both sources with `Promise.allSettled`; render per the spec's "Error handling" table; `setInterval` 5 min re-fetches only the live endpoint and re-renders.
- [ ] **Step 2: Add nav links**: 🎢 Rides in `events.html`'s `.nav` and in `index.html`'s `.page-nav`; rides.html's nav includes all three with Rides as `.current`.
- [ ] **Step 3: Verify in the local preview** (copy `public/` to the scratchpad preview folder, open `/rides.html`):
  - At 375px: `document.documentElement.scrollWidth === 375`.
  - Refurb section lists Indiana Jones™ Adventure and Mad Tea Party (or whatever the API currently reports).
  - Each park section shows its lands; no "null" text anywhere (`!document.body.innerText.includes('null')`).
  - Nav links work from all three pages.
  - Simulate API failure (block `api.themeparks.wiki` via a fetch override in the console, reload): refurb notes still show; park sections show the unavailable copy.
- [ ] **Step 4: Run all tests**: `npm test`. Expected: all pass.
- [ ] **Step 5: Commit**: `git add public/rides.html public/events.html public/index.html && git commit -m "Add rides page with live status and refurbishment tracking"`

### Task 4: Ship

- [ ] **Step 1:** `git push -u origin rides-page`, open a PR against `main` describing the page, data sources, how to update `rides.json`, and that merging deploys.

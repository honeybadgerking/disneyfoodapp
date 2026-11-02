# Rides Page — Design

**Date:** 2026-10-03
**Status:** Approved in chat, pending spec review

## Goal

A new page listing every ride at Disneyland Park and Disney California Adventure
with live status and wait times, and a dedicated section tracking rides that
are down for refurbishment, including hand-maintained expected reopening dates
and notes.

## Decisions (from the user)

- **Refurbishment tracking = live + notes (option B).** Live refurbishment status
  comes from the API; expected reopening dates, notes, and upcoming closures come
  from a hand-maintained JSON file. No history of past refurbishments.
- **Ride list is info-only (option A).** No sign-in, no "rode it" checkmarks, no
  Firestore.
- **Separate static page (approach 1).** Same pattern as `events.html`: a plain
  HTML file in `public/`, deployed by the existing GitHub Action on merge to `main`.

## Data sources

### Live: ThemeParks.wiki

`GET https://api.themeparks.wiki/v1/entity/bfc89fd6-314d-44b4-b89e-df1a89cf991e/live`
(Disneyland Resort). Keyless, CORS `*`. Filter `liveData` to
`entityType === "ATTRACTION"`. Fields used per ride:

| Field | Use |
|---|---|
| `id` | Stable key into `rides.json` |
| `name` | Display name |
| `parkId` | `7340550b-…` = Disneyland, `832fcd51-…` = California Adventure |
| `status` | `OPERATING`, `DOWN`, `CLOSED`, `REFURBISHMENT` |
| `queue.STANDBY.waitTime` | Standby wait in minutes (may be null/absent) |
| `queue.RETURN_TIME` or `queue.PAID_RETURN_TIME` | Present → show ⚡ Lightning Lane |
| `queue.SINGLE_RIDER` | Present → show 🧍 single rider |

The API has no lands and no reopening dates.

### Hand-maintained: `public/rides.json`

```json
{
  "updated": "2026-10-03",
  "lands": {
    "<ride id>": "Adventureland"
  },
  "refurbs": [
    {
      "id": "<ride id>",
      "name": "Indiana Jones™ Adventure",
      "expectedReopen": "Late 2026",
      "note": "What's changing, if known.",
      "url": "https://… (optional source)",
      "starts": "2027-01-06 (optional; only for upcoming closures)"
    }
  ]
}
```

- `name` is stored in each refurb entry so an upcoming closure can render even
  if the API drops the ride.
- `lands` is filled in once for all current rides. Rides without an entry render
  under **Other**.
- `expectedReopen` is free text ("Late 2026", "Nov 14, 2026") because Disney often
  announces vague windows.

## Page layout: `public/rides.html`

Visual language matches `events.html` (paper card, navy/gold, Georgia headings).
Mobile-first; no horizontal scroll at 375px.

1. **Nav**: 🍔 Food Checklist · 📰 Events Newsletter · 🎢 Rides (current). The 🎢 link
   is also added to `events.html`'s nav and `index.html`'s page-nav.
2. **Masthead**: "Ride Status" title plus the last-updated time.
3. **🔧 Down for Refurbishment**:
   - Every ride with live `status === "REFURBISHMENT"`, merged with its `refurbs`
     entry if present. Shows park, name, expected reopening, note, and source
     link. With no entry: "Reopening date not announced".
   - **Upcoming** refurbs: entries with `starts` in the future, labeled
     "Closing <date>".
   - A refurb entry whose ride is live with a non-refurb status and no future
     `starts` is **stale** and hidden (the ride reopened).
   - Empty state: "No rides are down for refurbishment right now 🎉".
4. **⚠️ Temporarily Down**: rides with `status === "DOWN"`. Hidden when empty.
5. **🏰 Disneyland Park** and **🎡 California Adventure**: every ride, grouped by
   land (lands sorted alphabetically, **Other** last), rides alphabetical. Each
   row: name, status pill (Open / Down / Closed / Refurb), standby wait when
   `OPERATING` with a number, ⚡ and 🧍 badges.
6. **Footer**: "Live data from ThemeParks.wiki · updated h:mm a" and "Refurb notes
   updated <rides.json updated>".

The page refreshes live data every 5 minutes while open. `rides.json` is fetched
once with `cache: 'no-cache'`, like `events.json`.

## Code structure

- **`public/js/rides.js`**: pure functions, no DOM, loaded as a classic script
  (`window.Rides`) and `require`-able in Node (same pattern as `map-links.js`):
  - `normalizeRides(liveData)` → `[{ id, name, park, status, wait, lightningLane, singleRider }]`
  - `refurbList(rides, meta, today)` → `{ current: [...], upcoming: [...] }`
    (merges notes, drops stale entries)
  - `downList(rides)` → rides with status `DOWN`
  - `groupByLand(rides, meta)` → `{ dl: [{ land, rides }], dca: [...] }`
- **`public/rides.html`**: fetches, calls the functions above, and renders with
  `textContent`/`createElement` (no `innerHTML` with data, matching `events.html`).
  Links from `rides.json` pass the same `https://`-only check as `events.html`.

## Error handling

- **API fails:** the refurbishment section still renders from `rides.json` notes
  (no live merge, nothing treated as stale), and the park sections show "Live ride
  status is unavailable right now. Try again shortly."
- **`rides.json` fails:** the page still renders live data. Lands become **Other**
  and refurb rows show "Reopening date not announced".
- **Both fail:** a single "Couldn't load ride status" message.

## Testing

- `tests/rides.test.js` (node:test, runs in `npm test`):
  - normalizes park, wait, ⚡ and 🧍 from realistic API records
  - refurb with notes merges; refurb without notes gets the default text
  - stale note (ride now `OPERATING`) is hidden
  - upcoming closure (`starts` in the future) is listed while the ride is open
  - rides without a land go under **Other**, which sorts last
  - DOWN rides are listed
- Manual: local preview at 375px width against live data: no horizontal scroll,
  the nav works on all three pages, and today's refurbs (Indiana Jones Adventure,
  Mad Tea Party) appear.

## Out of scope

- Ride checklist or any sign-in features.
- Refurbishment history.
- Wait-time forecasts and charts.
- Shows and parades (the API lists only `ATTRACTION` entities here, which include
  a few walkthroughs such as The Disney Gallery; these are kept).

---

## Revision 2026-11-02: build into the Ride Heights page (supersedes the layout above)

A Ride Height Requirements page (`public/rides.html` + `public/rides.json`, rides keyed by
name with `land`, `min`, `note`, `rank`) was added to `main` after this spec was written.
Decisions from the user:

- **Option A:** live status and refurbishment tracking are added **to the existing Ride
  Heights page**, not a separate page.
- **No live wait times and no auto-refresh.** Live status is fetched **once on page load**
  and used only for status: the refurbishment and temporarily-down sections and a per-ride
  status pill. No standby minutes, no ⚡/🧍 badges, no 5-minute refresh.
- **Remove the four A Bug's Land rides** (Francis' Ladybug Boogie, Flik's Flyers,
  Heimlich's Chew Chew Train, Tuck and Roll's Drive 'Em Buggies); the land closed in 2018.

Changes to the design above:

- **Matching by API id.** Each ride in `rides.json` gains `ids: [<ThemeParks.wiki id>, …]`
  (an array, because Pixar Pal-A-Round is two API entities). Ids survive seasonal overlay
  renames (e.g. Haunted Mansion Holiday, Soarin' Across America). A ride's status is the
  "best" of its ids: `OPERATING` > `DOWN` > `CLOSED` > `REFURBISHMENT`, so a single open
  side counts as open.
- **Notes file.** Refurbishment notes live in a new `public/refurbs.json`
  (`{ updated, refurbs: [...] }`, entry schema as above); `rides.json` keeps heights.
- **Lands** come from `rides.json`; `groupByLand` is dropped.
- **Layout.** Between the hero and the park tabs: 🔧 Down for Refurbishment (current and
  upcoming) and ⚠️ Temporarily Down, each listing rides from both parks. Each ride card shows
  a status pill (Open / Down / Closed / Refurb) when live data loaded. The footer shows "Ride
  status checked h:mm a". Refurbishment sections include API rides not on the heights list
  (e.g. Redwood Creek Challenge Trail), by API name.
- **Error handling.** API failure: heights render as today, refurb notes render from
  `refurbs.json`, no pills, and a one-line notice "Live ride status unavailable". `refurbs.json`
  failure: refurb rows show "Reopening date not announced".

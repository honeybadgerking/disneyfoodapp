# disneyfoodapp

Plain HTML app in `public/` (no build step), hosted on Firebase Hosting.

- `/` — food & drink checklist (per-user, synced via Firestore)
- `/rides.html`, `/events.html` — ride heights and events
- `/crew.html` — **Crew Feed**: invite-only posts (tips, reviews, plans, questions), likes and replies

## Crew Feed: invite-only access

Only Google accounts on the invite list can read or post. This is enforced in
`firestore.rules`, not just the UI.

One-time setup:

1. Deploy the rules (the hosting workflow does **not** deploy them):
   `npx firebase-tools deploy --only firestore:rules --project disneyland-food-web-app`
2. Sign in to the app once, then in the Firebase console → Firestore create a
   document `admins/{your-auth-uid}` (empty is fine). Your UID is under
   Authentication → Users.
3. Open `/crew.html` — as admin you'll see an invite form. Add each person's
   Google account email; remove them with ✕ to revoke access instantly.

Data: `invites/{lowercased-email}`, `posts/{id}`, `posts/{id}/comments/{id}`.

## Tests

`npm test` runs the Firestore rules tests (emulator, needs Java) and unit tests.

# LA_ON-BOX

Independent audio-only live UI for LegendaryApocalypse. It includes separated Member/Broadcaster mock sessions, a schedule-based audio slot console, microphone input meter, visual settings, audio adapter boundary, danmaku, timers, and developer diagnostics. It contains no camera, video, recording, payment, or production media-server implementation.

## Run

1. Copy `.env.example` to `.env` and set the mock broadcaster password locally.
2. Run `npm install`.
3. Run `npm run dev`.

Member mock: `demo-member` / `demo1234`. Broadcaster mock: `artist-a` / value of `VITE_MOCK_BROADCASTER_PASSWORD` (the example value is `stream1234`). Mock authentication is disabled when `VITE_USE_MOCK_AUTH=false`.

## Build and Lolipop

Run `npm run build`. Upload the **contents** of `dist/` (including `.htaccess`) into the Lolipop public directory `/la-on-box/`; do not upload the `dist` directory itself. HTTPS is required for microphone permission. The Vite base path is `/la-on-box/`, and the included `.htaccess` provides SPA direct-route fallback.

## Production connection points

- `src/services/audioStreamAdapter.ts`: replace mock methods with WebRTC/SFU/Icecast/HLS/external adapter.
- `src/services/comments.ts`: replace local persistence with Firestore `streamComments/{eventId}/comments` subscription and only render `approved` records.
- `src/services/artistVisuals.ts`: connect to Firestore + Firebase Storage paths documented in `FIREBASE_RULES_PROPOSAL.md`.
- `src/services/auth.ts`: connect Member login to LA_OS Firebase Auth/member document and Broadcaster login to server-issued, hashed credentials. No plain-text production password must reach this client.

The Firebase collection/rules changes are proposals only: existing Firebase rules are not modified.

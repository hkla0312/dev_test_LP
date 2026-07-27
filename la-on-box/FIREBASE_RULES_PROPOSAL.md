# LA_ON-BOX Firebase rules proposal

This file is intentionally not deployed as a Firebase rules replacement. Add and test equivalent clauses in the existing rules only after broadcaster accounts are implemented server-side.

- `broadcastEvents` / `broadcastSlots`: public read only for `isPublished == true`; writes restricted to Admin or trusted server.
- `streamComments/{eventId}/comments/{commentId}`: authenticated Members create only their own, 30-character body; read only `status == 'approved'`; approval changes restricted to Admin/server.
- `streamPresence`: public read; write only from a verified broadcaster/server after slot and time validation.
- `artistVisualSettings`: reads for published slots; writes only from verified broadcaster/server that owns the slot.
- Storage paths `la-on-box/{eventId}/{slotId}/thumbnail/*` and `background/*`: allow PNG/JPEG/WebP smaller than 5 MB only to a server-verified slot owner.

Client-side slot checks are UI protection only. Production must re-check account ownership and time window in Firestore rules plus a backend/Cloud Function.

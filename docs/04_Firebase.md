# Firebase Specification

## Services

- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Hosting
- Cloud Functions

## Authentication

### Roles
- `admin`
- `member`

Admin privileges should use custom claims.

## Storage

### Buckets / Paths

```text
artists/{artist_id}/icon/{file_name}
flyers/{event_id}/{file_name}
archive_thumbnails/{archive_id}/{file_name}
```

## Firestore Security Principles

- Members can read their own member document.
- Members can create Signal submissions under validated limits.
- Members cannot approve Signal.
- Members cannot unlock Archive.
- Admin can manage events, ACT, Archive, Signal moderation, and member grants.

## Cloud Functions

Recommended functions:

- `onSignalSubmit`
- `approveSignal`
- `unlockArchiveForMember`
- `grantMemberExp`
- `uploadImageAndCleanupOld`
- `dailyLoginBonus`

## Server-side Limits

The following must be enforced server-side:

- Signal max 10 per event/member.
- Observation Progress gain max 5 Signal submissions per day.
- Daily Login max once per day.
- Additional Signal consumes bonus count and grants no progress.

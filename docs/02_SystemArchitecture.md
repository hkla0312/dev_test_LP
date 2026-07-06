# System Architecture

## Recommended Stack

### Frontend
- React + TypeScript recommended for production
- Vite or Next.js acceptable
- CSS Modules / Tailwind / plain CSS tokens acceptable

### Backend
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Hosting
- Cloud Functions for server-side validation and notifications

## Application Modules

```text
/apps or /src
  /lp
  /admin
  /member
  /send-signal
  /danmaku-view
  /archive
/shared
  /components
  /styles
  /utils
  /types
```

## Static Prototype Structure

```text
lp/
admin/
member/
data/
assets/
docs/
```

## Production Data Flow

### Signal

```text
Member SEND SIGNAL
↓
Firestore: signal_submissions
↓
Admin approval / moderation
↓
ACT DATA aggregation
↓
Member history / Your Signal
↓
LIVE DANMAKU VIEW if event display enabled
```

### Archive Unlock

```text
Admin selects Member ID
↓
Unlock Archive
↓
Firestore member_archive_unlocks
↓
Member Terminal removes LOCKED state
↓
Archive slide-out video embed appears
```

### Image Upload

```text
Admin uploads flyer/icon
↓
Firebase Storage save
↓
Firestore URL update
↓
Old file delete or mark stale
↓
LP/Admin reflect latest URL
```

## Security Notes

- Admin routes require admin auth claim.
- Member routes require Firebase Auth.
- Firestore rules must prevent client-side privilege escalation.
- Signal limits must be enforced server-side, not only UI.
- Archive unlock must be checked per member and archive ID.

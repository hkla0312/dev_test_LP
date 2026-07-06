# Admin Terminal Specification

## Purpose

Admin Terminal is an operations tool, not a lore-heavy UI. Use clear Japanese labels and sufficient spacing.

## Style Rule

- Section headings can remain English.
- Japanese subtitle must be included.
- Input labels should be plain Japanese.
- Buttons should be plain Japanese.

## Modules

### LIVE Management
- Add / edit / delete events
- Flyer image upload and preview
- Reservation URL
- Streaming ticket URL
- Published status

### ACT Management
- Basic ACT information
- Role selection: regular / fresh / organizer
- Icon image upload and preview
- X / Video / Music URLs
- Embed URL
- Operator comment
- Self comment

### Signal Moderation
- View pending Signal
- Approve / reject
- Approved Signal updates ACT DATA and Member history.

### Archive Management
- Create archive item
- Embed URL
- Thumbnail image
- Lock/unlock state

### Member Management
- Search/select member
- Grant merch/visit/archive/internal exp
- Unlock archive per member
- View member basic status

## Image Upload

Production flow:

```text
Select image
↓
Preview
↓
Upload to Storage
↓
Update Firestore URL
↓
Delete old file or mark stale
```

## Archive Unlock Operation

```text
Select Member ID from dropdown/search
Select Archive item
Click Unlock
```

# 04. Data Model

## Firestore Collections

### `events`
```json
{
  "title": "Legendary Apocalypse Vol.14",
  "date": "2026-07-19",
  "open": "15:30",
  "start": "16:00",
  "venue": "浅草橋MANHOLE",
  "ticketAdvance": "3500",
  "ticketDoor": "4000",
  "flyerUrl": "",
  "reserveUrl": "",
  "status": "OPEN",
  "active": true,
  "sortOrder": 1
}
```

### `artists`
```json
{
  "name": "DANCHO",
  "role": "ORGANIZER",
  "profile": "",
  "shortDescription": "",
  "imageUrl": "",
  "xUrl": "",
  "youtubeUrl": "",
  "musicUrl": "",
  "visible": true,
  "fixedTop": true,
  "regular": true,
  "firstAppearance": false,
  "sortOrder": 1
}
```

### `artistSignals`
ドキュメントIDはアーティストIDを想定。

```json
{
  "song": 34,
  "stage": 28,
  "character": 18,
  "total": 80,
  "updatedAt": 0
}
```

### `artistComments`
```json
{
  "artistId": "dancho",
  "comment": "また見たい",
  "visible": true,
  "createdAt": 0
}
```

### `siteSettings/main`
```json
{
  "officialXUrl": "",
  "contactFormUrl": "",
  "laOsDetailUrl": "",
  "laOsRegisterUrl": "",
  "ticketReserveUrl": ""
}
```

## DANMAKUサンプル
```json
[
  { "emoji": "🔥", "comment": "AMAZING!" },
  { "emoji": "⚡", "comment": "SO COOL!" },
  { "emoji": "👏", "comment": "GREAT SHOW!" },
  { "emoji": "😭", "comment": "I'M MOVED!" },
  { "emoji": "🖤", "comment": "RESPECT!" },
  { "emoji": "💀", "comment": "INSANE!" }
]
```

## セキュリティ
- LPは読み取り専用
- 書き込みはLA_OS側または管理画面から行う
- LPからのcreate/update/deleteは許可しない

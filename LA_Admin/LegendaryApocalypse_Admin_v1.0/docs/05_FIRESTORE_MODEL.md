# 05. Firestore Model

## events/{eventId}

```json
{
  "title": "",
  "eventDate": "",
  "venue": "",
  "openTime": "",
  "startTime": "",
  "advancePrice": 0,
  "doorPrice": 0,
  "streamingPrice": 0,
  "flyerUrl": "",
  "streamingUrl": "",
  "lpVisible": true,
  "status": "active",
  "artistIds": [],
  "environment": "dev",
  "createdAt": null,
  "updatedAt": null
}
```

status:
- active
- archived

## artists/{artistId}

```json
{
  "artistKey": "ART-0001",
  "name": "",
  "imageUrl": "",
  "profile": "",
  "xUrl": "",
  "youtubeUrl": "",
  "snsUrl1": "",
  "snsUrl2": "",
  "role": "ARTIST",
  "lpVisible": true,
  "fixedTop": false,
  "profileCompleted": false,
  "appearanceCount": 0,
  "signalTotal": 0,
  "levelValue": 1,
  "levelLabel": "v0.01",
  "environment": "dev",
  "createdAt": null,
  "updatedAt": null
}
```

role:
- ARTIST
- REGULAR

## members/{memberUid}

```json
{
  "uid": "",
  "memberId": "A7K2",
  "displayName": "",
  "email": "",
  "emailVerified": false,
  "xId": null,
  "progress": 0,
  "levelValue": 1,
  "levelLabel": "v0.01",
  "licenseType": "NONE",
  "accountStatus": "active",
  "environment": "dev",
  "createdAt": null,
  "updatedAt": null
}
```

licenseType:
- NONE
- STANDARD
- PREMIUM

## PROGRESS / LEVEL policy

- 表示レベルは `v0.01` から `v1.00` の100段階。
- 現在レベルから次レベルへ必要なPROGRESSは `4 + floor((level - 1) * 0.6)`。
- v1.00到達に必要な累積PROGRESSは約3,300pt。到達後もPROGRESSは加算される。
- 付与目安：毎日ログイン +1 / DANMAKU +2 / SIGNAL +3 / 来場 +10 / 小物購入 +5 / ドリンク +10 / アーカイブライセンス +25 / アパレル +60。

## memberIds/{memberId}

4桁会員IDの重複を防止する予約ドキュメントです。

```json
{
  "uid": "",
  "createdAt": null
}
```

## artistSignals/{signalId}

```json
{
  "artistId": "",
  "memberUid": "",
  "memberId": "",
  "memberDisplayName": "",
  "signalType": "song",
  "comment": "",
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "environment": "dev",
  "createdAt": null
}
```

## progressLogs/{logId}

```json
{
  "memberUid": "",
  "memberId": "",
  "amount": 100,
  "reason": "",
  "adminUid": "",
  "createdAt": null
}
```

## settings/system

```json
{
  "signalEnabled": true,
  "systemEnabled": true,
  "updatedAt": null,
  "updatedBy": ""
}
```

- `signalEnabled=false`: LA_OSからのSIGNAL送信を停止
- `systemEnabled=false`: SIGNALとPROGRESS付与を停止

## visitLogs/{logId}

```json
{
  "memberUid": "",
  "memberId": "",
  "eventId": "",
  "visitedAt": null
}
```

## adminLogs/{logId}

```json
{
  "adminUid": "",
  "adminDisplayName": "",
  "actionType": "",
  "targetType": "",
  "targetId": "",
  "targetLabel": "",
  "detail": "",
  "createdAt": null
}
```

## counters/{counterName}

自動採番用。

```json
{
  "current": 12
}
```

対象:
- artist
- member

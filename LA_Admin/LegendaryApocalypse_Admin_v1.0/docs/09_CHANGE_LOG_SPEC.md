# 09. Change Log Specification

## 記録対象

- EVENT_CREATE
- EVENT_UPDATE
- EVENT_ARCHIVE
- EVENT_RESTORE
- EVENT_DELETE
- ARTIST_CREATE
- ARTIST_UPDATE
- ARTIST_DELETE
- MEMBER_CREATE
- MEMBER_DELETE
- PROGRESS_ADD
- LICENSE_CHANGE
- SIGNAL_DELETE
- SIGNAL_RESTORE

## 記録しないもの

- 画面閲覧
- テーマ切替
- 一覧開閉
- 一時的なフォーム入力
- 差分全文

## 表示例

```text
2026/07/20 18:12
管理者: HK
操作: イベント更新
対象: Legendary Apocalypse Vol.15
詳細: イベント情報を保存
```

## 保持

初版では期限を設けず保存。
将来、件数増加時に期間絞り込み・CSV出力を追加可能。

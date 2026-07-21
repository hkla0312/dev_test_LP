# AGENTS.md

## Project

Legendary Apocalypse Admin v1.0

## Source of Truth

実装前に以下を読むこと。

- README.md
- docs/01_PRODUCT_REQUIREMENTS.md
- docs/02_SYSTEM_ARCHITECTURE.md
- docs/03_UI_UX_SPEC.md
- docs/04_SCREEN_SPEC.md
- docs/05_FIRESTORE_MODEL.md
- docs/06_SECURITY_SPEC.md
- docs/07_IMPLEMENTATION_GUIDE.md
- docs/08_ACCEPTANCE_CRITERIA.md
- docs/09_CHANGE_LOG_SPEC.md
- docs/10_FUTURE_SCOPE.md
- mockup/admin_mockup_v1.png

仕様書にない機能を独自判断で追加しないこと。

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Firebase Authentication
- Firestore
- Firebase Storage

フレームワーク、TypeScript、ビルド環境は追加しないこと。

## UI

- Lightテーマを標準
- Darkテーマ切替
- 日本語UI
- 左サイドバー
- 白・ライトグレー基調
- シアンを主アクセント
- 保存・削除・アーカイブ・復元・付与前に確認ダイアログ
- トースト通知
- テーマ設定はlocalStorageに保存

## Naming

- イベント
- アーティスト
- メンバー
- PROGRESS
- SIGNAL
- 変更履歴

LPやLA_OSで使用中の固有名称は変更しないこと。

## Data Rules

- EVENTは物理削除しない。アーカイブ方式。
- ARTISTは基本的に削除しない。LP掲載ON/OFFで管理。
- 出演回数はEVENTとの紐付け数から自動集計。
- 出演3回以上でREGULARへ自動昇格。
- DANCHOはfixedTop=true。
- SIGNAL総数は上限なく保持。
- 表示レベルはv0.01〜v1.00の100段階。
- SIGNAL削除は論理削除。
- MEMBERパスワードは表示・保存しない。
- ライセンスはNONE / STANDARD / PREMIUM。
- STANDARDは直近3公演、PREMIUMは全公開アーカイブ閲覧。
- PROGRESS付与は必ず履歴を残す。
- 主要操作だけadminLogsへ記録する。

## Safety

- Admin以外の書き込みを禁止
- Firebase Admin SDK相当の秘密情報をクライアントへ置かない
- パスワードをFirestoreへ保存しない
- 動的文字列をエスケープ
- 画像形式・容量を検証
- 失敗時にデータを半端な状態へしない

## Completion Report

完了時に以下を報告すること。

- 変更ファイル
- 実装済み機能
- 手動テスト結果
- 未設定のFirebase項目
- 残課題

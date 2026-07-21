# Legendary Apocalypse Official LP

Legendary Apocalypseの一般公開用公式LPです。HTML / CSS / Vanilla JavaScriptのみで構成され、静的ホスティングへそのまま配置できます。

## 起動方法

ビルドは不要です。`index.html` をブラウザで開くか、任意の静的ファイルサーバーの公開ディレクトリに `index.html`、`style.css`、`app.js` を配置してください。

## Firebase設定

`app.js` 冒頭の `CONFIG.firebase` に既存Firebaseプロジェクトの接続情報を入力してください。LPはFirestoreを読み取るだけで、書き込みは行いません。未設定・接続失敗・データ未登録時には、操作確認用のフォールバックデータが表示されます。

外部URLも同じ `CONFIG` に集約しています。Firestoreの `siteSettings/main` が存在する場合は、そちらの設定値が優先されます。

## データ登録例

Firestoreに以下のコレクションを登録します。フィールド詳細は `docs/04_DATA_MODEL.md` を参照してください。

```text
events/{eventId}            active: true の次回公演
artists/{artistId}          visible / fixedTop を含むアーティスト
artistSignals/{artistId}    song / stage / character
artistComments/{commentId}  artistId / comment / visible
siteSettings/main           外部リンクURL
```

`artists` は `fixedTop: true` のDANCHOを先頭に表示し、残りの `visible: true` の対象からランダム5組を表示します。画像URLにはHTTPSの公開URLを設定してください。

Legendary Apocalypse公式LPの仕様・設計ドキュメントです。

## ドキュメント構成

- `docs/01_PRODUCT_SPEC.md`
- `docs/02_UI_UX_SPEC.md`
- `docs/03_ARTIST_SPEC.md`
- `docs/04_DATA_MODEL.md`
- `docs/05_CONTENT_COPY.md`
- `docs/06_IMPLEMENTATION_GUIDE.md`
- `docs/07_ACCEPTANCE_CRITERIA.md`
- `docs/08_FUTURE_SCOPE.md`

## LPコンセプト

- スマートで視認性の高い公式LP
- LIVE DANMAKU SYSTEM / STAFF TERMINAL と同系統のダークUI
- LA_OSのピクセル調UIはLPへ直接持ち込まず、世界観だけを接続
- 画像使用はロゴ、ヒーロービジュアル、アーティスト画像を中心に最小限
- UIパーツはCSSで構築
- モバイルファースト

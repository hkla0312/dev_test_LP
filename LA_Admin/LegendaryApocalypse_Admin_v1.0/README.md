# Legendary Apocalypse Admin v1.0

Firebase Authentication、Firestore、Storage を利用する静的な運営管理画面です。ビルドは不要で、対応ブラウザから `index.html` を配信できます。

## 起動

1. このフォルダをローカルの静的サーバーまたはホスティングへ配置します。
2. `firebase-config.js` に Firebase コンソールの Web アプリ設定を入力します。
3. Firebase Authentication でメール／パスワードの管理者アカウントを作成します。
4. Firestore の `admins/{uid}` に管理者アカウントの UID と任意の表示情報を登録します。
5. `firestore.rules` と `storage.rules` を Firebase へ反映します。

`admins/{uid}` が存在しないアカウントはログインできても管理画面へ進めません。パスワードを Firestore に保存・表示する処理はありません。

## ロリポップでの開発運用

この管理画面はビルド不要です。`LegendaryApocalypse_Admin_v1.0` フォルダの内容を、そのままロリポップの公開ディレクトリへアップロードしてください。`file:///` で直接開かず、必ずHTTPSの公開URLからアクセスします。

アップロード前にFirebase Consoleで以下を確認してください。

1. Authentication の「Sign-in method」でメール／パスワードを有効化する。
2. Authentication の「Settings」→「Authorized domains」に、ロリポップの公開ドメイン（例：`admin.example.com`）を追加する。
3. Firestore Rules と Storage Rules を、同梱の `firestore.rules` と `storage.rules` に更新する。
4. Firebase Authentication の管理者ユーザーのUIDを、Firestoreの `admin/{uid}` または `admins/{uid}` のドキュメントIDとして作成する。

ログインURLは `https://＜公開ドメイン＞/login/`、管理画面は `https://＜公開ドメイン＞/index.html` です。JavaScriptの読込URLにはバージョン番号を付けているため、アップロード後に古い管理画面スクリプトが残りにくい構成です。

## Firebase 設定とデータ

- 設定は `firebase-config.js` に集約しています。アクセス制御は必ず Rules で行ってください。
- データ構造は `docs/05_FIRESTORE_MODEL.md` に準拠します。ARTIST ID と MEMBER ID は `counters` を Firestore Transaction で採番します。
- 画像は PNG/JPG/WebP・5MB 以下を検証します。アーティスト画像は中央正方形にトリミングして保存します。
- 初期状態では Firebase 未設定エラーをログイン画面に明示します。本番データへの書き込みは行いません。

## 実装範囲

イベント、アーティスト、メンバー、PROGRESS、SIGNAL、変更履歴を実装しています。ダッシュボード、SITE SETTINGS、CONTENT、Assets Manager は実装していません。

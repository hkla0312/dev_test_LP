# Legendary Apocalypse OS

Legendary Apocalypse の公式 LP、会員端末（LA_OS）、管理画面、DANMAKU 表示、および Firebase バックエンドを一つにまとめたリポジトリです。

## 構成

- `LA_LP/` — 公式 LP
- `LA_OS/` — 会員端末
- `LA_Admin/LegendaryApocalypse_Admin_v1.0/` — 管理画面
- `danmaku-view/` — 会場向け DANMAKU 表示
- `functions/` — Firebase Cloud Functions
- `shared/` — 各画面で共有するブラウザ用スクリプト
- `docs/` — プロジェクト仕様と実装ドキュメント
- `firebase.json` / `.firebaserc` / `firestore.indexes.json` — Firebase 設定

## ローカル起動

クローン後、リポジトリ直下で静的 Web サーバーを起動します。

```bash
git clone https://github.com/hkla0312/LA_TERMINAL.git
cd LA_TERMINAL
python -m http.server 8000
```

ブラウザで次を開きます。

- LP: `http://localhost:8000/LA_LP/`
- LA_OS: `http://localhost:8000/LA_OS/`
- Admin: `http://localhost:8000/LA_Admin/LegendaryApocalypse_Admin_v1.0/`
- DANMAKU 表示: `http://localhost:8000/danmaku-view/`

Cloud Functions のテストは次で実行できます。

```bash
cd functions
npm ci
npm test
```

## Firebase

Firebase プロジェクトは `.firebaserc` の `default` で指定しています。Web クライアントの Firebase 設定は `LA_OS/firebase-config.js` に集約され、LP と DANMAKU 表示もこれを参照します。Firestore と Storage のルール、Firestore インデックス、Cloud Functions はルートの `firebase.json` からデプロイされます。

```bash
firebase deploy --only functions,firestore,storage
```

Firebase Console の権限、サービスアカウント鍵、アクセストークン、`.env` ファイルはリポジトリに含めません。

## ドキュメント

プロジェクト全体の起点は `docs/00_ProjectBible.md` です。画面・データ・Firebase の仕様は `docs/` を参照してください。各実装ディレクトリにある補足ドキュメントは、その画面固有の詳細仕様です。

# 02. System Architecture

## 1. 全体構造

```text
Admin
  ├ Firebase Authentication
  ├ Firestore
  └ Firebase Storage
        │
        ├ Official LP
        └ LA_OS
```

## 2. 認証

- Firebase Authenticationを使用
- 管理者権限は1種類のみ
- 管理者アカウントは後からFirebaseへ追加
- 未ログイン時はログイン画面のみ表示
- 認証済みかつ管理者権限確認後に管理画面を表示

## 3. データ反映

- Adminで保存
- Firestore / Storageへ反映
- LP・LA_OSは読み取り
- LP・LA_OS側の表示更新はonSnapshotまたは再読込

## 4. 書き込み原則

- Adminのみ編集可能
- LPは読み取り専用
- LA_OSは本人に許可された範囲のみ更新

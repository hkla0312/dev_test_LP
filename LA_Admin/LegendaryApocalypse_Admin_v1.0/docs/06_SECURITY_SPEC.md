# 06. Security Specification

## 1. 認証
- Firebase Authentication
- 管理者のみAdminアクセス
- 管理者権限は1種類

## 2. パスワード
- Firestoreへ保存しない
- Admin画面へ表示しない
- クライアントから現在値を取得しない

## 3. Firestore
- Adminのみevents / artists / members / progressLogs / adminLogsへ書込
- LPは公開データのみ読取
- LA_OSは本人データのみ読取・許可範囲で書込

## 4. Storage
- 管理者のみアップロード・削除
- MIME type検証
- ファイルサイズ上限
- ファイル名はIDベースで生成

## 5. 削除
- EVENT: アーカイブ
- ARTIST: 初版は削除なし
- SIGNAL: 論理削除
- 画像差替: 新画像保存成功後に旧画像削除

## 6. トランザクション
以下はtransactionまたはbatchを使う。

- ART / MEMBERの採番
- PROGRESS付与＋progressLogs＋adminLogs
- ライセンス変更＋adminLogs
- SIGNAL削除 / 復元＋adminLogs

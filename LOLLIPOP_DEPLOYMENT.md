# ロリポップ開発運用手順

このプロジェクトは静的ファイルとして運用します。Node.jsのビルドやローカルサーバーは本番環境に不要です。

## アップロードする構成

ロリポップの公開ディレクトリへ、次のフォルダ構成を維持してアップロードします。

```text
LA_LP/
LA_OS/
LA_Admin/LegendaryApocalypse_Admin_v1.0/
```

`local-server.js` と `管理画面をローカル起動.bat` はローカル確認専用であり、サーバーへアップロード不要です。

## Firebase Console の設定

1. Firebase Authenticationでメール／パスワードを有効にします。
2. Authentication → Settings → Authorized domains に、ロリポップの公開ドメインを追加します。ドメインだけを入力し、`https://` やパスは含めません。
3. Firestore Rules と Storage Rules を公開前の内容へ更新します。
4. 管理者アカウントのFirebase Authentication UIDを、`admin/{uid}` または `admins/{uid}` のドキュメントIDとして登録します。

## 公開後の確認URL

公開ディレクトリ直下へ配置する場合の例です。

```text
https://＜公開ドメイン＞/LA_LP/
https://＜公開ドメイン＞/LA_OS/
https://＜公開ドメイン＞/LA_Admin/LegendaryApocalypse_Admin_v1.0/login/
```

公開環境では必ずHTTPS URLでアクセスします。`file:///` はFirebase Authenticationの動作確認には使用しません。

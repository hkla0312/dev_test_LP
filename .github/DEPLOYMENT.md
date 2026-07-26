# 開発サーバーへの自動アップロード

`main` ブランチへ反映された `LA_LP/` の変更を、開発用サーバーへ自動アップロードします。

GitHubリポジトリの **Settings → Secrets and variables → Actions** を開き、以下の **Repository secrets** を追加してください。

| 名前 | 入力する値 |
| --- | --- |
| `FTP_SERVER` | FTPサーバーのホスト名。FTP方式へ戻す場合に使用 |
| `FTP_USERNAME` | FTP・WebDAVアカウント名 |
| `FTP_PASSWORD` | FTP・WebDAVパスワード |
| `FTP_SERVER_DIR` | 開発用公開フォルダ。例: `example.com/development/` |
| `WEBDAV_URL` | WebDAVの接続URL。例: `https://account.webdav-lolipop.jp/` |

この設定はロリポップのWebDAV（HTTPS）を使用します。転送時にFTPのデータ接続を使わないため、FTPの接続制限やパッシブモードの影響を受けません。

設定後は、`main` へ `LA_LP/` の変更をpushするたびにデプロイが実行されます。GitHubの **Actions** タブで実行結果を確認できます。手動で行う場合は、同タブの **Deploy LP to development server** から **Run workflow** を選びます。

このワークフローは、サーバー上にしかない既存ファイルを削除しません。

# 開発サーバーへの自動アップロード

`main` ブランチへ反映された `LA_LP/` の変更を、開発用サーバーへ自動アップロードします。

GitHubリポジトリの **Settings → Secrets and variables → Actions** を開き、以下の **Repository secrets** を追加してください。

| 名前 | 入力する値 |
| --- | --- |
| `FTP_SERVER` | FTPサーバーのホスト名。ポート指定が必要なら `example.com:21` の形式 |
| `FTP_USERNAME` | FTPアカウント名 |
| `FTP_PASSWORD` | FTPパスワード |
| `FTP_SERVER_DIR` | 開発用公開フォルダ。例: `/public_html/development/` |

この設定は FTPS（暗号化FTP）向けです。サーバーが通常FTPの場合は、`.github/workflows/deploy-development.yml` の `protocol: ftps` を `protocol: ftp` に変更してください。SFTPの場合は別の接続方式用ワークフローに差し替えます。

設定後は、`main` へ `LA_LP/` の変更をpushするたびにデプロイが実行されます。GitHubの **Actions** タブで実行結果を確認できます。手動で行う場合は、同タブの **Deploy LP to development server** から **Run workflow** を選びます。

このワークフローは、サーバー上にしかない既存ファイルを削除しません。

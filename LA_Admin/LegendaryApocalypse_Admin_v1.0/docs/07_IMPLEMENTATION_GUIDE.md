# 07. Implementation Guide

## 1. 推奨構成

```text
/
├ index.html
├ style.css
├ app.js
├ firebase-config.js
├ README.md
├ assets/
│  └ placeholder/
└ docs/
```

## 2. 実装順

1. 認証
2. 共通レイアウト
3. テーマ切替
4. イベント
5. アーティスト
6. メンバー
7. PROGRESS
8. SIGNAL
9. 変更履歴
10. Security Rules確認

## 3. 共通実装

- CONFIGを一箇所に集約
- HTMLへのインラインJS禁止
- CSS変数
- semantic HTML
- 動的文字列をエスケープ
- ローディング失敗時にも操作不能にしない
- Firestore未接続時はエラーを明示

## 4. レベル計算

signalTotalは保存する。
levelValue / levelLabelは計算または同期する。

基準点:
- v0.01 = 1
- v0.10 = 10
- v0.25 = 30
- v0.50 = 100
- v0.75 = 250
- v1.00 = 500

中間値は線形補間し、1〜100へ丸める。
500を超えてもsignalTotalは増え、表示だけv1.00で上限。

## 5. 出演回数

イベント保存時の単純加減算だけに依存せず、全イベントのartistIdsから再集計可能にする。

アーカイブ済みイベントも出演回数へ含める。

## 6. 画像

- アーティスト: 正方形
- フライヤー: 原寸比率維持
- 保存前プレビュー
- 失敗時は旧画像を維持

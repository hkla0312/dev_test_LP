# 06. Implementation Guide

## 推奨ディレクトリ
```text
/
├ index.html
├ style.css
├ app.js
├ assets/
│  ├ logo/
│  ├ hero/
│  └ artists/
└ README.md
```

## 実装技術
- HTML5
- CSS3
- Vanilla JavaScript
- Firebase Firestore
- Chart.js または Canvasによるドーナツグラフ

## 主要JavaScript処理
- Firebase初期化
- event読み込み
- artists読み込み
- siteSettings読み込み
- reveal監視
- TOPボタン監視
- loader判定

ARTIST:
- 固定1名取得
- ランダム5名抽出
- カード描画
- モーダル表示
- signal取得
- comment取得
- グラフ描画

DANMAKU:
- 固定サンプル配列
- CSS transformで横スクロール
- prefers-reduced-motion対応

LA_OS:
- aria-expanded管理
- 下方展開
- 詳細リンク
- 登録リンク

TOP:
- 一定量スクロールで表示
- `window.scrollTo({ top: 0, behavior: "smooth" })`
- モーダル表示中は非表示

## ローディング
localStorage key:
`laOfficialLoaderShownDate`

- 保存値: `YYYY-MM-DD`
- 同日ならスキップ
- 日付変更後に再表示

## アクセシビリティ
- モーダルに `role="dialog"`
- `aria-modal="true"`
- LA_OSに `aria-expanded`
- TOPボタンに `aria-label`
- キーボード操作対応
- prefers-reduced-motion対応

## パフォーマンス
- アーティスト画像はWebP推奨
- lazy loading
- ヒーロー画像以外は遅延読込
- 画像ボタン不使用
- CSS中心
- Firestore読み込みは必要最小限

# LegendaryApocalypse OS — Project Bible

## 1. Project Identity

**Project Name:** LegendaryApocalypse OS  
**Short Name:** LA_OS  
**Core Concept:** ライブを「観る」から、「参加し、記録し、育てる」体験へ変えるWebプラットフォーム。

LA_OSは単なるイベント告知サイトではなく、ライブ体験を継続させるためのObservation Terminalである。

## 2. Vision

> ライブの熱狂が、未来を育てる。

来場者の想い、Signal、コメント、アーカイブ解禁、参加履歴が蓄積され、ACT DATAとMember Terminalに反映される。

## 3. Product Philosophy

- ライブ後も体験が終わらない。
- 応援は消費ではなく、観測記録として蓄積される。
- お金の多寡ではなく、参加行動に価値を置く。
- ゲーム化しすぎず、静かに育つ体験を目指す。
- 世界観は説明しすぎず、余白を残す。

## 4. Main Products

1. **LP** — 入口。イベント情報、ACT DATA、SHARE POST導線を表示。
2. **Admin Terminal** — 運営管理。イベント、ACT、Signal、Archive、Member権限を管理。
3. **Member Terminal** — 会員ページ。Observation Chamber、Signal履歴、Archive、Next LIVEを表示。
4. **SEND SIGNAL** — ACTへSignalを送る体験。
5. **LIVE DANMAKU VIEW** — 会場ディスプレイ向けコメント表示。
6. **ARCHIVE DATA** — Adminで解禁された会員のみ閲覧できる記録。

## 5. Core Terms

| Term | Meaning |
|---|---|
| ACT DATA | 出演アーティストの活動データ。プロフィールではなく、Signalと反応で育つ記録。 |
| Signal | 応援・コメント・リアクションの単位。ACTを育て、Memberの観測記録にもなる。 |
| Observer Rank | ACT DATA側の成長指標。ACTがどれだけ観測・応援されているかを示す。 |
| Member Rank | 会員側の内部成長段階。最終的にObserverへ到達する余地を持つ。 |
| Observation Chamber | Member Terminalの中心。培養槽内のUnknown Entityが静かに存在する。 |
| Your Signal | 自分が過去に送ったSignalをランダムに振り返る領域。 |
| Additional Signal | Rank Up時に付与されるボーナスSignal。経験値は得られない。 |
| ARCHIVE DATA | 過去公演・限定映像のアーカイブ。Adminで個別解禁。 |

## 6. Scope Freeze Rules

- Product単位で仕様を凍結してから実装する。
- 実装中のProductには新機能を追加しない。
- 新しいアイデアはBacklogへ保存する。
- docsが唯一の正本（Single Source of Truth）。

## 7. Development Roles

### ChatGPT / PM Room
- Project Bible
- UI/UX設計
- 世界観設計
- 仕様策定
- Sprint管理
- Developer Pack作成

### Codex / GitHub
- 実装
- リファクタリング
- Firebase接続
- テスト
- Commit

## 8. Current Development State

- v0.2系：LP + Admin Beta完了
- v0.3系：Member Terminal Alpha開始
- 次フェーズ：SEND SIGNAL → LIVE DANMAKU → Archive → Firebase統合

# UI/UX Bible

## Design Language

**Terminal Design Language (TDL)**  
Dark, quiet, observational, minimal. Neon is used as status feedback, not decoration.

## Core Visual Principles

1. **Quiet Sci-Fi** — 派手なサイバーではなく、研究施設の観測端末。
2. **Mobile First for Member** — Member Terminalはスマホアプリのような体験を優先。
3. **Explain only when needed** — HOW TOで説明し、通常画面はシンプルに。
4. **Animation is Meaning** — 発光・揺れ・ロードバーは状態変化を示す。
5. **No clutter** — 不要な通知、ギャラリー、シークレットログは入れない。

## Color Tokens

| Token | Use |
|---|---|
| Terminal Cyan | Main accent, active UI |
| Terminal Green | Online / success |
| Locked Red | Locked state |
| Amber / Gold | Rank up / Observer special state |
| Deep Black | Main background |
| Glass Navy | Panels |

## Component Style

- Cards: thin border, subtle glow, enough padding.
- Buttons: clear label, 44–52px height on mobile.
- Modal: dark overlay, high contrast, close button top-right.
- Progress: segmented bar preferred over exact number when possible.

## Member Mobile Layout

Priority order:
1. Observation Chamber
2. Member Rank / Today's Signal / Additional Signal / Signal count
3. Next LIVE
4. Your Signal
5. SEND SIGNAL / Archive / Settings
6. Update Log

## Accessibility

- HOW TO button at top.
- Explanation should use plain Japanese, not only lore terms.
- Admin UI prioritizes clarity over worldbuilding.
- Text contrast must remain high.

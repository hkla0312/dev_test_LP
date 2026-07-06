# Game Balance / Progress Design

## Principle

Do not reward money amount. Reward participation actions.

## Internal EXP Values

| Action | Internal EXP |
|---|---:|
| Daily Login | +1 |
| Signal send within daily progress limit | +1 |
| Live attendance | +5 |
| Archive unlock | +5 |
| Merch purchase / booth action | +5 |
| Admin special grant | manual |

## User-facing Rule

EXP is hidden from user UI.

Use:
- Observation Progress
- Member Rank
- Additional Signal

Do not use:
- EXP label
- exact EXP points

## Rank Up

- Early ranks should be easy.
- Rank Up grants Additional Signal +3.
- Additional Signal grants no progress.

## Suggested Rank Curve

| Rank | Required cumulative internal EXP |
|---:|---:|
| 1 | 0 |
| 2 | 5 |
| 3 | 15 |
| 4 | 30 |
| 5 | 50 |
| 6 | 75 |

This curve can be tuned after real usage data.

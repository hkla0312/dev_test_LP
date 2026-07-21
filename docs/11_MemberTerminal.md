# Member Terminal Specification

## Purpose

Member Terminal is the member home. It should feel like a place to return to, not a settings page.

## Core Layout — Mobile First

1. Observation Chamber
2. Member Rank / Progress / Signal count
3. Next LIVE
4. Your Signal
5. SEND SIGNAL / Archive / Settings
6. Update Log

## Update Log

- Keep this area lightweight and sprint-focused.
- Use it for short release notes, not a notification center.
- Update copy in place as the docs pack evolves.

## Observation Chamber

- Pixel-art tank
- Unknown Entity inside culture fluid
- Subtle CSS animation only
- Entity slowly floats/glows
- Bubble movement minimal
- No complex animation / Canvas / WebGL required

### Meaning

It is simply there. It may gain meaning later.

## Member Rank

- Show rank number.
- Do not show EXP.
- Observation Progress is shown as segmented bar.

## Daily Login

- Once per day
- Internal +1
- Small toast: Daily Observation recorded
- Chamber subtly reacts

## Today's Signal

- 5 / 5 indicates daily progress-gaining Signal limit.

## Signal

- 10 / 10 indicates event Signal send limit.

## Additional Signal

- Shown as stars.
- Granted +3 on Rank Up.
- Does not grant progress.

## Your Signal

- Shows one past Signal randomly.
- Reload button changes displayed Signal.
- Includes live participation history together.

## Archive Data

- Locked by default.
- Admin unlock removes LOCKED state.
- Unlocked archive slides out to reveal embedded video.

## Settings

- Sound on/off only.
- Use speaker/music icon with ON/OFF indication.

## Removed / Not included

- Notification panel
- Gallery
- Secret logs
- Quick Signal
- Live Danmaku on/off

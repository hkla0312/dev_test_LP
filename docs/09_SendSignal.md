# SEND SIGNAL Specification

## Purpose

SEND SIGNAL is the core action where a Member sends a short message and reaction to an ACT.

## Input

- Target ACT
- Reaction
- Message max 30 characters

## Limits

- Signal send limit: 10 per event per member
- Observation Progress gain: first 5 Signal submissions per day
- Additional Signal can be used beyond standard allowance
- Additional Signal grants no progress

## Reward Logic

### Standard Signal within daily progress limit
- ACT Signal +1
- Member internal exp +1

### Standard Signal after daily progress limit
- ACT Signal +1
- Member internal exp +0

### Additional Signal
- ACT Signal +1
- Member internal exp +0
- additional_signal -1

## UI Labels

- Today's Signal: 5 / 5
- Signal: 8 / 10
- Additional Signal: ★★★

Do not show EXP to the user.

## Send Animation

1. SEND SIGNAL button press
2. Loading bar
3. SIGNAL RECEIVED
4. Target ACT name displayed
5. Observation Chamber reacts subtly

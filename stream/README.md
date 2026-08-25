# Out Of Pocket — live stream overlay kit

Turns a click on **Find Out** into an on-air alert, and keeps a running
scoreboard of how delusional the night's guests have been.

Nothing here talks to the internet. The quiz page posts results to a small
server on `127.0.0.1`, and the overlays — ordinary browser sources — read
them back. No accounts, no third-party alert service, no data leaving the
machine.

---

## Run it

```bash
node stream/relay.js
```

Or double-click `stream/start-stream-kit.cmd`, which does the same thing and
opens the control panel for you.

Then open the quiz with stream mode armed:

```
https://outofpocket.tv/?stream=1
```

That flag sticks in `localStorage`, so later reloads stay armed. Turn it off
with `?stream=0`. Until it's armed the bridge script is never even
downloaded, so ordinary visitors are unaffected.

The little dot in the bottom-left of the quiz page is your health light:
**green** = the relay is listening, **red** = it isn't.

---

## The pieces

| URL | What it is | Source size |
|---|---|---|
| `http://127.0.0.1:4700/` | Control panel — keep on your second monitor | not captured |
| `http://127.0.0.1:4700/alert.html` | Rarity alert, horizontal | 1920 × 1080 |
| `http://127.0.0.1:4700/alert.html?o=v` | Rarity alert, vertical | 1080 × 1920 |
| `http://127.0.0.1:4700/ticker.html` | Delusion meter, horizontal | 1010 × 300 |
| `http://127.0.0.1:4700/ticker.html?o=v` | Delusion meter, vertical | 660 × 400 |
| `http://127.0.0.1:4700/theme.html?scene=ometv` | Scene theme, OmeTV | 1920 × 1080 |
| `http://127.0.0.1:4700/theme.html?scene=monkey` | Scene theme, Monkey | 1920 × 1080 |
| `http://127.0.0.1:4700/theme.html?scene=toguest` | Scene theme, TO GUEST | 1920 × 1080 |
| `http://127.0.0.1:4700/theme.html?scene=guest` | Scene theme, Guest canvas | 960 × 720 |

The theme sources go at the **bottom** of each scene's source list — they
are the backdrop the video sits on. Unlike the alert and the meter they
never listen for a result; they are static dressing for the parts of the
canvas no feed reaches. Brand art is served from `/assets/`.

### Query parameters

| Param | Applies to | Effect |
|---|---|---|
| `?o=v` | both | Vertical (9:16) layout |
| `?demo=1`…`?demo=5` | alert | Parks a sample alert of that tier on screen so you can position the source. `?demo=1` on the ticker fills it with sample numbers. |
| `?y=20` | alert | Pin the card 20% down the frame instead of centring it |
| `?hold=9000` | alert | How long an alert stays up, in ms (default 7000; tiers 4–5 get +2500 automatically) |
| `?mute=1` | alert | Silence the sound cues |
| `?title=...` | ticker | Rename the panel header |

---

## Sound

Every cue is synthesised in the browser — nothing to license, nothing to
lose track of, and no silent overlay because a file path broke. They
escalate: bright and short at "Local Neighborhood", a full alarm at
"Lost in the Matrix".

To use your own instead, drop a file at `stream/sounds/tier5.mp3`
(`.ogg` and `.wav` also work, tiers 1–5) and it takes over for that tier
automatically. No config.

In OBS, tick **Control audio via OBS** on the alert browser source, or the
sound plays on your desktop but never reaches the stream.

---

## Brackets

The site's five rarity tiers are grouped into three brackets. To re-cut
them, edit `BRACKET_OF` at the top of `relay.js` — every overlay reads the
grouping off the server, so an alert can never disagree with the
scoreboard.

| Tier | Site label | Bracket |
|---|---|---|
| 1/5 | Local Neighborhood (60%+) | REALISTIC |
| 2/5 | Next Town Over (30–60%) | REALISTIC |
| 3/5 | Across the Country (10–30%) | BORDERLINE |
| 4/5 | On the Moon (2.5–10%) | DELUSIONAL |
| 5/5 | Lost in the Matrix (≤2.5%) | DELUSIONAL |

### Who's a girl and who's a guy

Inferred from who they're searching *for*: someone describing their ideal
man is counted as one of the girls. That's right most of the time and wrong
some of the time — **Was a girl / Was a guy** on the control panel fixes
the last entry, and the scoreboard updates live.

---

## Control panel

- **Test an alert** — fires any tier without adding it to the tally.
- **Replay alert** — re-fires the last real one, for when it landed while
  you were on the wrong scene.
- **Undo last** — removes the last answer from the counts.
- **Was a girl / Was a guy** — re-tags the last answer.
- **Reset session** — back to zero. Asks first.

The tally survives restarts (it's kept in `stream/session.json`, which is
gitignored). Reset it deliberately at the start of a stream rather than
relying on it being empty.

---

## How the wiring works

```
Find Out click
  └─ script.js dispatches a `quiz:result` CustomEvent
       └─ stream/bridge.js POSTs it to 127.0.0.1:4700/emit
            └─ relay.js tallies it, broadcasts over SSE
                 ├─ alert.html   plays the tier animation + sound
                 ├─ ticker.html  updates the scoreboard
                 └─ control.html logs it
```

The event carries everything the overlay needs — percentage, tier, the
criteria list, and which filter did the most damage — so no overlay ever
has to scrape numbers back out of the page's markup.

`?stream=1` is required for the bridge to load at all. Without it the quiz
page behaves exactly as it does for any visitor.

---

## When something's wrong

**Nothing fires when I click Find Out.** Check the dot on the quiz page. If
it's red, the relay isn't running — start it. If there's no dot at all,
stream mode isn't armed; add `?stream=1`.

**The overlay is blank in OBS.** That's correct until an alert fires — it's
a transparent page. Load `?demo=5` to see it, then remove that once
positioned.

**An alert fired but I was on another scene.** Hit **Replay alert**.

**The alert shows but there's no sound.** Tick *Control audio via OBS* on
the browser source. Check the source isn't muted in the Audio Mixer.

**Port 4700 is already in use.** The relay is probably already running.
Otherwise: `OOP_STREAM_PORT=4701 node stream/relay.js`, and load the quiz
with `?stream=1&relay=http://127.0.0.1:4701`.

**Counts are wrong after a mis-click.** Undo last. It pops the entry and
recomputes every total from scratch, so nothing can drift.

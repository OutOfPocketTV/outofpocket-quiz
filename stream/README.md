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
| `http://127.0.0.1:4700/donation.html` | Donation alert | 1920 × 1080 |
| `http://127.0.0.1:4700/donation.html?demo=1` | Same, previews both tiers | 1920 × 1080 |
| `http://127.0.0.1:4700/quizcard.html` | On-air quiz question | size of its slot |
| `http://127.0.0.1:4700/countdown.html` | Starting Soon clock | 1920 × 1080 |
| `http://127.0.0.1:4700/console.html` | Quiz console — you drive it, never captured | not captured |
| `http://127.0.0.1:4700/diag.html` | What OBS's Chromium can do | any |

### Running the quiz on air

Two halves. `console.html` is the operator's: one question a slide, big
targets, `1`–`9` to pick, `Enter` to advance, `Backspace` to go back. It
lives in its own window on the second monitor and is never captured. Launch
it chromeless so it behaves like an app rather than a browser tab:

```
chrome --app=http://127.0.0.1:4700/console.html --window-size=560,860
```

`quizcard.html` is the audience's, and it is an ordinary browser source
rather than a capture of that window — so it renders pixel-perfect at
whatever size it is given instead of being scaled off a window that has to
stay visible and unobscured. It reads its own box: short and wide lays out
as a bar, taller stacks into a panel. Between guests it draws nothing at
all, so on the guest canvas it can sit straight on top of the theme's
call-to-action bar and swap with it — question while one is running, the
pitch the rest of the time, with no scene switching to remember.

The console does not do its own arithmetic. It loads the site's real
`stats.js` and `quiz-core.js` over `/site/`, so a guest is scored by the
same code outofpocket.tv runs and emits the identical payload the site's
`quiz:result` hook sends. Nothing downstream can tell the two apart, and a
threshold changed on the site reaches the show the same night.

The theme sources go at the **bottom** of each scene's source list — they
are the backdrop the video sits on. They never listen for a *result*; the
one live thing they track is the quiz itself, and only on scenes that draw
a pitch card: that card and `quizcard.html` occupy the same rectangle, so
the theme fades its own out while a question is up and back in afterwards.
Otherwise they are static dressing for the parts of the canvas no feed
reaches. Brand art is served from `/assets/`.

### The Starting Soon countdown

A clock on the Starting Soon plate that, when it reaches zero, cuts OBS to
the intro video and rolls it. Driven from the **Starting Soon countdown**
card on the control panel: four presets, a minutes/seconds box, `+1 min`,
`−1 min`, pause and stop, and a *Play the intro now* button that skips the
wait. All of it is one route, `POST /countdown`, so a hotkey or a curl can
do anything the panel can:

```
curl -X POST http://127.0.0.1:4700/countdown -H "content-type: application/json" -d "{\"action\":\"start\",\"seconds\":600}"
```

`action` is `start` (with `seconds`), `pause`, `resume`, `add` (with a
positive or negative `seconds`), `stop`, or `fire`.

**The relay owns the deadline, not the overlay.** A browser source is the
wrong thing to trust with it: it can be reloaded, it can be added to the
scene half way through the wait, and it is not running at all while OBS
sits on another scene. So the overlay is handed an *end time* and draws the
difference — a source that connects with four minutes left comes up reading
four minutes — while the relay alone decides that zero has happened. It
survives a relay restart, and a deadline that expired while the relay was
down is cleared rather than fired: coming back up hours later and
immediately cutting a live stream to the intro video is the one thing this
must never do.

Which scene it cuts to, which media source it rolls, and where to go when
the clip finishes are all set from the two dropdowns on the card and stored
in `settings.json`. "After it" empty means stay put.

#### The OBS side

| Thing | Name | Notes |
|---|---|---|
| Scene | `Intro Video` | The clip, fit to the canvas |
| Media source | `Intro Clip` | `restart_on_activate` on, `close_when_inactive` off |
| Browser source | `Starting Soon Countdown` | On the Starting Soon scene, above `Media` |

`restart_on_activate` is what actually plays the video — OBS does it
itself the moment the scene goes live, with no message that can go missing.
The relay checks a couple of seconds later that it really is rolling and
heals it if not, which is the same trick the tier-5 reel uses. Leaving
`close_when_inactive` off keeps the file open so it starts instantly.

The cut uses whatever transition OBS has set, which is the Matrix stinger,
and that is on purpose: it floods to black, swaps at 683ms, and dissolves
the code away over the first second of the intro. The intro opens on quiet
street ambience rather than a hook, so nothing is lost behind it. For a
plain dissolve instead, give the `Intro Video` scene a transition override.

**The clip is transcoded, and has to be.** The original
`Intro Live Stream Video.mov` is 4K HEVC 10-bit 4:4:4, which no
GPU here can hardware-decode; software-decoding that while OBS encodes a
live stream is asking for dropped frames on the one clip that has to be
perfect. `Intro Live Stream Video 1080p.mp4` beside it is 1080p H.264 at
CRF 16 and plays for free. The original is untouched.

### Query parameters

| Param | Applies to | Effect |
|---|---|---|
| `?o=v` | both | Vertical (9:16) layout |
| `?demo=1`…`?demo=5` | alert | Parks a sample alert of that tier on screen so you can position the source. `?demo=1` on the ticker fills it with sample numbers. |
| `?y=20` | alert | Pin the card 20% down the frame instead of centring it |
| `?hold=9000` | alert | How long an alert stays up, in ms (default 7000; tiers 4–5 get +2500 automatically) |
| `?mute=1` | alert | Silence the sound cues |
| `?title=...` | ticker | Rename the panel header |
| `?pos=center` | countdown | `center` (default), `bottom-left`, `bottom-right`, `top-left`, `top-right` |
| `?scale=1.2` | countdown | Size multiplier, 0.4 to 2.5 |
| `?label=BACK IN` | countdown | Replaces "STARTING IN"; `?label=` with nothing drops the line |
| `?glitch=0` · `?glitch=2` | countdown | Clean clock, or twice as many glitch bursts |
| `?rain=0` `?scrim=0` `?bar=0` | countdown | Drop the falling code, the soft darkening, or the depleting rule |

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

### Chat and the bottom-bar marquee

Two more inlets feed `theme.html`. Neither knows or cares where the data
came from — anything that can POST JSON can drive them, which is what keeps
the per-platform mess out of the relay.

```bash
curl -X POST http://127.0.0.1:4700/chat -H 'content-type: application/json' \
  -d '{"platform":"twitch","user":"someone","text":"hello","colour":"#6bc8ff"}'
```

```bash
curl -X POST http://127.0.0.1:4700/hype -H 'content-type: application/json' \
  -d '{"donation":{"from":"Renee K.","amount":"$20","note":"do the height one again"},
       "topFan":"MiloSanchez","viewers":2417}'
```

`platform` is a free string, not an enum: a fifth site shouldn't mean
editing the relay. `colour` is optional — without it the overlay hashes the
name, so the same person keeps the same colour all night.

**Top chatter is counted here, not asked of any platform.** It's the one
number every site would answer differently, and the relay already sees
every message. `/reset` clears chat and the marquee along with the tally,
because a reset means a fresh show rather than just a fresh scoreboard.

Chat text is rendered with `textContent`, never `innerHTML` — it is typed by
strangers and goes straight onto a live broadcast.

### Where chat and donations come from

**Social Stream Ninja** feeds all four platforms through one inlet. Point
its webhook at `http://127.0.0.1:4700/ssn` and the relay takes SSN's own
field names as-is — no adapter process to babysit.

The same SSN object carries TikTok gifts, YouTube Superchats and Twitch
bits in `hasDonation`. When it's present the message becomes **both** a
donation and a chat line, because dropping the text would lose whatever
they typed along with the gift.

**StreamElements** covers tips from outside the platforms. Paste
`streamelements-widget.js` into a SE Custom Widget and add that overlay to
OBS. It deliberately forwards only `tip-latest` — the native gifts already
arrive via SSN, and forwarding both would double-count them against the
top-donor total.

SE's feed is socket.io, so having the relay connect to it directly would
mean adding a dependency to a process whose whole point is not having any.
A custom widget is already inside that feed and a browser source can reach
loopback fine, so the socket stays on StreamElements' side.

The widget runs inside a `sandbox="allow-scripts"` blob iframe, so it has
an opaque origin -- which is exactly the case the relay's
`Access-Control-Allow-Private-Network` header covers. Read straight off the
DOM, not assumed, and tips have been seen arriving at the relay through it.

**Test it before you rely on it.** Open the overlay in the SE editor, hit
Emulate -> Tip event -> $10 with OBS running, and watch the relay window
for the donation line. Fire it once and check the count went up by exactly
one: the emulate menu is easy to trigger twice by accident, which looks
identical to a double-forward and is not one.

Known-shaky: emulated tips did not arrive every time during setup, with no
explanation found. Real tips have not been through it yet, because PayPal
was not connected at the time. Do the check above at the top of the first
show that has tipping switched on.

### Donations, alerts and the $10 line

| Value | On screen | Read aloud |
|---|---|---|
| under `$10` | yes, violet card | no |
| `$10` and up | yes, gold card | yes |

Change the line with `OOP_TTS_MIN=25 node stream/relay.js`.

**The speaking happens in the relay, not the browser.** OBS's Chromium
reports the `speechSynthesis` API with **zero installed voices**, so
`speak()` there returns without error and produces silence — the worst way
for an alert to fail. Windows' own SAPI has voices, so the relay speaks
through it and the audio reaches the stream via Desktop Audio. Point a
browser source at `/diag.html` to see this for yourself.

Donor names and notes are stranger-supplied text going to a shell, so they
are written to PowerShell's stdin and never interpolated into the command.

Platform currencies are converted so one donor can be ranked against
another: 100 Twitch bits ≈ $1, TikTok coins ≈ $0.0105 each. These are buy
prices, they move, and they're overridable — `OOP_RATE_COINS`,
`OOP_RATE_BITS`, `OOP_RATE_DIAMONDS`. An adapter that already knows the
real value should send `usd` and skip the guessing entirely.

**Top donor is a running total across every source**, not the biggest
single tip: four $5 gifts outrank one $15.

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

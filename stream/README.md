# Out Of Pocket — live stream overlay kit

Turns a guest's quiz answers into an on-air alert, and keeps a running
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

Then open the quiz console. This is what you drive on air:

```
chrome --app=http://127.0.0.1:4700/console.html --window-size=560,860
```

See *Running the quiz on air* below. The console scores guests itself using
the site's own `stats.js` and `quiz-core.js`, so it needs nothing else from
outofpocket.tv — and the site's paywall does not touch it.

### The website route is paywalled

There is an older second route: arming stream mode on the website itself,
which loads `bridge.js` and forwards a **Find Out** click to the relay.

```
https://outofpocket.tv/?stream=1
```

That flag sticks in `localStorage`, so later reloads stay armed. Turn it off
with `?stream=0`. Until it's armed the bridge script is never even
downloaded, so ordinary visitors are unaffected. The little dot in the
bottom-left of the quiz page is your health light: **green** = the relay is
listening, **red** = it isn't.

**This route no longer yields a result on its own.** The site paywalls every
result, so `quiz:result` never fires in a browser that hasn't purchased, and
a guest sent there meets the unlock prompt instead of a score. Use the
console. If you ever do want someone taking it on the site itself, buy it
once in that one browser rather than adding a URL flag that skips the
paywall — a flag documented here is a free bypass for anyone who reads it.

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
console.html scores the guest (using the site's stats.js + quiz-core.js)
  └─ POSTs the result to 127.0.0.1:4700/emit
       └─ relay.js tallies it, broadcasts over SSE
            ├─ alert.html   plays the tier animation + sound
            ├─ ticker.html  updates the scoreboard
            └─ control.html logs it
```

The paywalled website route reaches the same `/emit`, on the rare occasion
it is used at all:

```
Find Out click  (in a browser that has purchased -- otherwise nothing fires)
  └─ script.js dispatches a `quiz:result` CustomEvent
       └─ stream/bridge.js POSTs it to 127.0.0.1:4700/emit
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
for the donation line.

Expect **two** donations from one emulate, with different random names and
amounts, milliseconds apart. That is the emulate menu's *Preview LIVE on
stream* checkbox firing an editor-preview event and a live-overlay event
independently, each randomised -- not the widget forwarding twice, which
would give two identical payloads. Uncheck it to see one. A real tip is one
event and arrives once.

Emulated tips also did not arrive on every attempt during setup, with no
explanation found, and no real tip has been through it yet because PayPal
was not connected at the time. Worth one check at the top of the first show
with tipping switched on.

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
page behaves exactly as it does for any visitor. Arming it is no longer
sufficient on its own, though: the site paywalls results, so an unpurchased
browser never fires the event the bridge is waiting for.

### Letting the guest hear the tip

The person on the other end of ome.tv / umingle hears **none** of the audio
above. The OBS virtual camera carries video only — OBS has never shipped a
virtual audio device — so the only thing that reaches them is whatever the
browser has picked as its **microphone**, and the tip is spoken to the
default *playback* device. Nothing in OBS can bridge those two.

So the relay speaks the same sentence a second time, into a named playback
device that is bridged into that microphone.

| Setting | Meaning |
|---|---|
| `guestDevice` in `settings.json` | Substring of a Windows playback device name. Empty = off. |
| `OOP_TTS_GUEST_DEVICE` | Same thing, from the environment. |

```bash
curl http://127.0.0.1:4700/tts-devices
```

lists every device SAPI can reach and says whether `guestDevice` matches one.
**Worth running before trusting it**, because the failure mode is silent: the
real names carry vendor suffixes (`CABLE Input (VB-Audio Virtual Cable)`), a
name matching nothing throws no error anywhere, and the only symptom is a
guest who hears nothing — indistinguishable from the cable being wrong, the
browser on the wrong microphone, or the tip never having been spoken.

**Why SpVoice and not System.Speech.** `System.Speech.Synthesis` can only
ever reach the default device. SAPI's `SpVoice` is the one with an
`AudioOutput` property, so the guest half uses it. The stream half is
deliberately left on `System.Speech` exactly as it was — the voice table,
pitch and rate are tuned, and rewriting a working path to add a second one
is how you lose the first.

The guest voice is started asynchronously (`Speak` flag `1`, plus `8` for
SSML) and joined at the end, so the two overlap. Serial, the guest would
hear the tip only after the stream had finished with it. Measured: a 4.75 s
line takes 5 s wall-clock through both voices, not 9.5 s.

**Every failure in the guest block is swallowed on purpose**, and the wait is
bounded at 20 s. A missing cable, a renamed device or a wedged one must not
cost the *stream* its tip alert — that is the half that was paid for.
Verified by rendering the stream's voice to a WAV with `guestDevice` set to a
device that does not exist: `guest voice acquired: False`, script still ran
to the end, WAV still `-20.3 dB` mean. Silence would read about `-91 dB`.

#### The Windows side, which is not done by any of this

The relay only puts the voice into a device. Getting that device *and* the
mic into the chat site is Windows plumbing:

1. Install **VB-CABLE** (VB-Audio, free). It adds `CABLE Input` (playback)
   and `CABLE Output` (recording) and does *not* become the default device.
2. `settings.json` → `"guestDevice": "CABLE Input"`, then check
   `/tts-devices` says `ok`.
3. Sound → Recording → the real mic → Listen → **Listen to this device**,
   playback through `CABLE Input`. This is what puts Tom's voice in alongside
   the tip; without it the guest hears the robot and nothing else.
4. In the chat site, set the microphone to **CABLE Output**.

Untested until a real call: Chrome's noise suppression may mangle synthetic
speech arriving on a mic bus, and "Listen to this device" adds latency to
Tom's own voice. Both are browser-side and neither can be proved from here.

### The chat bot and `/bot`

The bot that promotes tipping is **not** part of this kit, on purpose. Its
one job is to post the same line every ten minutes for four hours without
being watched, and the two things already on this machine are the wrong
shape for that:

* **Social Stream Ninja can send outbound** — it has `timedMessage`,
  `chatCommand` and `botReply` in its settings, and a `sendChat` API. But it
  posts by driving a logged-in chat page, so it needs SSN running with each
  platform's chat window open and not minimised. SSN is already the thing
  Tom has to remember to open by hand; making it the bot too means one
  forgotten launch takes out chat *and* the tip promo.
* **The relay is loopback-only.** A cloud bot cannot reach `127.0.0.1`, so
  it can never pull these numbers live.

So the bot is a cloud service (Fossabot covers Twitch, YouTube and Kick),
and it holds a *copy* of the copy. That copy is the thing that rots.

`GET /bot` prints the message text, generated from `settings.ttsMin`:

```bash
curl http://127.0.0.1:4700/bot
```

**Why it is generated and not written down.** The read-aloud threshold is a
setting the control panel can change mid-show. A promo pasted into Fossabot
with `$10` baked into it becomes a lie the moment that number moves, and
nothing would ever report it — the bot would go on confidently quoting a
threshold the alerts no longer use, and the first person to find out would
be a viewer who tipped $10 expecting to be heard. Changing `ttsMin` means
re-pasting from `/bot`; that is the whole reason the route exists.

Each line is measured against **200 characters, which is YouTube's
live-chat limit** and the binding one — Twitch and Kick both allow 500. A
line that fits YouTube fits everywhere, so it is the only cap checked.

The tip link defaults to `outofpocket.tv/tip`, which is a `vercel.json`
redirect to the StreamElements page rather than the real URL. It is 33
characters shorter, and unlike `streamelements.com/outofpocket_tv-7a6c3/tip`
it can be said out loud on air. Override it with `OOP_TIP_URL`. The redirect
is deliberately **temporary (307), not permanent** — a 308 gets cached in
viewers' browsers forever, which would be painful the day the tip provider
changes.


---

## When something's wrong

**Nothing fires from the console.** The relay isn't running, or it's on
another port. Check the control panel at `http://127.0.0.1:4700/`.

**Nothing fires when I click Find Out on the website.** That's the paywalled
route — the show runs on the console instead. If you did mean to be there:
check the dot on the quiz page (red = the relay isn't running, no dot =
stream mode isn't armed, add `?stream=1`), and check that browser has
actually purchased, since an unpurchased one shows the unlock prompt in
place of a result.

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

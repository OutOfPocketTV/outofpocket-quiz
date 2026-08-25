# OBS Studio rebuild spec

Everything needed to recreate the Streamlabs rig in OBS Studio, with every
value measured rather than guessed. Written 2026-08-24, after the Streamlabs
build — the vertical layout has to be rebuilt regardless of migration path,
because Streamlabs Dual Output and Aitum Vertical are different systems that
do not share data.

## Install first

| What | Why |
|---|---|
| OBS Studio (obsproject.com) | The base app |
| **Aitum Stream Suite** | One plugin containing both the 9:16 canvas and multi-destination streaming. Replaces Streamlabs Dual Output *and* Streamlabs Ultra. |

> The older standalone **Aitum Vertical** and **Aitum Multistream** plugins are
> deprecated — both were folded into Stream Suite and no longer receive
> updates. Install the suite, not the two separate plugins.

Then **Tools → WebSocket Server Settings → Enable**, port `4455`, no password.
That's what lets the 148 OBS tools drive it.

---

## Video settings

**Settings → Video**

| Setting | Value |
|---|---|
| Base (Canvas) | `1920 × 1080` |
| Output (Scaled) | `1920 × 1080` |
| Downscale filter | Lanczos |
| FPS | `60` |

**Aitum Vertical** canvas: `1080 × 1920`, 60fps.

## Output settings

**Settings → Output → Advanced → Streaming**

| Setting | Value |
|---|---|
| Encoder | NVIDIA NVENC H.264 |
| Rate control | CBR |
| Keyframe interval | **`2` s** (Streamlabs had this on auto — set it explicitly) |
| Preset | P5 / Slow |
| Tuning | High Quality |
| Multipass | Two passes (quarter res) |
| Profile | high |
| B-frames | `2` |
| Psycho Visual Tuning | On |

**Settings → Audio:** sample rate **`48 kHz`** (Streamlabs was on 44.1), 160 kbps.

**Settings → Advanced → Stream Delay:** enable, **`10–20` s**. This is the
window that lets you hit the panic cover before a guest's webcam reaches four
platforms at once.

Per-destination bitrate in Aitum Multistream:

| Platform | Bitrate | Notes |
|---|---|---|
| Twitch | `6000` | Hard cap for every account. No 4K, ever. |
| Kick | `8000` | |
| YouTube | `9000` | |
| TikTok | `6000` | Vertical canvas |

Roughly 29 Mbps of sustained upload. Test your line first; under ~35 Mbps,
drop all three horizontal outputs to 6000.

---

## Sources

Shared across both scenes — create once, add to each scene by reference.

### canon 80D — Video Capture Device
- Device: `EOS Webcam Utility Pro`
- Resolution: `1280 × 720`
- **Deactivate when not showing: OFF**

> Note: the Canon can only be held by one application at a time. While Chrome
> has it for a call, OBS shows a disconnected placeholder. See TO GUEST below —
> the virtual camera inverts this, and is required, not optional.

### Guest OmeTV — Window Capture
- Window: the Chrome window running **ome.tv**
- **Window Match Priority: `Window title must match`** — not the default.
  With the looser setting it silently grabs whichever Chrome window it finds,
  including the quiz window, and renders black.
- Capture Cursor: **OFF**
- Filter → **Crop/Pad**: Left `20`, Top `87`, Right `967`, Bottom `245`
  → yields the 933 × 700 guest panel

### Guest Monkey — Window Capture
- Window: the Chrome window running **monkey.app**
- Window Match Priority: `Window title must match`
- Capture Cursor: **OFF**
- Filter → **Crop/Pad**: Left `822`, Top `258`, Right `579`, Bottom `91`
  → yields the 519 × 683 guest panel

> Measured from a **live call**. Monkey's disconnected layout puts the
> placeholder somewhere else entirely — cropping against it lands ~145px off.

### Rarity Alert — Browser Source
- URL: `http://127.0.0.1:4700/alert.html`
- Size: `1920 × 1080`
- **Control audio via OBS: ON** — without it the alert sound plays on your
  desktop and never reaches the stream
- Shutdown source when not visible: **OFF**
- Refresh browser when scene becomes active: **OFF**

### Delusion Meter — Browser Source
- URL: `http://127.0.0.1:4700/ticker.html`
- Size: `1010 × 300`
- Shutdown when not visible: **OFF** (or the running tally resets on every
  scene switch)
- Refresh when scene becomes active: **OFF**

### PANIC COVER / PANIC COVER V — Image
- `E:\Outta Pocket\Quiz App Local Session\stream\assets\panic-cover-43.png` (4:3)
- `E:\Outta Pocket\Quiz App Local Session\stream\assets\panic-cover-34.png` (3:4)

### Audio
- Desktop Audio — default device
- Microphone — pin explicitly to **Komplete Audio 6 MK2**, not "Default"

---

## Scene: OmeTV

Guest feed is 4:3, so vertical splits cleanly 50/50.

**Horizontal — 1920 × 1080**

| Source | Position | Size |
|---|---|---|
| Guest OmeTV | `0, 60` | `1280 × 960` |
| canon 80D | `1280, 60` | `640 × 360` |
| Delusion Meter | `1288, 450` | `624 × 185` |
| Rarity Alert | `0, 0` | `1920 × 1080` |
| PANIC COVER | `0, 60` | `1280 × 960` — hidden |

**Vertical — 1080 × 1920**

| Source | Position | Size |
|---|---|---|
| Guest OmeTV | `-100, 0` | `1279 × 960` |
| canon 80D | `-313, 960` | `1707 × 960` |
| Delusion Meter | `90, 24` | `900 × 267` |
| Rarity Alert | `0, 656` | `1080 × 608` |
| PANIC COVER | `-100, 0` | `1280 × 960` — hidden |

Negative X centres each feed and lets it bleed past the edges, so both bands
fill corner to corner with no bars. A 16:9 camera loses 627px of width to fit
a vertical frame; centring keeps the face in the middle.

## Scene: Monkey

Guest feed is **portrait**, so a 50/50 split would leave bars down both sides.
68/32 instead, both bands full width.

**Horizontal — 1920 × 1080**

| Source | Position | Size |
|---|---|---|
| Guest Monkey | `40, 60` | `727 × 960` |
| canon 80D | `800, 60` | `1060 × 596` |
| Delusion Meter | `800, 700` | `1010 × 300` |
| Rarity Alert | `0, 0` | `1920 × 1080` |
| PANIC COVER V | `40, 60` | `727 × 960` — hidden |

**Vertical — 1080 × 1920**

| Source | Position | Size |
|---|---|---|
| Guest Monkey | `0, -54` | `1080 × 1421` |
| canon 80D | `0, 1312` | `1080 × 608` |
| Delusion Meter | `90, 24` | `900 × 267` |
| Rarity Alert | `0, 1008` | `1080 × 608` |
| PANIC COVER V | `0, -54` | `1080 × 1421` — hidden |

The `-54` trims ~54px off the guest's top and bottom, which also removes the
`monkey.app` watermark and most of the name chip. The camera lands at exactly
`1080 × 608` because 16:9 at 1080 wide is 608 tall — no crop needed.

## Scene: TO GUEST — new, feeds the virtual camera

What the person on the other end sees. **Must not contain any guest capture**,
or they see themselves inside their own screen, forever.

| Source | Purpose |
|---|---|
| canon 80D | Your face — keep it visible, it's also the chat sites' own rule |
| Quiz window capture | Zoomed to the sliders + Find Out button only |
| Rarity Alert | So the guest sees the reveal animation and reacts to it |

Then **Settings → Virtual Camera → Output Type: Scene → `TO GUEST`**, and in
Chrome pick `OBS Virtual Camera` as the camera for ome.tv / monkey.app.

The quiz window must be **620px wide** so the site drops into its mobile
layout. A webcam feed is ~800×600; the desktop layout shrinks to 0.68× and
becomes unreadable, while the mobile layout scales to 1.29× — bigger, not
smaller. Same content, opposite outcome.

---

## Hotkeys

| Key | Action |
|---|---|
| `F9` | Show PANIC COVER (both scenes) |
| `F10` | Hide PANIC COVER (both scenes) |

Bind on the plain function keys. The keyboard's G1–G5 macro keys drop roughly
7 presses in 10 — measured, not guessed — so they are not safe for this.

Once obs-websocket is on, the cover can also be toggled directly through
`set_scene_item_enabled`, which bypasses the keyboard entirely.

---

## Before going live

1. Start the relay: `stream/start-stream-kit.cmd` — leave it open
2. Reset the session on the control panel
3. Open the quiz with `?stream=1`, confirm the dot is green
4. Fire a 5/5 test alert — confirm you **see and hear** it on both canvases
5. Connect one call, confirm the crop still lines up
6. Go live

Each chat site needs **its own Chrome window with a single tab**, so window
titles stay stable and strict title matching keeps working. Don't resize those
windows or toggle the bookmarks bar — the crops are pixel offsets from the
window edge and break silently.

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

### Theme <scene> — Browser Source

Scene dressing: the branded backdrop, the top/bottom bars, the hairline
framing around each video, and the call-to-action card. One source per
scene, because each one is laid out around that scene's particular gaps.

| Source | URL | Size |
|---|---|---|
| Theme OmeTV | `http://127.0.0.1:4700/theme.html?scene=ometv` | `1920 × 1080` |
| Theme Monkey | `http://127.0.0.1:4700/theme.html?scene=monkey` | `1920 × 1080` |
| Theme To Guest | `http://127.0.0.1:4700/theme.html?scene=toguest` | `1920 × 1080` |
| Theme Guest | `http://127.0.0.1:4700/theme.html?scene=guest` | `960 × 720` |

- Position `0, 0`, sized to the full canvas
- **Bottom of the source list in every scene.** It is a backdrop; the video
  is supposed to cover most of it. Anything drawn where a feed sits is
  wasted work, which is why the layout only describes the gaps.
- Shutdown when not visible: **OFF**
- Refresh when scene becomes active: **OFF**

The rects live in `SCENES` at the bottom of `overlays/theme.html`. Move a
source in OBS and the matching entry there has to move with it, or the
framing detaches from the video it is framing.

> This puts the scene's *appearance* on the relay, not just its alerts. If
> `start-stream-kit.cmd` isn't running, the theme is a blank source and the
> scenes fall back to the bare black they had before.

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
| Theme OmeTV | `0, 0` | `1920 × 1080` — bottom of the list |

The theme's card fills the `640 × 385` block left under the Delusion Meter,
and the bars take the 60px strips the feeds don't reach.

**Vertical — 1080 × 1920**

| Source | Bounds | Position | Size |
|---|---|---|---|
| Guest OmeTV | Cover | `0, 0` | `1080 × 960` |
| canon 80D | Cover | `0, 960` | `1080 × 960` |
| Delusion Meter | Stretch | `90, 24` | `900 × 267` |
| Rarity Alert | Stretch | `0, 656` | `1080 × 608` |
| PANIC COVER | Cover | `0, 0` | `1080 × 960` — hidden |

Bounds type **Cover** does the centre-and-bleed that earlier revisions of this
file did by hand with negative X and oversized widths: it fills the band, keeps
aspect, and crops the overflow evenly. Same picture, but the numbers are now
the band itself, so they survive a guest whose capture resolution changes.

Setting these in the UI, go **Bounds type → Height → Width**, in that order.
Set width first and OBS recomputes it from the old bounds and discards what you
typed.

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
| Theme Monkey | `0, 0` | `1920 × 1080` — bottom of the list |

Monkey gets bars and framing but no card: what's left here is thin margins
between two large feeds, and nothing in them is wide enough to hold one
without crowding the video.

**Vertical — 1080 × 1920**

| Source | Bounds | Position | Size |
|---|---|---|---|
| Guest Monkey | Cover | `0, 0` | `1080 × 1312` |
| canon 80D | Cover | `0, 1312` | `1080 × 608` |
| Delusion Meter | Stretch | `90, 24` | `900 × 267` |
| Rarity Alert | Stretch | `0, 1008` | `1080 × 608` |
| PANIC COVER | Cover | `0, 0` | `1080 × 1312` — hidden |

The camera lands at exactly `1080 × 608` because 16:9 at 1080 wide is 608 tall
— no crop needed.

> Cover fits the guest to the band exactly, where the earlier `0, -54` /
> `1080 × 1421` placement deliberately over-scaled to shave ~54px off the
> guest's top and bottom and take the `monkey.app` watermark with it. The
> source-level Crop/Pad filter (`822/258/579/91`) should already remove that
> chrome — but confirm it against a live guest, because Cover will not trim
> anything the filter leaves behind.
>
> This scene holds **PANIC COVER**, not the portrait `PANIC COVER V` that its
> horizontal counterpart uses. Cover crops either one to fit, so both work.

## Scene: TO GUEST — new, feeds the virtual camera

What the person on the other end sees. **Must not contain any guest capture**,
or they see themselves inside their own screen, forever.

| Source | Purpose |
|---|---|
| canon 80D | Your face — keep it visible, it's also the chat sites' own rule |
| Quiz window capture | Zoomed to the sliders + Find Out button only |
| Rarity Alert | So the guest sees the reveal animation and reacts to it |
| Theme To Guest / Theme Guest | Fills the strips either side of the quiz and the column under the camera — bottom of the list |

The quiz is scaled *inside* its box rather than stretched, so it never fills
the width it is given and leaves a strip on either side. Those strips, and
the block under the camera, are what the theme is covering. On the Guest
canvas that block is the one the stranger stares at, so it carries the
call to action rather than decoration.

This trio also lives on its own **Guest** canvas (`960 × 720`), which is what
actually feeds the virtual camera now. On that canvas use Aitum's **Add
Output → Virtual Camera**, named `Guest Virtual Camera`; start it from the
Aitum dock, then in Chrome pick `OBS Virtual Camera` as the camera for
ome.tv / monkey.app.

A dedicated canvas rather than `Settings → Virtual Camera → Output Type:
Scene` is what frees the Canon: Chrome consumes the virtual camera instead of
the camera itself, so OBS keeps sole ownership of it. `960 × 720` because
that is the shape these sites expect from a webcam.

> Windows registers exactly **one** `OBS Virtual Camera` DirectShow device, so
> only one canvas can drive it at a time. Starting a second virtual-camera
> output returns success and then silently stays inactive — so if the guest
> feed is dead, check that the Vertical virtual camera has not taken the
> device first.

The quiz window must be **620px wide** so the site drops into its mobile
layout. A webcam feed is ~800×600; the desktop layout shrinks to 0.68× and
becomes unreadable, while the mobile layout scales to 1.29× — bigger, not
smaller. Same content, opposite outcome.

---

## Hotkeys

| Key | Action |
|---|---|
| `F9` | Show PANIC COVER — all four items, both canvases |
| `F10` | Hide PANIC COVER — all four items, both canvases |

Bind on the plain function keys. The keyboard's G1–G5 macro keys drop roughly
7 presses in 10 — measured, not guessed — so they are not safe for this.

Visibility hotkeys are bound **per scene item**, not per key, so every scene
holding a cover needs its own pair. There are four: `OmeTV` and `Monkey` on
Main, `Scene` and `Monkey` on Vertical. Binding only Main's is the dangerous
half-fix — the panic then covers the horizontal output while the vertical one
carries on streaming the guest. OBS is content to bind one key across all
four; they fire together.

> `set_scene_item_enabled` over obs-websocket is **not** a fallback for this.
> The socket only reaches the Main canvas, so it can cover the horizontal
> output and cannot touch the vertical one. The keyboard is the only thing
> that hits both.

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

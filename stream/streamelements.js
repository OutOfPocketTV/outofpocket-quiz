// Tips straight from StreamElements to the relay, with OBS out of the way.
//
// The old path went: StreamElements -> a custom widget -> an OBS browser
// source -> the relay. That middle step is the problem. The bridge browser
// source lives on ONE scene ("Starting Soon Scene"), so for the whole show
// it is a hidden page. OBS stops drawing hidden browser sources, Chromium
// throttles their timers, and socket.io's heartbeat is a timer -- so the
// connection goes stale and a tip turns up whenever it next recovers,
// instead of when it was sent.
//
// This connects the relay itself, so a tip is on screen in well under a
// second no matter which scene is live, and it keeps working with OBS shut.
//
// It needs no packages. StreamElements runs socket.io 2.x, which is
// engine.io protocol 3, and that is just text frames over a WebSocket --
// something Node has built in now. The framing, in full:
//
//   <- 0{"sid":"...","pingInterval":25000,"pingTimeout":60000}   open
//   <- 40                                                        namespace
//   -> 42["authenticate",{"method":"jwt","token":"..."}]
//   <- 42["authenticated",{...}]     or  42["unauthorized",...]
//   -> 2   every pingInterval                          <- 3      heartbeat
//   <- 42["event",{...}]                                         a real tip
//   <- 42["event:test",{...}]                                    a test tip
//
// Protocol 3 is the one where the CLIENT sends the ping and the server
// pongs, the opposite way round to protocol 4. We send our own ping on a
// timer AND pong anything the server pings us with, so either version works
// and a wrong guess about which they run cannot silently kill the feed.

const URL_V3 = 'wss://realtime.streamelements.com/socket.io/?EIO=3&transport=websocket';

// ---------------------------------------------------------------- parsing
// Split out and exported so the framing can be tested without a network.

// An engine.io frame is a one-digit type, then an optional payload. The
// socket.io frames we care about are "4" (message) followed by their own
// type digit: 0 connect, 1 disconnect, 2 event.
function parsePacket(raw) {
  const text = String(raw == null ? '' : raw);
  const type = text[0];
  const rest = text.slice(1);
  if (type === '0') return { kind: 'open', data: safeJson(rest) || {} };
  if (type === '2') return { kind: 'ping' };
  if (type === '3') return { kind: 'pong' };
  if (type !== '4') return { kind: 'other' };
  // socket.io layer
  const sub = rest[0];
  const body = rest.slice(1);
  if (sub === '0') return { kind: 'connected' };
  if (sub === '1') return { kind: 'disconnected' };
  if (sub === '4') return { kind: 'error', data: safeJson(body) };
  if (sub !== '2') return { kind: 'other' };
  // An event is ["name", payload]. A numeric ack id can sit between the
  // "42" and the array; skip it rather than failing to parse.
  const start = body.indexOf('[');
  const arr = start === -1 ? null : safeJson(body.slice(start));
  if (!Array.isArray(arr) || !arr.length) return { kind: 'other' };
  return { kind: 'event', name: String(arr[0]), data: arr[1] };
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// A StreamElements activity -> the shape addDonation() wants, or null if it
// is not a cash tip. Gifts and subs are deliberately ignored: the native
// ones already arrive through Social Stream Ninja, and forwarding both
// would double-count them against the top-donor total.
function tipFromEvent(event) {
  if (!event || event.type !== 'tip') return null;
  const d = event.data || {};
  const amount = Number(d.amount) || 0;
  const currency = String(d.currency || 'USD').toUpperCase();
  return {
    // Used to drop a repeat if the socket redelivers one after a reconnect.
    id: String(event._id || (d.tipId || '')) || '',
    from: d.displayName || d.username || 'Someone',
    // Same bargain the widget struck: the display string keeps the tipper's
    // own currency, and `usd` -- the number the $10 read-aloud line is
    // measured against -- is only set when the tip really is in dollars.
    // A hard-coded exchange rate would go stale in silence.
    amount: (currency === 'USD' ? '$' : currency + ' ') + amount.toFixed(2),
    usd: currency === 'USD' ? amount : 0,
    note: d.message || '',
    platform: 'streamelements',
  };
}

// ---------------------------------------------------------------- client

function start({ token, onTip, log = console.log, url = URL_V3, WebSocketImpl = globalThis.WebSocket } = {}) {
  if (!token) return null;
  if (!WebSocketImpl) {
    log('streamelements: this Node has no built-in WebSocket -- tips will keep coming through the OBS widget');
    return null;
  }

  const state = { connected: false, authenticated: false, lastTipAt: 0, tips: 0 };
  // Redelivery after a reconnect is the one way this could double-count, so
  // the ids of what has already been passed on are kept. A show is tens of
  // tips; this never needs trimming.
  const seen = new Set();
  let ws = null;
  let pinger = null;
  let retry = null;
  let attempts = 0;
  let stopped = false;

  function clearTimers() {
    if (pinger) { clearInterval(pinger); pinger = null; }
    if (retry) { clearTimeout(retry); retry = null; }
  }

  function scheduleReconnect() {
    if (stopped || retry) return;
    attempts++;
    // 2s, 4s, 8s ... capped at 30. A stream runs for hours; backing off
    // further than that would mean tips silently stop for the rest of it.
    const wait = Math.min(30000, 2000 * Math.pow(2, Math.min(attempts - 1, 4)));
    retry = setTimeout(() => { retry = null; open(); }, wait);
  }

  function open() {
    if (stopped) return;
    state.connected = false;
    state.authenticated = false;
    try {
      ws = new WebSocketImpl(url);
    } catch (err) {
      log(`streamelements: could not open the socket (${err.message})`);
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      state.connected = true;
    });

    ws.addEventListener('message', (ev) => {
      const packet = parsePacket(ev.data);

      if (packet.kind === 'open') {
        const every = Number(packet.data.pingInterval) || 25000;
        clearInterval(pinger);
        // Protocol 3: we are the side that pings. Slightly early, so a slow
        // frame cannot land after the server's pingTimeout.
        pinger = setInterval(() => { send('2'); }, Math.max(5000, every - 2000));
        return;
      }
      // Protocol 4 would ping us instead. Answering costs nothing and means
      // the feed survives StreamElements upgrading socket.io under us.
      if (packet.kind === 'ping') { send('3'); return; }
      if (packet.kind === 'connected') {
        send('42' + JSON.stringify(['authenticate', { method: 'jwt', token }]));
        return;
      }
      if (packet.kind !== 'event') return;

      if (packet.name === 'authenticated') {
        state.authenticated = true;
        attempts = 0;
        log('streamelements: connected -- tips now arrive directly, no OBS needed');
        return;
      }
      if (packet.name === 'unauthorized') {
        // Retrying a rejected token just gets it rejected again, forever.
        log('streamelements: the token was refused. Check OOP_SE_JWT in stream/.env.local.');
        stopped = true;
        clearTimers();
        try { ws.close(); } catch { /* already closing */ }
        return;
      }
      if (packet.name !== 'event' && packet.name !== 'event:test') return;

      // A test fired from the StreamElements dashboard arrives on
      // 'event:test' and is shaped the same. It is let through on purpose:
      // rehearsing a tip is the whole point of having a test button.
      const tip = tipFromEvent(packet.data);
      if (!tip) return;
      if (tip.id) {
        if (seen.has(tip.id)) return;
        seen.add(tip.id);
      }
      state.tips++;
      state.lastTipAt = Date.now();
      try {
        onTip(tip);
      } catch (err) {
        log(`streamelements: tip arrived but could not be shown (${err.message})`);
      }
    });

    const dropped = () => {
      if (stopped) return;
      const wasUp = state.authenticated;
      state.connected = false;
      state.authenticated = false;
      clearInterval(pinger);
      pinger = null;
      if (wasUp) log('streamelements: connection dropped -- reconnecting');
      scheduleReconnect();
    };
    ws.addEventListener('close', dropped);
    ws.addEventListener('error', dropped);
  }

  function send(frame) {
    try { ws.send(frame); } catch { /* closing; the reconnect handles it */ }
  }

  open();

  return {
    // The relay asks this before accepting a widget-forwarded tip, so the
    // two paths can both be wired up without double-counting.
    isLive: () => state.authenticated,
    status: () => ({ ...state }),
    stop() {
      stopped = true;
      clearTimers();
      try { ws && ws.close(); } catch { /* already gone */ }
    },
  };
}

module.exports = { start, parsePacket, tipFromEvent, URL_V3 };

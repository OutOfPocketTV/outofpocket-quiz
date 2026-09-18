// The StreamElements tip feed, against a fake socket. Nothing goes out.
//
//   node stream/test-streamelements.js
//
// The framing is the part worth testing: it is hand-rolled engine.io, and
// getting a digit wrong means the feed silently never authenticates. A real
// tip is far too expensive a way to find that out.

const test = require('node:test');
const assert = require('node:assert');
const se = require('./streamelements.js');

// ------------------------------------------------------------ framing

test('reads every frame the server actually sends', () => {
  assert.deepStrictEqual(
    se.parsePacket('0{"sid":"abc","pingInterval":25000,"pingTimeout":60000}'),
    { kind: 'open', data: { sid: 'abc', pingInterval: 25000, pingTimeout: 60000 } }
  );
  assert.deepStrictEqual(se.parsePacket('40'), { kind: 'connected' });
  assert.deepStrictEqual(se.parsePacket('2'), { kind: 'ping' });
  assert.deepStrictEqual(se.parsePacket('3'), { kind: 'pong' });

  const authed = se.parsePacket('42["authenticated",{"channelId":"x"}]');
  assert.strictEqual(authed.kind, 'event');
  assert.strictEqual(authed.name, 'authenticated');

  // An ack id can sit between the 42 and the array.
  const withAck = se.parsePacket('4217["event",{"type":"tip"}]');
  assert.strictEqual(withAck.name, 'event');
  assert.deepStrictEqual(withAck.data, { type: 'tip' });
});

test('malformed frames are ignored, never thrown', () => {
  for (const junk of ['', '42', '42[', '42{"not":"an array"}', 'x', '4']) {
    assert.doesNotThrow(() => se.parsePacket(junk));
    assert.notStrictEqual(se.parsePacket(junk).kind, 'event');
  }
});

// -------------------------------------------------------------- tips

test('a dollar tip keeps its amount and counts against the read-aloud line', () => {
  const tip = se.tipFromEvent({
    _id: 'abc123',
    type: 'tip',
    data: { username: 'kraduu', displayName: 'Kraduu', amount: 25, currency: 'USD', message: 'love the show' },
  });
  assert.strictEqual(tip.id, 'abc123');
  assert.strictEqual(tip.from, 'Kraduu');
  assert.strictEqual(tip.amount, '$25.00');
  assert.strictEqual(tip.usd, 25);
  assert.strictEqual(tip.note, 'love the show');
  assert.strictEqual(tip.platform, 'streamelements');
});

test('a non-dollar tip keeps its own currency and is not converted', () => {
  const tip = se.tipFromEvent({ _id: 'e1', type: 'tip', data: { username: 'hans', amount: 50, currency: 'eur' } });
  assert.strictEqual(tip.amount, 'EUR 50.00');
  // Left at 0 on purpose: the relay falls back to reading the number out of
  // the display string rather than inventing an exchange rate.
  assert.strictEqual(tip.usd, 0);
  assert.strictEqual(tip.from, 'hans');
});

test('subs, follows and cheers are not tips', () => {
  for (const type of ['subscriber', 'follow', 'cheer', 'raid', 'host']) {
    assert.strictEqual(se.tipFromEvent({ _id: 'x', type, data: { amount: 5 } }), null);
  }
  assert.strictEqual(se.tipFromEvent(null), null);
  assert.strictEqual(se.tipFromEvent({}), null);
});

// ------------------------------------------------------ the whole client

// Enough of a WebSocket for the client to talk to.
function fakeSocket() {
  const sock = {
    sent: [],
    listeners: {},
    closed: false,
    addEventListener(name, fn) { (sock.listeners[name] = sock.listeners[name] || []).push(fn); },
    send(frame) { sock.sent.push(frame); },
    close() { sock.closed = true; },
    fire(name, ev) { for (const fn of sock.listeners[name] || []) fn(ev); },
    say(text) { sock.fire('message', { data: text }); },
  };
  return sock;
}

function connected({ token = 'jwt-token' } = {}) {
  let sock;
  const tips = [];
  const logs = [];
  const client = se.start({
    token,
    onTip: (t) => tips.push(t),
    log: (m) => logs.push(m),
    WebSocketImpl: function () { sock = fakeSocket(); return sock; },
  });
  sock.fire('open');
  sock.say('0{"sid":"s","pingInterval":25000,"pingTimeout":60000}');
  sock.say('40');
  return { client, sock: () => sock, tips, logs };
}

test('authenticates with the jwt as soon as the namespace opens', () => {
  const t = connected();
  assert.deepStrictEqual(JSON.parse(t.sock().sent[0].slice(2)), ['authenticate', { method: 'jwt', token: 'jwt-token' }]);
  assert.strictEqual(t.client.isLive(), false, 'not live until the server says so');
  t.sock().say('42["authenticated",{}]');
  assert.strictEqual(t.client.isLive(), true);
  t.client.stop();
});

test('a tip reaches the relay, and a redelivered one does not arrive twice', () => {
  const t = connected();
  t.sock().say('42["authenticated",{}]');
  const frame = '42["event",{"_id":"tip1","type":"tip","data":{"displayName":"Ash","amount":5,"currency":"USD","message":"hi"}}]';
  t.sock().say(frame);
  t.sock().say(frame); // socket.io redelivers after a reconnect
  assert.strictEqual(t.tips.length, 1);
  assert.strictEqual(t.tips[0].from, 'Ash');
  assert.strictEqual(t.tips[0].usd, 5);
  t.client.stop();
});

test('a dashboard test tip is let through, because rehearsing one is the point', () => {
  const t = connected();
  t.sock().say('42["authenticated",{}]');
  t.sock().say('42["event:test",{"_id":"t1","type":"tip","data":{"username":"tester","amount":10,"currency":"USD"}}]');
  assert.strictEqual(t.tips.length, 1);
  assert.strictEqual(t.tips[0].usd, 10);
  t.client.stop();
});

test('answers a server ping, and pings by itself on protocol 3', () => {
  const t = connected();
  t.sock().say('42["authenticated",{}]');
  t.sock().say('2');
  assert.ok(t.sock().sent.includes('3'), 'must pong or the server drops us');
  t.client.stop();
});

test('a refused token gives up instead of hammering the socket forever', () => {
  const t = connected();
  t.sock().say('42["unauthorized",{"message":"bad token"}]');
  assert.ok(t.sock().closed);
  assert.ok(t.logs.some((l) => /refused/i.test(l)), 'must say so plainly');
  assert.strictEqual(t.client.isLive(), false);
  t.client.stop();
});

test('no token means no client at all, so nothing changes for anyone', () => {
  assert.strictEqual(se.start({ token: '', onTip() {} }), null);
  assert.strictEqual(se.start({ token: null, onTip() {} }), null);
});

test('a tip that arrives while the overlay throws does not kill the feed', () => {
  let sock;
  const logs = [];
  const client = se.start({
    token: 'x',
    onTip() { throw new Error('overlay exploded'); },
    log: (m) => logs.push(m),
    WebSocketImpl: function () { sock = fakeSocket(); return sock; },
  });
  sock.fire('open');
  sock.say('0{"pingInterval":25000}');
  sock.say('40');
  sock.say('42["authenticated",{}]');
  assert.doesNotThrow(() => sock.say('42["event",{"_id":"t","type":"tip","data":{"amount":1,"currency":"USD"}}]'));
  assert.strictEqual(client.isLive(), true, 'still connected for the next one');
  client.stop();
});

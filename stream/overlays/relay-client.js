// The one connection every overlay makes to the relay.
//
// It lives in its own file rather than in common.js because the pages that
// need it least are the ones that need it most: quizcard.html and theme.html
// want an event stream and nothing else, and pulling in the tier tables and
// the whole sound engine to get one would be silly.
//
// Overlays are served by the relay itself, so the stream is same-origin.
// A browser source can outlive several relay restarts in one night, so this
// has to survive the socket going away. EventSource retries on its own while a
// connection is merely interrupted -- but the moment it lands in CLOSED, which
// is what a refused connect or a killed server gives you, it is finished and
// never tries again. That is the "a browser source that loaded against a dead
// relay never recovers" trap: the page is fine, it simply has no event stream,
// so it sits there drawing nothing forever. Rebuild the stream ourselves.
//
//   onAlert / onState  shorthand for the two events almost everyone wants
//   events             { name: fn } for the rest -- quiz, chat, hype, donation
//   onStatus(up)       connection state, for the operator-facing dots
//   onOpen()           every successful connect, first or fiftieth. Pages
//                      re-pull /state here: the relay only pushes `state` on
//                      connect, so anything else that changed while we were
//                      away -- a question going up, say -- is only visible by
//                      asking. Bootstrapping here rather than at load also
//                      covers a source added while the relay was still down.
function connectRelay({ onAlert, onState, onStatus, onOpen, events } = {}) {
  // Named callbacks and the events map end up in one list, so a page can use
  // either without the two fighting over the same event name.
  const handlers = [];
  const listen = (name, fn) => {
    if (typeof fn === "function") handlers.push([name, fn]);
  };
  listen("alert", onAlert);
  listen("state", onState);
  for (const name of Object.keys(events || {})) listen(name, events[name]);

  let source = null;
  let stopped = false;
  let timer = null;
  let delay = 1000;

  function schedule() {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      open();
    }, delay);
    // Back off towards 15s so a relay that is down for a while isn't hammered,
    // while staying quick to notice it coming straight back.
    delay = Math.min(15000, Math.round(delay * 1.7));
  }

  function open() {
    if (stopped) return;
    try {
      source = new EventSource("/events");
    } catch (err) {
      source = null;
      schedule();
      return;
    }

    source.addEventListener("open", () => {
      delay = 1000;
      if (onStatus) onStatus(true);
      if (onOpen) {
        try {
          onOpen();
        } catch (err) {
          /* a page's bootstrap failing must not stop the stream running */
        }
      }
    });

    source.addEventListener("error", () => {
      if (onStatus) onStatus(false);
      // CONNECTING means EventSource is already retrying by itself; opening a
      // second stream on top of that would double every alert.
      if (!source || source.readyState !== EventSource.CLOSED) return;
      try {
        source.close();
      } catch (err) {}
      source = null;
      schedule();
    });

    for (const [name, fn] of handlers) {
      source.addEventListener(name, (e) => {
        try {
          fn(JSON.parse(e.data));
        } catch (err) {
          /* a malformed frame should never take the overlay down mid-stream */
        }
      });
    }
  }

  open();
  return {
    close() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      if (source) source.close();
    },
  };
}

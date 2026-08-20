// Layout for the 1200x630 link-preview image, as a Satori element tree.
// Plain objects rather than JSX so this needs no build step -- Vercel
// serves the api/ files as-is.
//
// The whole point of this card is CONTEXT: a bare "0.4%" tells a stranger
// scrolling past nothing at all. It has to say a test was taken, what was
// being looked for, and on what terms -- so the criteria list is the
// largest element after the number itself.

const { stripEmoji, placeFromScope, MAX_CRITERIA } = require("./share-card.js");

const BG = "#0b0a14";
const INK = "#f3f3f3";
const MUTED = "#9a95ad";

function el(type, style, children) {
  return { type, props: { style, children } };
}

function buildShareImageTree(data) {
  const accent = data.accent;
  const shown = data.criteria.slice(0, MAX_CRITERIA);
  const extra = data.criteria.length - shown.length;

  return el("div", {
    width: "1200px",
    height: "630px",
    display: "flex",
    flexDirection: "column",
    backgroundColor: BG,
    padding: "48px 56px",
    color: INK,
  }, [
    // --- masthead: says what this is before anything else ---
    el("div", { display: "flex", alignItems: "center", marginBottom: "28px" }, [
      el("div", { fontSize: "26px", letterSpacing: "3px", color: INK }, "OUT OF POCKET TV"),
      el("div", { fontSize: "26px", letterSpacing: "3px", color: MUTED, marginLeft: "14px" }, "\u00B7  DATING ODDS TEST"),
    ]),
    el("div", { display: "flex", height: "2px", backgroundColor: "#2a2740", marginBottom: "30px" }, []),

    el("div", { display: "flex", flex: "1" }, [
      // --- left: what they actually asked the calculator for ---
      el("div", { display: "flex", flexDirection: "column", flex: "1", paddingRight: "40px" }, [
        el("div", { fontSize: "25px", color: MUTED, marginBottom: "6px" }, "I took the test looking for"),
        el("div", { fontSize: "34px", color: INK, marginBottom: "22px" },
          `a ${data.dreamWord} in ${placeFromScope(data.scopeLabel)} who is:`),
        el("div", { display: "flex", flexDirection: "column" },
          shown.map((line) => el("div", {
            display: "flex",
            alignItems: "center",
            fontSize: "25px",
            color: "#d3cfe0",
            marginBottom: "9px",
          }, [
            el("div", {
              display: "flex",
              width: "9px",
              height: "9px",
              borderRadius: "5px",
              backgroundColor: accent,
              marginRight: "14px",
            }, []),
            el("div", {}, stripEmoji(line)),
          ]))
        ),
        extra > 0
          ? el("div", { fontSize: "22px", color: MUTED, marginTop: "4px" }, `+ ${extra} more`)
          : el("div", {}, ""),
      ]),

      // --- right: the answer ---
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "430px",
        backgroundColor: "#13111f",
        borderRadius: "20px",
        border: `2px solid ${accent}`,
        padding: "26px",
      }, [
        el("div", { fontSize: "23px", color: MUTED, marginBottom: "2px" }, "My odds"),
        el("div", { fontSize: "112px", color: accent, lineHeight: "1.05" }, data.pctText),
        data.oddsText
          ? el("div", { fontSize: "27px", color: INK, marginTop: "2px" }, data.oddsText)
          : el("div", {}, ""),
        el("div", {
          display: "flex",
          marginTop: "22px",
          padding: "10px 22px",
          borderRadius: "24px",
          border: `2px solid ${accent}`,
          fontSize: "24px",
          color: accent,
        }, `${data.score}/5 \u00B7 ${stripEmoji(data.rarityLabel)}`),
      ]),
    ]),

    // --- footer: the call to action ---
    el("div", { display: "flex", alignItems: "center", marginTop: "28px" }, [
      el("div", { fontSize: "25px", color: MUTED }, "See your own odds at"),
      el("div", { fontSize: "25px", color: INK, marginLeft: "10px" }, "outofpocket.tv"),
    ]),
  ]);
}

module.exports = { buildShareImageTree };

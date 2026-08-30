import assert from "node:assert/strict";
import {
  parseList,
  hostMatches,
  idsToDisable,
  idsToReenable,
  nextAutoState,
  nextManualClick,
} from "./iwa-logic.mjs";

// parseList
assert.deepEqual(parseList("a.com, b.com\nc.com"), ["a.com", "b.com", "c.com"]);
assert.deepEqual(parseList(""), []);
assert.deepEqual(parseList(null), []);

// hostMatches — exact + DNS suffix + *.domain
assert.equal(hostMatches("stripe.com", ["stripe.com"]), true);
assert.equal(hostMatches("checkout.stripe.com", ["stripe.com"]), true);
assert.equal(hostMatches("evilstripe.com", ["stripe.com"]), false);
assert.equal(hostMatches("pay.checkout.stripe.com", ["*.stripe.com"]), true);
assert.equal(hostMatches("example.com", ["stripe.com"]), false);
assert.equal(hostMatches("", ["stripe.com"]), false);

// snapshot: only disable currently-enabled; only re-enable what we disabled
const configured = ["ublock", "badger", "clearurls"];
const enabled = new Set(["ublock", "clearurls"]); // badger already off
assert.deepEqual(
  idsToDisable(configured, (id) => enabled.has(id)),
  ["ublock", "clearurls"]
);

const snapshot = ["ublock", "clearurls"];
const stillDisabled = new Set(["ublock", "clearurls", "badger"]);
assert.deepEqual(
  idsToReenable(snapshot, (id) => stillDisabled.has(id)),
  ["ublock", "clearurls"]
);
// user re-enabled ublock by hand while IWA was on — don't touch
assert.deepEqual(
  idsToReenable(snapshot, (id) => id === "clearurls"),
  ["clearurls"]
);

// auto: on enter allowlist, off on leave; respect lock
assert.deepEqual(
  nextAutoState({ auto: true, locked: false, adsWanted: false, onAllowlist: true }),
  { adsWanted: true, locked: false }
);
assert.deepEqual(
  nextAutoState({ auto: true, locked: false, adsWanted: true, onAllowlist: false }),
  { adsWanted: false, locked: false }
);
assert.equal(
  nextAutoState({ auto: true, locked: true, adsWanted: true, onAllowlist: false }),
  null
);
assert.equal(
  nextAutoState({ auto: false, locked: false, adsWanted: false, onAllowlist: true }),
  null
);
assert.equal(
  nextAutoState({ auto: true, locked: false, adsWanted: true, onAllowlist: true }),
  null
);

// manual: lock+toggle, then unlock+sync
assert.deepEqual(
  nextManualClick({ locked: false, adsWanted: false, onAllowlist: true, auto: true }),
  { adsWanted: true, locked: true }
);
assert.deepEqual(
  nextManualClick({ locked: true, adsWanted: true, onAllowlist: true, auto: true }),
  { adsWanted: true, locked: false }
);
assert.deepEqual(
  nextManualClick({ locked: true, adsWanted: true, onAllowlist: false, auto: true }),
  { adsWanted: false, locked: false }
);
assert.deepEqual(
  nextManualClick({ locked: true, adsWanted: false, onAllowlist: true, auto: false }),
  { adsWanted: false, locked: false }
);

console.log("check.mjs: ok");

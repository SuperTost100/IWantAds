/**
 * Pure helpers for IWantAds — shared by Node check and mirrored in iwantads.uc.js.
 */

/** @param {string} raw */
export function parseList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Exact host, DNS-label suffix (foo.stripe.com ↔ stripe.com), or *.domain.
 * @param {string} host
 * @param {string[]} patterns
 */
export function hostMatches(host, patterns) {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.$/, "");
  for (const raw of patterns) {
    const p = raw.toLowerCase().replace(/^\*\./, "");
    if (!p) continue;
    if (h === p || h.endsWith("." + p)) return true;
  }
  return false;
}

/**
 * When turning adsWanted on: disable every configured id that is currently enabled.
 * Returns the list of ids we actually disable (snapshot).
 * @param {string[]} configuredIds
 * @param {(id: string) => boolean} isEnabled
 */
export function idsToDisable(configuredIds, isEnabled) {
  return configuredIds.filter((id) => isEnabled(id));
}

/**
 * When turning adsWanted off: re-enable only ids we previously disabled.
 * @param {string[]} snapshot
 * @param {(id: string) => boolean} isCurrentlyDisabled
 */
export function idsToReenable(snapshot, isCurrentlyDisabled) {
  return snapshot.filter((id) => isCurrentlyDisabled(id));
}

/**
 * Auto policy for selected-tab host.
 * @returns {{ adsWanted: boolean, locked: boolean } | null} null = no change
 */
export function nextAutoState({ auto, locked, adsWanted, onAllowlist }) {
  if (!auto || locked) return null;
  if (onAllowlist && !adsWanted) return { adsWanted: true, locked: false };
  if (!onAllowlist && adsWanted) return { adsWanted: false, locked: false };
  return null;
}

/**
 * Manual click: first click locks+toggles; second unlocks and syncs to allowlist.
 * @returns {{ adsWanted: boolean, locked: boolean }}
 */
export function nextManualClick({ locked, adsWanted, onAllowlist, auto }) {
  if (locked) {
    const synced = auto ? onAllowlist : adsWanted;
    return { adsWanted: synced, locked: false };
  }
  return { adsWanted: !adsWanted, locked: true };
}

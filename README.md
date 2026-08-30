# IWantAds

Sine mod for Zen Browser (and other Firefox-based browsers): one toolbar click — or an allowlist of hosts — disables/re-enables your privacy and ad-block extensions as a group.

A normal WebExtension **cannot** do this on Firefox (`management.setEnabled` only works for themes). This mod runs as chrome JS via Sine and uses `AddonManager`.

## Install

1. Install [Sine](https://github.com/CosmoCreeper/Sine) for Zen/Firefox.
2. Open Sine mods in settings → add this repo as a custom/unpublished mod.
3. Enable unsafe JavaScript if Sine asks for local mods.
4. Restart the browser if the toolbar button does not appear.
5. Customize toolbar → drag **IWantAds** onto the navbar if needed.

## Configure

In Sine mod preferences:

| Pref | Purpose |
| --- | --- |
| Extension IDs | Addon IDs to toggle (comma or newline). Example: `uBlock0@raymondhill.net` |
| Allowlist hosts | Hosts that auto-enable “ads wanted” (e.g. `stripe.com`) |
| Auto-disable… | Turn allowlist behavior on/off |

Find addon IDs: `about:support` → Add-ons, or `about:debugging` → This Firefox → Internal UUID / Extension ID.

## Behavior

- **Ads wanted ON** → configured IWA extensions are disabled (globally, all tabs).
- **Toolbar click** → locks and toggles. Click again → unlocks and syncs to the current tab’s allowlist state.
- **Allowlist (auto)** → when the *selected* tab’s host matches, ads wanted turns on; when it leaves, turns off — only if not manually locked.
- Re-enable only restores extensions **this mod** disabled (won’t revive ones you already had off).

## Self-check

```bash
node check.mjs
```

## Files

- `theme.json` / `preferences.json` / `userChrome.css` / `iwantads.uc.js` — Sine mod
- `iwa-logic.mjs` — pure host/snapshot helpers (tested by `check.mjs`)

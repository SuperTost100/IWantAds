# IWantAds

Sine mod for Zen Browser (and other Firefox-based browsers): one click — or an allowlist of hosts — disables/re-enables your privacy and ad-block extensions as a group.

A normal WebExtension **cannot** do this on Firefox (`management.setEnabled` only works for themes). This mod runs as chrome JS via Sine and uses `AddonManager`.

## Install

1. Install [Sine](https://github.com/CosmoCreeper/Sine) for Zen/Firefox.
2. In Sine settings → custom install, paste: `SuperTost100/IWantAds`
3. Enable unsafe JavaScript if Sine asks (this mod needs chrome JS).
4. Restart the browser if the button does not appear.

The GitHub repo must be **public** — Sine fetches `theme.json` from `raw.githubusercontent.com`.

## Button

On **Zen Browser**, the button is injected into the **sidebar top icons** row (above tabs) — a lightbulb icon. It does **not** appear in the Customize Toolbar palette; look in the sidebar itself.

| Action | Effect |
| --- | --- |
| **Left-click** | Toggle ads wanted (disable / re-enable your IWA group) |
| **Right-click** or **Shift+click** | Open extension picker (checklist) |

If the button is missing: Sine → update/reinstall IWantAds → **restart Zen** → wait a few seconds after the window opens.

## Pick extensions (no copy-paste IDs)

1. Right-click the IWantAds button (or Shift+click).
2. Check every ad-blocker / privacy extension you want in the group.
3. Click **Save**.

Filter box helps if you have many extensions. **All visible** / **Clear** shortcuts included.

## Sine preferences

| Pref | Purpose |
| --- | --- |
| Allowlist hosts | Hosts that auto-enable “ads wanted” (e.g. `stripe.com`) |
| Auto-disable… | Turn allowlist behavior on/off |

## Behavior

- **Ads wanted ON** → selected IWA extensions are disabled (globally, all tabs).
- **Left-click** → locks and toggles. Click again → unlocks and syncs to the current tab’s allowlist state.
- **Allowlist (auto)** → when the *selected* tab’s host matches, ads wanted turns on; when it leaves, turns off — only if not manually locked.
- Re-enable only restores extensions **this mod** disabled (won’t revive ones you already had off).

## Self-check

```bash
node check.mjs
```

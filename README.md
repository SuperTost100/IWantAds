<p align="center">
  <img src="docs/icon.svg" width="80" height="80" alt="">
</p>

<h1 align="center">IWantAds</h1>

<p align="center">
  A <a href="https://github.com/CosmoCreeper/Sine">Sine</a> mod for Zen Browser and other Firefox-based browsers.<br>
  One click turns your ad blockers and privacy extensions off as a group, and the next click turns them back on. It can also do it on sites you list, such as stripe.com, where blockers break checkout.
</p>

<p align="center">
  <a href="https://github.com/SuperTost100/IWantAds/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/SuperTost100/IWantAds/ci.yml?branch=main&label=checks&color=c2410c"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-c2410c"></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#use-it">Use it</a> ·
  <a href="#allowlist">Allowlist</a> ·
  <a href="#development">Development</a>
</p>

## Why IWantAds

Some sites break when an ad blocker is on. Payment pages are the usual case. A normal extension can't switch other extensions off on Firefox, because `management.setEnabled` only works for themes. IWantAds runs as browser chrome JavaScript through Sine and uses `AddonManager` instead.

You choose which extensions form the group. One button in the browser turns the whole group off or on, and an allowlist does it for you on the hosts you name.

IWantAds has no account and no server, and it makes no network requests. Its settings are `extensions.iwantads.*` preferences in your browser profile.

## What you can do

**Switch the group with one click.** Click the button and every extension in the group turns off, in every tab. Click again and they come back. Only the extensions IWantAds turned off are re-enabled, so one you had already disabled stays off.

**Pick the extensions.** Right-click the button, or Shift+click it, to open the picker. Tick the ad blockers and privacy extensions that belong in the group and click **Save**. The filter box, **All visible** and **Clear** help when you have many extensions.

**Let the allowlist decide.** List the hosts where blockers get in the way. With the automatic option on, IWantAds turns the group off when the selected tab is on a listed host and back on when you leave. See [Allowlist](#allowlist).

## Install

1. Install [Sine](https://github.com/CosmoCreeper/Sine) for Zen or Firefox.
2. In Sine's settings, open the custom install field and paste `SuperTost100/IWantAds`.
3. Allow unsafe JavaScript if Sine asks. The mod needs chrome JavaScript to switch extensions.
4. Restart the browser.

On Zen, the button is a lightbulb in the sidebar's top row of icons, above the tabs. On other Firefox-based browsers it goes at the start of the main toolbar. It isn't in the Customize Toolbar palette. While the group is off, the bulb turns into an orange warning icon.

If the button doesn't show up, update or reinstall the mod in Sine, restart, and wait a few seconds after the window opens.

## Use it

| Action                      | What happens                                                |
| --------------------------- | ----------------------------------------------------------- |
| Click                       | Turns the extension group off or on, and holds it there     |
| Click again                 | Lets go, so the allowlist decides again for the current tab |
| Right-click, or Shift+click | Opens the picker where you choose the extensions            |

A manual click locks the state. While it is locked, the allowlist leaves the group alone and the button shows an outline. The second click unlocks it and applies the allowlist to the current tab.

## Allowlist

In Sine's settings for IWantAds, list hosts one per line or separated by commas. `stripe.com` matches the site and all its subdomains, such as `checkout.stripe.com`. Writing `*.stripe.com` does the same. The default list is `stripe.com` and `checkout.stripe.com`.

The **Log to Browser Console** option prints what the mod does, for debugging.

## Development

The toggle and allowlist logic is in `iwa-logic.mjs`, separate from the browser code in `iwantads.uc.js`, so Node can test it. There is no `package.json` and nothing to install.

```bash
node check.mjs     # prints "check.mjs: ok"
```

Sine reads `theme.json` from `raw.githubusercontent.com`, so the repository has to stay public for installs and updates to work.

## License

[MIT](LICENSE).

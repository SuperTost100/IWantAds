# IWantAds

IWantAds is a [Sine](https://github.com/CosmoCreeper/Sine) mod for Zen Browser and other Firefox-based browsers. One click turns off your ad-blocking and privacy extensions as a group, and the next click turns them back on. It can also do this by itself on sites you list, such as `stripe.com`, where blockers break checkout.

A normal extension can't do this on Firefox, because `management.setEnabled` only works for themes. IWantAds runs as browser chrome JavaScript through Sine and uses `AddonManager` instead.

## Install

1. Install [Sine](https://github.com/CosmoCreeper/Sine) for Zen or Firefox.
2. In Sine's settings, open the custom install field and paste `SuperTost100/IWantAds`.
3. Allow unsafe JavaScript if Sine asks. The mod needs chrome JavaScript to switch extensions.
4. Restart the browser.

On Zen, the button is a lightbulb in the sidebar's top row of icons, above the tabs. On other Firefox-based browsers it goes at the start of the main toolbar. It isn't in the Customize Toolbar palette. If it doesn't show up, update or reinstall the mod in Sine, restart, and wait a few seconds after the window opens.

## Use it

| Action                      | What happens                                                    |
| --------------------------- | --------------------------------------------------------------- |
| Click                       | Turns the extension group off or on, and holds it there         |
| Click again                 | Lets go, so the allowlist decides again for the current tab     |
| Right-click, or Shift+click | Opens the picker where you choose the extensions                |

In the picker, tick the ad blockers and privacy extensions that belong in the group and click **Save**. The filter box, **All visible** and **Clear** help when you have many extensions.

Turning the group off applies to every tab, not only the current one. Turning it back on restores only the extensions IWantAds turned off, so an extension you had already disabled stays off.

## Allowlist

In Sine's settings for IWantAds, list hosts one per line or separated by commas. `stripe.com` matches the site and all its subdomains, such as `checkout.stripe.com`. Writing `*.stripe.com` does the same. The default list is `stripe.com` and `checkout.stripe.com`.

With the automatic option on, IWantAds turns the group off when the selected tab is on a listed host and back on when you leave. After a manual click, the allowlist leaves the group alone until you click again.

The **Log to Browser Console** option prints what the mod does, for debugging.

## Development

The toggle and allowlist logic is in `iwa-logic.mjs`, separate from the browser code in `iwantads.uc.js`, so you can test it with Node:

```bash
node check.mjs     # prints "check.mjs: ok"
```

Sine reads `theme.json` from `raw.githubusercontent.com`, so the repository has to stay public for installs and updates to work.

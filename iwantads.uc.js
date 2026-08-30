// ==UserScript==
// @name         IWantAds
// @description  One-click / allowlist kill switch for IWA privacy extensions
// @include      main
// ==/UserScript==

(function (win) {
  "use strict";

  if (win.IWantAds) return;

  const PREF_IDS = "extensions.iwantads.ids";
  const PREF_ALLOW = "extensions.iwantads.allowlist";
  const PREF_AUTO = "extensions.iwantads.auto";
  const PREF_DEBUG = "extensions.iwantads.debug";
  const PREF_ADS = "extensions.iwantads.adsWanted";
  const PREF_LOCKED = "extensions.iwantads.locked";
  const PREF_SNAP = "extensions.iwantads.snapshot";
  const WIDGET_ID = "iwantads-button";

  // --- pure helpers (keep in sync with iwa-logic.mjs) ---
  function parseList(raw) {
    if (!raw || typeof raw !== "string") return [];
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function hostMatches(host, patterns) {
    if (!host) return false;
    const h = host.toLowerCase().replace(/\.$/, "");
    for (const raw of patterns) {
      const p = raw.toLowerCase().replace(/^\*\./, "");
      if (!p) continue;
      if (h === p || h.endsWith("." + p)) return true;
    }
    return false;
  }

  function idsToDisable(configuredIds, isEnabled) {
    return configuredIds.filter((id) => isEnabled(id));
  }

  function idsToReenable(snapshot, isCurrentlyDisabled) {
    return snapshot.filter((id) => isCurrentlyDisabled(id));
  }

  function nextAutoState({ auto, locked, adsWanted, onAllowlist }) {
    if (!auto || locked) return null;
    if (onAllowlist && !adsWanted) return { adsWanted: true, locked: false };
    if (!onAllowlist && adsWanted) return { adsWanted: false, locked: false };
    return null;
  }

  function nextManualClick({ locked, adsWanted, onAllowlist, auto }) {
    if (locked) {
      const synced = auto ? onAllowlist : adsWanted;
      return { adsWanted: synced, locked: false };
    }
    return { adsWanted: !adsWanted, locked: true };
  }

  // --- prefs ---
  const Services =
    globalThis.Services ||
    ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs").Services;

  function prefBool(name, fallback) {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch {
      return fallback;
    }
  }

  function prefString(name, fallback = "") {
    try {
      return Services.prefs.getStringPref(name, fallback);
    } catch {
      try {
        return Services.prefs.getCharPref(name, fallback);
      } catch {
        return fallback;
      }
    }
  }

  function setBool(name, value) {
    Services.prefs.setBoolPref(name, value);
  }

  function setString(name, value) {
    Services.prefs.setStringPref(name, value);
  }

  function log(...args) {
    if (prefBool(PREF_DEBUG, false)) {
      console.info("[IWantAds]", ...args);
    }
  }

  // --- AddonManager ---
  let AddonManager;
  try {
    ({ AddonManager } = ChromeUtils.importESModule(
      "resource://gre/modules/AddonManager.sys.mjs"
    ));
  } catch (e) {
    console.error("[IWantAds] AddonManager unavailable", e);
    return;
  }

  async function setAddonEnabled(addon, enabled) {
    if (!addon) return;
    if (typeof addon.setEnabled === "function") {
      await addon.setEnabled(enabled);
      return;
    }
    if (enabled && typeof addon.enable === "function") {
      await addon.enable();
      return;
    }
    if (!enabled && typeof addon.disable === "function") {
      await addon.disable();
      return;
    }
    // Legacy chrome path
    addon.userDisabled = !enabled;
  }

  function addonIsUserEnabled(addon) {
    if (!addon) return false;
    if (typeof addon.isActive === "boolean") return addon.isActive;
    return !addon.userDisabled;
  }

  async function applyAdsWanted(want) {
    // Addon IDs are case-sensitive — do not lowercase
    const rawIds = (prefString(PREF_IDS, "") || "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!rawIds.length) {
      log("no extension IDs configured");
      setBool(PREF_ADS, want);
      return;
    }

    if (want) {
      const enabledMap = {};
      await Promise.all(
        rawIds.map(async (id) => {
          const addon = await AddonManager.getAddonByID(id);
          enabledMap[id] = !!(addon && addonIsUserEnabled(addon));
        })
      );
      const toDisable = idsToDisable(rawIds, (id) => enabledMap[id]);
      setString(PREF_SNAP, JSON.stringify(toDisable));
      await Promise.all(
        toDisable.map(async (id) => {
          const addon = await AddonManager.getAddonByID(id);
          if (addon) {
            await setAddonEnabled(addon, false);
            log("disabled", id);
          } else {
            log("missing addon", id);
          }
        })
      );
    } else {
      let snapshot = [];
      try {
        snapshot = JSON.parse(prefString(PREF_SNAP, "[]") || "[]");
      } catch {
        snapshot = [];
      }
      if (!Array.isArray(snapshot)) snapshot = [];

      const disabledMap = {};
      await Promise.all(
        snapshot.map(async (id) => {
          const addon = await AddonManager.getAddonByID(id);
          disabledMap[id] = !!(addon && !addonIsUserEnabled(addon));
        })
      );
      const toEnable = idsToReenable(snapshot, (id) => disabledMap[id]);
      await Promise.all(
        toEnable.map(async (id) => {
          const addon = await AddonManager.getAddonByID(id);
          if (addon) {
            await setAddonEnabled(addon, true);
            log("enabled", id);
          }
        })
      );
      setString(PREF_SNAP, "[]");
    }

    setBool(PREF_ADS, want);
  }

  // --- UI ---
  function selectedHost() {
    try {
      const uri = win.gBrowser?.currentURI;
      if (!uri) return "";
      if (uri.scheme !== "http" && uri.scheme !== "https") return "";
      return uri.host || "";
    } catch {
      return "";
    }
  }

  function onAllowlistNow() {
    return hostMatches(selectedHost(), parseList(prefString(PREF_ALLOW, "")));
  }

  function updateButton() {
    const ads = prefBool(PREF_ADS, false);
    const locked = prefBool(PREF_LOCKED, false);
    const nodes = win.document.querySelectorAll("#" + WIDGET_ID);
    for (const btn of nodes) {
      btn.setAttribute("iwa-active", ads ? "true" : "false");
      btn.setAttribute("iwa-locked", locked ? "true" : "false");
      const tip = ads
        ? locked
          ? "IWantAds ON (locked) — click to unlock"
          : "IWantAds ON — blockers disabled"
        : locked
          ? "IWantAds OFF (locked) — click to unlock"
          : "IWantAds OFF — blockers active";
      btn.setAttribute("tooltiptext", tip);
    }
  }

  let applying = false;

  async function setState(adsWanted, locked) {
    if (applying) return;
    applying = true;
    try {
      const prev = prefBool(PREF_ADS, false);
      setBool(PREF_LOCKED, locked);
      if (prev !== adsWanted) {
        await applyAdsWanted(adsWanted);
      } else {
        setBool(PREF_ADS, adsWanted);
      }
      updateButton();
      log("state", { adsWanted, locked, host: selectedHost() });
    } catch (e) {
      console.error("[IWantAds] setState failed", e);
    } finally {
      applying = false;
    }
  }

  async function onManualClick(event) {
    if (event?.button && event.button !== 0) return;
    const next = nextManualClick({
      locked: prefBool(PREF_LOCKED, false),
      adsWanted: prefBool(PREF_ADS, false),
      onAllowlist: onAllowlistNow(),
      auto: prefBool(PREF_AUTO, true),
    });
    await setState(next.adsWanted, next.locked);
  }

  async function syncAuto() {
    const next = nextAutoState({
      auto: prefBool(PREF_AUTO, true),
      locked: prefBool(PREF_LOCKED, false),
      adsWanted: prefBool(PREF_ADS, false),
      onAllowlist: onAllowlistNow(),
    });
    if (!next) {
      updateButton();
      return;
    }
    await setState(next.adsWanted, next.locked);
  }

  function ensureWidget() {
    try {
      const { CustomizableUI } = ChromeUtils.importESModule(
        "resource:///modules/CustomizableUI.sys.mjs"
      );
      if (CustomizableUI.getWidget(WIDGET_ID)) return CustomizableUI;

      CustomizableUI.createWidget({
        id: WIDGET_ID,
        type: "button",
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: "IWantAds",
        tooltiptext: "IWantAds — toggle IWA blockers",
        onCommand(event) {
          const chromeWin = event.target.ownerGlobal;
          chromeWin?.IWantAds?.onManualClick?.(event);
        },
        onCreated(btn) {
          btn.classList.add("toolbarbutton-1", "chromeclass-toolbar-additional");
          const chromeWin = btn.ownerGlobal;
          chromeWin?.IWantAds?.updateButton?.();
        },
      });
      return CustomizableUI;
    } catch (e) {
      console.error("[IWantAds] CustomizableUI failed", e);
      return null;
    }
  }

  function attachWindowListeners() {
    const tabContainer = win.gBrowser?.tabContainer;
    if (tabContainer) {
      tabContainer.addEventListener("TabSelect", () => {
        win.IWantAds.syncAuto();
      });
    }

    // Location changes on the selected browser
    const progressListener = {
      onLocationChange(browser) {
        if (browser !== win.gBrowser?.selectedBrowser) return;
        win.IWantAds.syncAuto();
      },
    };
    try {
      win.gBrowser.addTabsProgressListener(progressListener);
    } catch (e) {
      log("progress listener failed", e);
    }

    // Pref changes from Sine settings
    const observer = {
      observe() {
        win.IWantAds.syncAuto();
        win.IWantAds.updateButton();
      },
    };
    for (const p of [PREF_IDS, PREF_ALLOW, PREF_AUTO, PREF_DEBUG]) {
      try {
        Services.prefs.addObserver(p, observer);
      } catch {
        /* ignore */
      }
    }

    win.addEventListener(
      "unload",
      () => {
        try {
          win.gBrowser?.removeTabsProgressListener?.(progressListener);
        } catch {
          /* ignore */
        }
        for (const p of [PREF_IDS, PREF_ALLOW, PREF_AUTO, PREF_DEBUG]) {
          try {
            Services.prefs.removeObserver(p, observer);
          } catch {
            /* ignore */
          }
        }
      },
      { once: true }
    );
  }

  // Ensure runtime prefs exist
  if (!Services.prefs.prefHasUserValue(PREF_ADS)) setBool(PREF_ADS, false);
  if (!Services.prefs.prefHasUserValue(PREF_LOCKED)) setBool(PREF_LOCKED, false);
  if (!Services.prefs.prefHasUserValue(PREF_SNAP)) setString(PREF_SNAP, "[]");

  win.IWantAds = {
    onManualClick,
    syncAuto,
    updateButton,
    applyAdsWanted,
  };

  ensureWidget();
  attachWindowListeners();
  updateButton();
  // Defer first auto sync until browser is ready
  win.setTimeout(() => {
    win.IWantAds.syncAuto();
  }, 500);

  log("initialized");
})(window);

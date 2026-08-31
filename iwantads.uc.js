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
  const PANEL_ID = "iwantads-panel";

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

  function getConfiguredIds() {
    return (prefString(PREF_IDS, "") || "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function setConfiguredIds(ids) {
    setString(PREF_IDS, ids.join("\n"));
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
    addon.userDisabled = !enabled;
  }

  function addonIsUserEnabled(addon) {
    if (!addon) return false;
    if (typeof addon.isActive === "boolean") return addon.isActive;
    return !addon.userDisabled;
  }

  async function listUserExtensions() {
    const addons = await AddonManager.getAddonsByTypes(["extension"]);
    return addons
      .filter((a) => a?.id && a?.name && !a.hidden)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
  }

  async function applyAdsWanted(want) {
    const rawIds = getConfiguredIds();

    if (!rawIds.length) {
      log("no extensions selected — right-click the button to pick some");
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
    const count = getConfiguredIds().length;
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
      btn.setAttribute(
        "tooltiptext",
        `${tip}\nLeft-click: toggle · Right-click / Shift+click: pick extensions (${count} selected)`
      );
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
    if (event?.shiftKey) {
      await openPickerPanel(event.target);
      return;
    }
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

  function filterExtensionRows(list, query) {
    const q = query.trim().toLowerCase();
    for (const row of list.querySelectorAll(".iwantads-ext-row")) {
      const label = row.getAttribute("data-label") || "";
      const id = row.getAttribute("data-id") || "";
      const show = !q || label.includes(q) || id.includes(q);
      row.hidden = !show;
    }
  }

  function ensurePanel(doc) {
    let panel = doc.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = doc.createXULElement("panel");
    panel.id = PANEL_ID;
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautohide", "true");

    const root = doc.createXULElement("vbox");
    root.className = "iwantads-panel-root";

    const title = doc.createXULElement("label");
    title.className = "iwantads-panel-title";
    title.setAttribute("value", "Pick IWA extensions");

    const hint = doc.createXULElement("description");
    hint.className = "iwantads-panel-hint";
    hint.textContent =
      "Checked extensions are disabled when ads wanted is ON.";

    const filter = doc.createElementNS("http://www.w3.org/1999/xhtml", "input");
    filter.className = "iwantads-panel-filter";
    filter.type = "search";
    filter.placeholder = "Filter…";

    const list = doc.createXULElement("vbox");
    list.id = "iwantads-ext-list";
    list.className = "iwantads-ext-list";

    const scroll = doc.createXULElement("scrollbox");
    scroll.className = "iwantads-ext-scroll";
    scroll.setAttribute("orient", "vertical");
    scroll.appendChild(list);

    const actions = doc.createXULElement("hbox");
    actions.className = "iwantads-panel-actions";

    const selectVisible = doc.createXULElement("button");
    selectVisible.className = "iwantads-panel-link";
    selectVisible.setAttribute("label", "All visible");
    selectVisible.addEventListener("command", () => {
      for (const row of list.querySelectorAll(".iwantads-ext-row:not([hidden])")) {
        row.querySelector("checkbox").checked = true;
      }
    });

    const clearAll = doc.createXULElement("button");
    clearAll.className = "iwantads-panel-link";
    clearAll.setAttribute("label", "Clear");
    clearAll.addEventListener("command", () => {
      for (const cb of list.querySelectorAll("checkbox")) {
        cb.checked = false;
      }
    });

    const save = doc.createXULElement("button");
    save.className = "iwantads-panel-save";
    save.setAttribute("label", "Save");
    save.addEventListener("command", () => {
      const ids = [...list.querySelectorAll("checkbox:checked")].map(
        (cb) => cb.dataset.addonId
      );
      setConfiguredIds(ids);
      panel.hidePopup();
      updateButton();
      log("saved extension selection", ids);
    });

    filter.addEventListener("input", () => filterExtensionRows(list, filter.value));

    actions.appendChild(selectVisible);
    actions.appendChild(clearAll);
    actions.appendChild(doc.createXULElement("spacer"));
    actions.appendChild(save);

    root.appendChild(title);
    root.appendChild(hint);
    root.appendChild(filter);
    root.appendChild(scroll);
    root.appendChild(actions);
    panel.appendChild(root);
    doc.documentElement.appendChild(panel);
    return panel;
  }

  async function populateExtensionList(list) {
    while (list.firstChild) list.firstChild.remove();

    const selected = new Set(getConfiguredIds());
    const extensions = await listUserExtensions();

    if (!extensions.length) {
      const empty = list.ownerDocument.createXULElement("description");
      empty.textContent = "No extensions found.";
      list.appendChild(empty);
      return;
    }

    for (const addon of extensions) {
      const row = list.ownerDocument.createXULElement("hbox");
      row.className = "iwantads-ext-row";
      row.setAttribute("data-label", addon.name.toLowerCase());
      row.setAttribute("data-id", addon.id.toLowerCase());

      const cb = list.ownerDocument.createXULElement("checkbox");
      cb.className = "iwantads-ext-cb";
      cb.setAttribute("label", addon.name);
      cb.setAttribute("tooltiptext", addon.id);
      cb.dataset.addonId = addon.id;
      cb.checked = selected.has(addon.id);

      row.appendChild(cb);
      list.appendChild(row);
    }
  }

  async function openPickerPanel(anchor) {
    const doc = anchor?.ownerDocument || win.document;
    const panel = ensurePanel(doc);
    const list = panel.querySelector("#iwantads-ext-list");
    const filter = panel.querySelector(".iwantads-panel-filter");
    if (filter) filter.value = "";
    await populateExtensionList(list);
    panel.openPopup(anchor, "after_start", 0, 0, false, false);
  }

  /** Zen sidebar top icons — ponytail: DOM inject, not CustomizableUI (Sine/Zen). */
  function findToolbarTarget(doc) {
    return (
      doc.getElementById("zen-sidebar-top-buttons-customization-target") ||
      doc.getElementById("zen-sidebar-top-buttons") ||
      doc.getElementById("nav-bar-customization-target")
    );
  }

  function wireToolbarButton(btn) {
    if (btn.dataset.iwaWired === "true") return;
    btn.dataset.iwaWired = "true";
    btn.classList.add("toolbarbutton-1", "chromeclass-toolbar-additional");
    btn.setAttribute("label", "IWantAds");
    btn.addEventListener("command", (e) => onManualClick(e));
    btn.addEventListener(
      "click",
      (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          openPickerPanel(btn);
        }
      },
      true
    );
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openPickerPanel(btn);
    });
  }

  function ensureToolbarButton() {
    const doc = win.document;
    const target = findToolbarTarget(doc);
    if (!target) return false;

    let btn = doc.getElementById(WIDGET_ID);
    if (!btn) {
      btn = doc.createXULElement("toolbarbutton");
      btn.id = WIDGET_ID;
      target.prepend(btn);
    } else if (!target.contains(btn)) {
      target.prepend(btn);
    }

    wireToolbarButton(btn);
    updateButton();
    return true;
  }

  async function initToolbarButton() {
    try {
      await win.gBrowser?.delayedStartupPromise;
    } catch {
      /* ponytail: delayedStartup optional */
    }

    for (let i = 0; i < 60; i++) {
      if (ensureToolbarButton()) {
        log("toolbar button mounted");
        return;
      }
      await new Promise((r) => win.setTimeout(r, 200));
    }
    console.warn(
      "[IWantAds] Sidebar toolbar not found — is Zen loaded? Try restarting after updating the mod."
    );
  }

  function attachWindowListeners() {
    const tabContainer = win.gBrowser?.tabContainer;
    if (tabContainer) {
      tabContainer.addEventListener("TabSelect", () => {
        win.IWantAds.syncAuto();
      });
    }

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

  if (!Services.prefs.prefHasUserValue(PREF_ADS)) setBool(PREF_ADS, false);
  if (!Services.prefs.prefHasUserValue(PREF_LOCKED)) setBool(PREF_LOCKED, false);
  if (!Services.prefs.prefHasUserValue(PREF_SNAP)) setString(PREF_SNAP, "[]");

  win.IWantAds = {
    onManualClick,
    syncAuto,
    updateButton,
    applyAdsWanted,
    openPickerPanel,
    ensureToolbarButton,
  };

  attachWindowListeners();
  initToolbarButton();
  win.addEventListener("aftercustomization", () => ensureToolbarButton(), {
    once: false,
  });
  updateButton();
  win.setTimeout(() => {
    ensureToolbarButton();
    win.IWantAds.syncAuto();
  }, 500);

  log("initialized");
})(window);

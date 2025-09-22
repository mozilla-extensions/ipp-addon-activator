/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, ExtensionCommon, Cr */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  IPProtectionService:
    "resource:///modules/ipprotection/IPProtectionService.sys.mjs",
});

const PREF_DYNAMIC_TAB_BREAKAGES =
  "extensions.ippactivator.dynamicTabBreakages";
const PREF_DYNAMIC_WEBREQUEST_BREAKAGES =
  "extensions.ippactivator.dynamicWebRequestBreakages";
const PREF_NOTIFIED_DOMAINS = "extensions.ippactivator.notifiedDomains";

this.ippActivator = class extends ExtensionAPI {
  onStartup() {}

  onShutdown(_isAppShutdown) {}

  getAPI(context) {
    return {
      ippActivator: {
        onIPPActivated: new ExtensionCommon.EventManager({
          context,
          name: "ippActivator.onIPPActivated",
          register: (fire) => {
            const topic = "IPProtectionService:Started";
            const observer = {
              observe(subject, t, _data) {
                if (t === topic) {
                  fire.async({});
                }
              },
            };
            Services.obs.addObserver(observer, topic);
            return () => {
              Services.obs.removeObserver(observer, topic);
            };
          },
        }).api(),
        isTesting() {
          return Services.prefs.getBoolPref(
            "extensions.ippactivator.testMode",
            false,
          );
        },
        isIPPActive() {
          return lazy.IPProtectionService.isActive;
        },
        getDynamicTabBreakages() {
          try {
            const json = Services.prefs.getStringPref(
              PREF_DYNAMIC_TAB_BREAKAGES,
              "[]",
            );
            const arr = JSON.parse(json);
            return Array.isArray(arr) ? arr : [];
          } catch (_) {
            return [];
          }
        },
        getDynamicWebRequestBreakages() {
          try {
            const json = Services.prefs.getStringPref(
              PREF_DYNAMIC_WEBREQUEST_BREAKAGES,
              "[]",
            );
            const arr = JSON.parse(json);
            return Array.isArray(arr) ? arr : [];
          } catch (_) {
            return [];
          }
        },
        getNotifiedDomains() {
          try {
            const json = Services.prefs.getStringPref(
              PREF_NOTIFIED_DOMAINS,
              "[]",
            );
            const arr = JSON.parse(json);
            return Array.isArray(arr) ? arr : [];
          } catch (_) {
            return [];
          }
        },
        addNotifiedDomain(domain) {
          try {
            const d = String(domain || "");
            if (!d) {
              return;
            }
            let arr = [];
            try {
              const json = Services.prefs.getStringPref(
                PREF_NOTIFIED_DOMAINS,
                "[]",
              );
              arr = JSON.parse(json);
              if (!Array.isArray(arr)) {
                arr = [];
              }
            } catch (_) {
              arr = [];
            }
            if (!arr.includes(d)) {
              arr.push(d);
              Services.prefs.setStringPref(
                PREF_NOTIFIED_DOMAINS,
                JSON.stringify(arr),
              );
            }
          } catch (e) {
            console.warn("Unable to store a notified domain", e);
          }
        },
        getBaseDomainFromURL(url) {
          try {
            const host = Services.io.newURI(url).host;
            if (!host) {
              return "";
            }
            try {
              return Services.eTLD.getBaseDomainFromHost(host);
            } catch (e) {
              if (e.result === Cr.NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS) {
                return host;
              }
              return "";
            }
          } catch (_) {
            return "";
          }
        },
        showMessage(message) {
          try {
            const win = Services.wm.getMostRecentWindow("navigator:browser");
            if (!win || !win.gBrowser) {
              return;
            }

            const nbox = win.gBrowser.getNotificationBox();
            const id = "ipp-activator-notification";

            const existing = nbox.getNotificationWithValue?.(id);
            if (existing) {
              nbox.removeNotification(existing);
            }

            const buildLabel = (msg) => {
              // Accept either string or array of parts {text, modifier}
              if (Array.isArray(msg)) {
                const frag = win.document.createDocumentFragment();
                for (const part of msg) {
                  const text = String(part?.text ?? "");
                  const mods = Array.isArray(part?.modifier)
                    ? part.modifier
                    : [];
                  if (mods.includes("strong")) {
                    const strong = win.document.createElement("strong");
                    strong.textContent = text;
                    frag.append(strong);
                  } else {
                    frag.append(win.document.createTextNode(text));
                  }
                }
                return frag;
              }
              return String(msg ?? "");
            };

            const label = buildLabel(message);

            nbox.appendNotification(
              id,
              {
                // If label is a string, pass it through; if it's a Node, the
                // notification box will handle it as rich content.
                label,
                priority: nbox.PRIORITY_WARNING_HIGH,
              },
              [],
            );
          } catch (e) {
            console.warn("Unable to show the message", e);
          }
        },
        onDynamicTabBreakagesUpdated: new ExtensionCommon.EventManager({
          context,
          name: "ippActivator.onDynamicTabBreakagesUpdated",
          register: (fire) => {
            const branch = Services.prefs.getBranch("extensions.ippactivator.");
            const observer = {
              observe(subject, topic, data) {
                if (
                  topic === "nsPref:changed" &&
                  data === "dynamicTabBreakages"
                ) {
                  fire.async({});
                }
              },
            };
            branch.addObserver("", observer);
            return () => branch.removeObserver("", observer);
          },
        }).api(),
        onDynamicWebRequestBreakagesUpdated: new ExtensionCommon.EventManager({
          context,
          name: "ippActivator.onDynamicWebRequestBreakagesUpdated",
          register: (fire) => {
            const branch = Services.prefs.getBranch("extensions.ippactivator.");
            const observer = {
              observe(subject, topic, data) {
                if (
                  topic === "nsPref:changed" &&
                  data === "dynamicWebRequestBreakages"
                ) {
                  fire.async({});
                }
              },
            };
            branch.addObserver("", observer);
            return () => branch.removeObserver("", observer);
          },
        }).api(),
      },
    };
  }
};

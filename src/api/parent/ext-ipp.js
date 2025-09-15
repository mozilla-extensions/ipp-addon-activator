/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  IPProtectionService: 'resource:///modules/ipprotection/IPProtectionService.sys.mjs',
  ExtensionCommon: 'resource://gre/modules/ExtensionCommon.sys.mjs',
});

const PREF_DYNAMIC_BREAKAGES = 'extensions.ippactivator.dynamicBreakages';

this.ippActivator = class extends ExtensionAPI {
  onStartup() {}

  onShutdown(isAppShutdown) {}

  getAPI(context) {
    return {
      ippActivator: {
        onIPPActivated: new lazy.ExtensionCommon.EventManager({
          context,
          name: 'ippActivator.onIPPActivated',
          register: (fire) => {
            const topic = 'IPProtectionService:Started';
            const observer = {
              observe(subject, t, data) {
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
          return Services.prefs.getBoolPref('extensions.ippactivator.testMode', false);
        },
        isIPPActive() {
          return lazy.IPProtectionService.isActive;
        },
        getDynamicBreakages() {
          try {
            const json = Services.prefs.getStringPref(PREF_DYNAMIC_BREAKAGES, '[]');
            const arr = JSON.parse(json);
            if (!Array.isArray(arr)) return [];
            return arr;
          } catch (_) {
            return [];
          }
        },
        getBaseDomainFromURL(url) {
          try {
            const host = Services.io.newURI(url).host;
            if (!host) return '';
            return Services.eTLD.getBaseDomainFromHost(host);
          } catch (e) {
            return '';
          }
        },
        async showMessage(message) {
          return new Promise((resolve) => {
            try {
              const win = Services.wm.getMostRecentWindow('navigator:browser');
              if (!win || !win.gBrowser) {
                resolve('closed');
                return;
              }

              const nbox = win.gBrowser.getNotificationBox();
              const id = 'ipp-activator-notification';

              const existing = nbox.getNotificationWithValue?.(id);
              if (existing) {
                nbox.removeNotification(existing);
              }

              let settled = false;
              const done = (result) => {
                if (settled) return;
                settled = true;
                try {
                  const cur = nbox.getNotificationWithValue?.(id);
                  if (cur) nbox.removeNotification(cur);
                } catch (e) {
                  console.log('Unable to remove previous notifications', e);
                }
                resolve(result);
              };

              nbox.appendNotification(
                id,
                {
                  label: message || '',
                  priority: nbox.PRIORITY_WARNING_HIGH,
                  eventCallback: (event) => {
                    if (event === 'dismissed') {
                      done('closed');
                    }
                  },
                },
                [],
              );
            } catch (e) {
              console.log('Unable to show the message', e);
              resolve('closed');
            }
          });
        },
        onDynamicBreakagesUpdated: new lazy.ExtensionCommon.EventManager({
          context,
          name: 'ippActivator.onDynamicBreakagesUpdated',
          register: (fire) => {
            const branch = Services.prefs.getBranch('extensions.ippactivator.');
            const observer = {
              observe(subject, topic, data) {
                if (topic === 'nsPref:changed' && data === 'dynamicBreakages') {
                  fire.async({});
                }
              },
            };
            branch.addObserver('', observer);
            return () => branch.removeObserver('', observer);
          },
        }).api(),
      },
    };
  }
};

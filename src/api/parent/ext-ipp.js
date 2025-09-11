/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  IPProtectionService: 'resource:///modules/ipprotection/IPProtectionService.sys.mjs',
  ExtensionCommon: 'resource://gre/modules/ExtensionCommon.sys.mjs',
});

this.ippActivator = class extends ExtensionAPI {
  onStartup() {}

  onShutdown(isAppShutdown) {}

  getAPI(context) {
    function isTestMode() {
      try {
        return Services.prefs.getBoolPref('extensions.ippactivator.testMode', false);
      } catch (_) {
        return false;
      }
    }

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
            // In test mode, simulate IPP activation immediately.
            if (isTestMode()) {
              fire.async({});
            }
            return () => {
              Services.obs.removeObserver(observer, topic);
            };
          },
        }).api(),
        isIPPActive() {
          return isTestMode() || lazy.IPProtectionService.isActive;
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

              const buttons = [
                {
                  label: 'OK',
                  accessKey: 'O',
                  callback() {
                    done('clicked');
                    return true;
                  },
                },
                {
                  label: "Don't show again",
                  accessKey: 'D',
                  callback() {
                    done('not-anymore');
                    return true;
                  },
                },
              ];

              nbox.appendNotification(
                id,
                {
                  label: message || '',
                  priority: nbox.PRIORITY_INFO_HIGH,
                  eventCallback: (event) => {
                    if (event === 'dismissed') {
                      done('closed');
                    }
                  },
                },
                buttons,
              );
            } catch (e) {
              console.log('Unable to show the message', e);
              resolve('closed');
            }
          });
        },
        async allowURL(url) {
          if (!lazy.IPProtectionService.connection) return;
          lazy.IPProtectionService.connection.addPageExclusion(url);
        },
      },
    };
  }
};

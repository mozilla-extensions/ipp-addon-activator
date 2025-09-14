/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable no-console */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const NOTIFICATION_ID = 'ipp-activator-notification';
const DYNAMIC_BREAKAGES_PREF = 'extensions.ippactivator.dynamicBreakages';

async function buildXpiIfMissing() {
  const ADDON_XPI_PATH = path.join(__dirname, '../web-ext-artifacts/ipp-addon-activator.xpi');

  if (fs.existsSync(ADDON_XPI_PATH)) return ADDON_XPI_PATH;
  console.log('Building XPI...');
  const res = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('Build failed');
  if (!fs.existsSync(ADDON_XPI_PATH)) throw new Error('XPI not found after build');
  return ADDON_XPI_PATH;
}

async function createDriver() {
  const fxBinary = process.env.FIREFOX_BINARY || undefined;
  const options = new firefox.Options();
  if (fxBinary) options.setBinary(fxBinary);
  options.addArguments('-remote-allow-system-access');
  options.setPreference('extensions.experiments.enabled', true);
  options.setPreference('extensions.ippactivator.testMode', true);
  options.setPreference('toolkit.cosmeticAnimations.enabled', false);
  options.setPreference('datareporting.policy.dataSubmissionPolicyBypassNotification', true);
  return await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
}

function defineMozContext(driver) {
  const { Command } = require('selenium-webdriver/lib/command');
  driver.getExecutor().defineCommand('mozSetContext', 'POST', '/session/:sessionId/moz/context');
  return { Command };
}

async function setChromeContext(driver) {
  const { Command } = defineMozContext(driver);
  await driver.execute(new Command('mozSetContext').setParameter('context', 'chrome'));
}

async function setContentContext(driver) {
  const { Command } = defineMozContext(driver);
  await driver.execute(new Command('mozSetContext').setParameter('context', 'content'));
}

async function waitForNotification(driver, timeoutMs = 30000) {
  await setChromeContext(driver);
  return driver.wait(async () => {
    return await driver.executeScript((id) => {
      try {
        // eslint-disable-next-line no-undef
        const nb = window.gBrowser.getNotificationBox();
        const n = nb.getNotificationWithValue?.(id);
        return !!n;
      } catch (_) {
        return false;
      }
    }, NOTIFICATION_ID);
  }, timeoutMs);
}

async function notificationExists(driver) {
  await setChromeContext(driver);
  return driver.executeScript((id) => {
    try {
      // eslint-disable-next-line no-undef
      const nb = window.gBrowser.getNotificationBox();
      return !!nb.getNotificationWithValue?.(id);
    } catch (_) {
      return false;
    }
  }, NOTIFICATION_ID);
}

async function clickNotificationButton(driver, labelText) {
  await setChromeContext(driver);
  return driver.executeScript(
    (id, text) => {
      try {
        // eslint-disable-next-line no-undef
        const nb = window.gBrowser.getNotificationBox();
        const n = nb.getNotificationWithValue?.(id);
        if (!n) return false;
        const buttons = Array.from(n.querySelectorAll('button'));
        const matches = (v) => (v || '').trim() === text;
        const btn = buttons.find((b) => {
          const tc = (b.textContent || '').trim();
          if (matches(tc)) return true;
          const labels = Array.from(b.querySelectorAll('label'))
            .map((l) => (l.value || l.textContent || '').trim())
            .filter(Boolean);
          return labels.some(matches);
        });
        if (!btn) return false;
        btn.click();
        return true;
      } catch (_) {
        return false;
      }
    },
    NOTIFICATION_ID,
    labelText,
  );
}

async function dismissNotification(driver) {
  await setChromeContext(driver);
  return driver.executeScript((id) => {
    try {
      // eslint-disable-next-line no-undef
      const nb = window.gBrowser.getNotificationBox();
      const n = nb.getNotificationWithValue?.(id);
      if (!n) return false;
      // Try common close selectors
      let closeBtn = n.querySelector(
        'button[aria-label="Close"], button[aria-label="Dismiss"], .close-icon',
      );
      if (!closeBtn) {
        closeBtn = Array.from(n.querySelectorAll('button')).find((b) =>
          Array.from(b.querySelectorAll('label'))
            .map((l) => l.value || l.textContent || '')
            .some((v) => v.trim().toLowerCase() === 'close'),
        );
      }
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
      nb.removeNotification(n);
      return true;
    } catch (_) {
      return false;
    }
  }, NOTIFICATION_ID);
}

async function waitNotificationGone(driver, timeoutMs = 10000) {
  await setChromeContext(driver);
  return driver.wait(async () => !(await notificationExists(driver)), timeoutMs);
}

async function getNavigationState(driver) {
  await setContentContext(driver);
  return driver.executeScript(() => {
    try {
      const entry = performance.getEntriesByType('navigation')[0];
      return { type: entry?.type || null, timeOrigin: performance.timeOrigin };
    } catch (_) {
      return { type: null, timeOrigin: 0 };
    }
  });
}

async function waitReloadSince(driver, prev, timeoutMs = 20000) {
  await setContentContext(driver);
  return driver.wait(async () => {
    return driver.executeScript((p) => {
      try {
        const entry = performance.getEntriesByType('navigation')[0];
        const type = entry?.type || null;
        const to = performance.timeOrigin;
        return to !== p.timeOrigin || type === 'reload';
      } catch (_) {
        return false;
      }
    }, prev);
  }, timeoutMs);
}

async function setDynamicBreakages(driver, breakages) {
  await setChromeContext(driver);
  return driver.executeScript(
    (prefName, arr) => {
      try {
        const json = JSON.stringify(arr || []);
        // eslint-disable-next-line no-undef
        Services.prefs.setStringPref(prefName, json);
        return true;
      } catch (_) {
        return false;
      }
    },
    DYNAMIC_BREAKAGES_PREF,
    breakages,
  );
}

async function clearDynamicBreakages(driver) {
  await setChromeContext(driver);
  return driver.executeScript((prefName) => {
    try {
      // eslint-disable-next-line no-undef
      if (Services.prefs.prefHasUserValue(prefName)) {
        // eslint-disable-next-line no-undef
        Services.prefs.clearUserPref(prefName);
      }
      return true;
    } catch (_) {
      return false;
    }
  }, DYNAMIC_BREAKAGES_PREF);
}

module.exports = {
  buildXpiIfMissing,
  createDriver,
  setChromeContext,
  setContentContext,
  waitForNotification,
  notificationExists,
  clickNotificationButton,
  dismissNotification,
  waitNotificationGone,
  getNavigationState,
  waitReloadSince,
  setDynamicBreakages,
  clearDynamicBreakages,
};

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-disable no-console */
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const headless = process.env.FIREFOX_HEADLESS;
  if (headless && headless !== '0' && String(headless).toLowerCase() !== 'false') {
    options.addArguments("--headless")
  }
  options.addArguments('-remote-allow-system-access');
  options.setPreference('extensions.experiments.enabled', true);
  options.setPreference('extensions.ippactivator.testMode', true);
  options.setPreference('toolkit.cosmeticAnimations.enabled', false);
  options.setPreference('datareporting.policy.dataSubmissionPolicyBypassNotification', true);
  return await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
}

async function defineMozContext(driver) {
  const { Command } = await import('selenium-webdriver/lib/command.js');
  driver.getExecutor().defineCommand('mozSetContext', 'POST', '/session/:sessionId/moz/context');
  return { Command };
}

async function setChromeContext(driver) {
  const { Command } = await defineMozContext(driver);
  await driver.execute(new Command('mozSetContext').setParameter('context', 'chrome'));
}

async function setContentContext(driver) {
  const { Command } = await defineMozContext(driver);
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

export {
  buildXpiIfMissing,
  createDriver,
  setChromeContext,
  setContentContext,
  waitForNotification,
  notificationExists,
  dismissNotification,
  waitNotificationGone,
  setDynamicBreakages,
  clearDynamicBreakages,
};

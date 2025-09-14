/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { expect } = require('chai');

const {
  buildXpiIfMissing,
  createDriver,
  setContentContext,
  waitForNotification,
  dismissNotification,
  setDynamicBreakages,
  clearDynamicBreakages,
} = require('./helpers');

describe('Condition: cookie', function () {
  this.timeout(120_000);

  let driver;
  const testUrl = 'https://www.example.com/';

  async function setCookie(name, value) {
    await setContentContext(driver);
    return driver.executeScript(
      (n, v) => {
        try {
          document.cookie = `${n}=${v}; path=/`;
          return true;
        } catch (_) {
          return false;
        }
      },
      name,
      value,
    );
  }

  async function clearCookie(name) {
    await setContentContext(driver);
    return driver.executeScript((n) => {
      try {
        document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        return true;
      } catch (_) {
        return false;
      }
    }, name);
  }

  before(async () => {
    const xpiPath = await buildXpiIfMissing();
    driver = await createDriver();
    await driver.installAddon(xpiPath, true);
    await clearDynamicBreakages(driver);
  });

  after(async () => {
    if (driver) {
      try {
        await clearDynamicBreakages(driver);
      } catch (_) {
        /* ignore */
      }
      await driver.quit();
    }
  });

  it('does not show when cookie is missing; shows when present', async () => {
    await setDynamicBreakages(driver, [
      {
        domains: ['example.com', 'www.example.com'],
        message: 'Cookie basic condition matched',
        condition: { type: 'cookie', domain: 'www.example.com', name: 'ipp_test' },
      },
    ]);

    // Visit page without cookie: no notification expected
    await setContentContext(driver);
    await driver.get(testUrl);

    let appeared = true;
    try {
      await waitForNotification(driver, 3000);
      appeared = true;
    } catch (_) {
      appeared = false; // timeout expected
    }
    expect(appeared).to.equal(false, 'no notification without cookie');

    // Set cookie and reload: notification expected
    await setCookie('ipp_test', 'hello');
    await setContentContext(driver);
    await driver.navigate().refresh();
    const appearedAfter = await waitForNotification(driver, 15000);
    expect(appearedAfter).to.equal(true, 'notification should appear when cookie exists');
    await dismissNotification(driver);
  });

  it('matches exact value when value is specified', async () => {
    await clearCookie('ipp_value');
    await setDynamicBreakages(driver, [
      {
        domains: ['example.com', 'www.example.com'],
        message: 'Cookie value match',
        condition: {
          type: 'cookie',
          domain: 'www.example.com',
          name: 'ipp_value',
          value: 'abc123',
        },
      },
    ]);

    // Wrong value -> no notification
    await setContentContext(driver);
    await driver.get(testUrl);
    await setCookie('ipp_value', 'wrong');
    await setContentContext(driver);
    await driver.navigate().refresh();
    let exists = true;
    try {
      await waitForNotification(driver, 3000);
      exists = true;
    } catch (_) {
      exists = false;
    }
    expect(exists).to.equal(false, 'no notification when value mismatches');

    // Correct value -> notification
    await setCookie('ipp_value', 'abc123');
    await setContentContext(driver);
    await driver.navigate().refresh();
    const appeared = await waitForNotification(driver, 15000);
    expect(appeared).to.equal(true, 'notification should appear with exact value');
    await dismissNotification(driver);
  });

  it('matches substring when value_contain is specified', async () => {
    await clearCookie('ipp_contains');
    await setDynamicBreakages(driver, [
      {
        domains: ['example.com', 'www.example.com'],
        message: 'Cookie contains match',
        condition: {
          type: 'cookie',
          domain: 'www.example.com',
          name: 'ipp_contains',
          value_contain: 'XYZ',
        },
      },
    ]);

    // Value without substring -> no notification
    await setContentContext(driver);
    await driver.get(testUrl);
    await setCookie('ipp_contains', 'abc');
    await setContentContext(driver);
    await driver.navigate().refresh();
    let exists = true;
    try {
      await waitForNotification(driver, 3000);
      exists = true;
    } catch (_) {
      exists = false;
    }
    expect(exists).to.equal(false, 'no notification when substring missing');

    // Value with substring -> notification
    await setCookie('ipp_contains', '123XYZ456');
    await setContentContext(driver);
    await driver.navigate().refresh();
    const appeared = await waitForNotification(driver, 15000);
    expect(appeared).to.equal(true, 'notification should appear when substring matched');
    await dismissNotification(driver);
  });
});

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
  waitNotificationGone,
  setDynamicBreakages,
  clearDynamicBreakages,
} = require('./helpers');

describe('Notifications', function () {
  this.timeout(120_000);

  let driver;
  const testUrl = 'https://www.example.com/';

  before(async () => {
    const xpiPath = await buildXpiIfMissing();
    driver = await createDriver();
    await driver.installAddon(xpiPath, true);
    // Inject dynamic breakage at runtime for example.com
    await setDynamicBreakages(driver, [
      {
        domains: ['example.com'],
        message:
          'Firefox VPN could break Example video playback. Click here to disable Firefox VPN for this domain.',
        condition: { type: 'test', ret: true },
      },
    ]);
  });

  after(async () => {
    if (driver) {
      try {
        await clearDynamicBreakages(driver);
      } catch (_) {
        /* ignore */
      }
    }
    if (driver) await driver.quit();
  });

  it('dismiss and reappears on refresh', async () => {
    await setContentContext(driver);
    await driver.get(testUrl);
    await waitForNotification(driver);

    const dismissed = await dismissNotification(driver);
    expect(dismissed).to.equal(true, 'should dismiss the notification');

    await waitNotificationGone(driver);

    // Refresh; since the notification is informational, it should reappear
    await setContentContext(driver);
    await driver.navigate().refresh();
    const reappeared = await waitForNotification(driver, 15000);
    expect(reappeared).to.equal(true, 'notification should reappear on refresh');
  });
});

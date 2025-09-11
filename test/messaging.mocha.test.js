/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { expect } = require('chai');
const {
  buildXpiIfMissing,
  createDriver,
  setContentContext,
  waitForNotification,
  clickNotificationButton,
  dismissNotification,
  waitNotificationGone,
  getNavigationState,
  waitReloadSince,
} = require('./helpers');

describe('IPP Add-on Activator (E2E)', function () {
  this.timeout(120_000);

  let driver;
  const testUrl = 'https://www.youtube.com/';

  before(async () => {
    const xpiPath = await buildXpiIfMissing();
    driver = await createDriver();
    await driver.installAddon(xpiPath, true);
  });

  after(async () => {
    if (driver) await driver.quit();
  });

  it("clicking 'OK' reloads the page", async () => {
    await driver.get(testUrl);
    await waitForNotification(driver);

    const before = await getNavigationState(driver);
    const okClicked = await clickNotificationButton(driver, 'OK');
    expect(okClicked).to.equal(true, "should click 'OK'");

    const reloaded = await waitReloadSince(driver, before, 20000);
    expect(reloaded).to.equal(true, 'page should reload after OK');
  });

  it('dismiss and reappears on refresh', async () => {
    await driver.get(testUrl);
    await waitForNotification(driver);

    const dismissed = await dismissNotification(driver);
    expect(dismissed).to.equal(true, 'should dismiss the notification');

    await waitNotificationGone(driver);

    // Refresh; since we didn't choose "Don't show again", it should reappear
    await setContentContext(driver);
    await driver.navigate().refresh();
    const reappeared = await waitForNotification(driver, 15000);
    expect(reappeared).to.equal(true, 'notification should reappear on refresh');
  });

  it("shows the notification and respects 'Don't show again'", async () => {
    await setContentContext(driver);
    await driver.get(testUrl);
    await waitForNotification(driver);

    const clicked = await clickNotificationButton(driver, "Don't show again");
    expect(clicked).to.equal(true, "should click 'Don't show again'");
    await waitNotificationGone(driver);

    // Revisit: it should NOT reappear
    await setContentContext(driver);
    await driver.get(testUrl);
    let reappeared = true;
    try {
      await waitForNotification(driver, 3000);
      reappeared = true;
    } catch (_) {
      reappeared = false; // timeout expected
    }
    expect(reappeared).to.equal(false, 'notification should not reappear');
  });
});

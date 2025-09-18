/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { expect } from "chai";

import {
  buildXpiIfMissing,
  createDriver,
  setContentContext,
  setChromeContext,
  waitForNotification,
  notificationExists,
  dismissNotification,
  setDynamicBreakages,
  clearDynamicBreakages,
} from "./helpers.js";

describe("Notifications only on active tab", function () {
  this.timeout(120_000);

  let driver;
  const testUrl = "https://www.example.com/";

  before(async () => {
    const xpiPath = await buildXpiIfMissing();
    driver = await createDriver();
    await driver.installAddon(xpiPath, true);
    await clearDynamicBreakages(driver);
    // Inject a breakage for example.com that always matches
    await setDynamicBreakages(driver, [
      {
        domains: ["example.com"],
        message:
          "Firefox VPN could break Example video playback. Click here to disable Firefox VPN for this domain.",
        condition: { type: "test", ret: true },
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
      await driver.quit();
    }
  });

  async function openBackgroundTab(url) {
    await setChromeContext(driver);
    return driver.executeScript((u) => {
      try {
        // eslint-disable-next-line no-undef
        const { gBrowser } = window;
        // eslint-disable-next-line no-undef
        const sp = Services.scriptSecurityManager.getSystemPrincipal();
        const tab = gBrowser.addTab(u, {
          triggeringPrincipal: sp,
          selected: false,
        });
        return !!tab;
      } catch (_) {
        return false;
      }
    }, url);
  }

  async function activateTabByUrl(urlPrefix) {
    await setChromeContext(driver);
    return driver.executeScript((prefix) => {
      try {
        // eslint-disable-next-line no-undef
        const { gBrowser } = window;
        const tabs = gBrowser.tabs;
        for (const tab of tabs) {
          const uri = tab.linkedBrowser?.currentURI?.asciiSpec || "";
          if (uri.startsWith(prefix)) {
            gBrowser.selectedTab = tab;
            return true;
          }
        }
        return false;
      } catch (_) {
        return false;
      }
    }, urlPrefix);
  }

  it("defers notification until the tab becomes active", async () => {
    // Keep focus on a neutral tab first
    await setContentContext(driver);
    await driver.get("about:blank");

    // Open example.com in background (inactive) tab
    const opened = await openBackgroundTab(testUrl);
    expect(opened).to.equal(true, "should open background tab");

    // Give the background tab a moment to start loading and trigger listeners
    await driver.sleep(1000);

    // While inactive, we should NOT see any notification
    const existsWhileInactive = await notificationExists(driver);
    expect(existsWhileInactive).to.equal(
      false,
      "no notification while tab inactive",
    );

    // Activate the example.com tab -> notification should appear
    const activated = await activateTabByUrl(testUrl);
    expect(activated).to.equal(true, "should activate example.com tab");

    const appeared = await waitForNotification(driver, 20000);
    expect(appeared).to.equal(true, "notification appears on activation");

    await dismissNotification(driver);
  });
});

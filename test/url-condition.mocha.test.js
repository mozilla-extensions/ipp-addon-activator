/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { expect } from "chai";

import {
  buildXpiIfMissing,
  createDriver,
  setContentContext,
  waitForNotification,
  dismissNotification,
  setDynamicWebRequestBreakages,
  clearDynamicBreakages,
} from "./helpers.js";

describe("Condition: url (webRequest)", function () {
  this.timeout(120_000);

  let driver;
  const testUrl = "https://www.example.com/";

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

  it("triggers on matching XHR/fetch", async () => {
    await setDynamicWebRequestBreakages(driver, [
      {
        // Match on the request domain (httpbin.org), not the tab domain
        domains: ["httpbin.org"],
        message: "URL condition matched",
        condition: {
          type: "url",
          pattern: "https://httpbin\\.org/get",
        },
      },
    ]);

    await setContentContext(driver);
    await driver.get(testUrl);

    // Fire a fetch that matches the pattern; use no-cors to avoid CORS exceptions.
    await setContentContext(driver);
    await driver.executeScript(async () => {
      try {
        await fetch("https://httpbin.org/get", {
          mode: "no-cors",
          cache: "no-cache",
        });
      } catch (_) {
        // ignore
      }
    });

    const appeared = await waitForNotification(driver, 20000);
    expect(appeared).to.equal(
      true,
      "notification should appear on matching request",
    );
    await dismissNotification(driver);
  });
});

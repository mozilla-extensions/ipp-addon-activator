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
  setDynamicTabBreakages,
  clearDynamicBreakages,
  clearNotifiedDomains,
} from "./helpers.js";

describe("Host vs baseDomain matching", function () {
  this.timeout(120_000);

  let driver;

  before(async () => {
    const xpiPath = await buildXpiIfMissing();
    driver = await createDriver();
    await driver.installAddon(xpiPath, true);
    await clearDynamicBreakages(driver);
    await clearNotifiedDomains(driver);
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

  it("matches exact host when domains contains host only", async () => {
    await clearNotifiedDomains(driver);
    await setDynamicTabBreakages(driver, [
      {
        domains: ["www.example.com"],
        message: "Host-only breakage matched",
        condition: { type: "test", ret: true },
      },
    ]);

    // Visit exact host -> notification expected
    await setContentContext(driver);
    await driver.get("https://www.example.com/");
    const appearedOnWww = await waitForNotification(driver, 20000);
    expect(appearedOnWww).to.equal(true, "should match exact host");
    await dismissNotification(driver);

    // Clear suppression and visit base domain (no www) -> no notification expected
    await clearNotifiedDomains(driver);
    await setContentContext(driver);
    await driver.get("https://example.com/");
    let appearedOnBase = true;
    try {
      await waitForNotification(driver, 3000);
      appearedOnBase = true;
    } catch (_) {
      appearedOnBase = false; // timeout expected: no match
    }
    expect(appearedOnBase).to.equal(false, "should not match base domain");

    // Also check a sibling subdomain -> no notification expected
    await setContentContext(driver);
    await driver.get("https://example.com/");
    let appearedOnSibling = true;
    try {
      await waitForNotification(driver, 3000);
      appearedOnSibling = true;
    } catch (_) {
      appearedOnSibling = false;
    }
    expect(appearedOnSibling).to.equal(false, "should not match other subdomains");
  });
});


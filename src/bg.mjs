/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global browser */

import { ConditionFactory } from './conditions/factory.mjs';

class IPPAddonActivator {
  #breakages;
  #baseBreakages;
  #initialized = false;

  constructor() {
    this.tabUpdated = this.#tabUpdated.bind(this);

    browser.ippActivator.isTesting().then(async (isTesting) => {
      await this.#loadAndRebuildBreakages();
      browser.ippActivator.onDynamicBreakagesUpdated.addListener(() =>
        this.#loadAndRebuildBreakages(),
      );

      if (isTesting) {
        this.#init();
        return;
      }

      // Initialize only when IPP is active, keep in sync with activation.
      browser.ippActivator.isIPPActive().then((enabled) => {
        if (enabled) {
          this.#init();
        }
      });

      // IPP start event: initialize when service starts.
      browser.ippActivator.onIPPActivated.addListener((enabled) => {
        if (enabled) {
          this.#init();
        } else {
          this.#uninit();
        }
      });
    });
  }

  async #init() {
    if (this.#initialized) {
      return;
    }
    // React on URL changes and reloads (status: 'loading')
    browser.tabs.onUpdated.addListener(this.tabUpdated, {
      properties: ['url', 'status'],
    });
    this.#initialized = true;
  }

  async #uninit() {
    if (!this.#initialized) {
      return;
    }
    browser.tabs.onUpdated.removeListener(this.tabUpdated);
    this.#initialized = false;
  }

  async #loadAndRebuildBreakages() {
    if (!this.#baseBreakages) {
      try {
        const url = browser.runtime.getURL('breakages/base.json');
        const res = await fetch(url);
        const base = await res.json();
        this.#baseBreakages = Array.isArray(base) ? base : [];
      } catch (e) {
        this.#baseBreakages = [];
      }
    }

    let dynamicBreakages = [];
    try {
      const dyn = await browser.ippActivator.getDynamicBreakages();
      dynamicBreakages = Array.isArray(dyn) ? dyn : [];
    } catch (_) {
      console.warn('Unable to retrieve the dynamic breakages');
    }

    this.#breakages = [...this.#baseBreakages, ...dynamicBreakages];
  }

  async #tabUpdated(tabId, changeInfo, tab) {
    // Only act when the URL changes or a reload starts
    if (!('url' in changeInfo) && changeInfo.status !== 'loading') {
      return;
    }

    const baseDomain = await browser.ippActivator.getBaseDomainFromURL(tab.url);
    if (!baseDomain) {
      return;
    }

    const breakage = this.#breakages.find(
      (b) => Array.isArray(b.domains) && b.domains.includes(baseDomain),
    );
    if (!breakage) {
      return;
    }

    if (!(await ConditionFactory.run(breakage.condition))) {
      return;
    }

    const answer = await browser.ippActivator.showMessage(breakage.message);
    switch (answer) {
      case 'closed':
        break;

      default:
        console.warn('Unexpected result:', answer);
        break;
    }
  }
}

new IPPAddonActivator();

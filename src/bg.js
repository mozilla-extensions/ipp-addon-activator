/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as breakages from './breakages.js';

class IPPAddonActivator {
  #ignoredBreakages;
  #breakages;

  constructor() {
    this.#ignoredBreakages = new Set();

    this.tabUpdated = this.#tabUpdated.bind(this);

    browser.ippActivator.isTesting().then((testing) => {
      this.#breakages = breakages.BREAKAGES;

      if (testing) {
        breakages.TESTING_BREAKAGES.forEach((b) => this.#breakages.push(b));
        this.#init();
        return;
      }

      browser.ippActivator.isIPPActive().then((enabled) => {
        if (enabled) {
          this.#init();
        }
      });

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
    await this.#loadIgnored();

    // React on URL changes and reloads (status: 'loading')
    browser.tabs.onUpdated.addListener(this.tabUpdated, { properties: ['url', 'status'] });
  }

  async #uninit() {
    browser.tabs.onUpdated.removeListener(this.tabUpdated);
  }

  async #tabUpdated(tabId, changeInfo, tab) {
    // Only act when the URL changes or a reload starts
    if (!('url' in changeInfo) && changeInfo.status !== 'loading') return;
    const domain = this.#retrieveDomainFromTab(tab);
    if (domain === '') return;

    const breakage = this.#breakages.find((breakage) => breakage.domains.includes(domain));
    if (!breakage) return;

    if (this.#ignoredBreakages.has(breakage.id)) return;

    const answer = await browser.ippActivator.showMessage(breakage.message);
    switch (answer) {
      case 'closed':
        break;

      case 'not-anymore':
        this.#ignoredBreakages.add(breakage.id);
        this.#persistIgnored();
        break;

      case 'clicked':
        await browser.ippActivator.allowURL(tab.url);
        await browser.tabs.reload(tabId, { bypassCache: true });
        break;

      default:
        console.log('Unexpected result:', answer);
        break;
    }
  }

  async #loadIgnored() {
    try {
      const { ignoredBreakages } = await browser.storage.local.get('ignoredBreakages');
      if (Array.isArray(ignoredBreakages)) {
        this.#ignoredBreakages = new Set(ignoredBreakages);
      }
    } catch (_) {
      // Nothing to do here. The storage does not exist yet.
    }
  }

  async #persistIgnored() {
    try {
      await browser.storage.local.set({ ignoredBreakages: Array.from(this.#ignoredBreakages) });
    } catch (e) {
      console.log('Unable to store the ignored-breakagees');
    }
  }

  #retrieveDomainFromTab(tab) {
    try {
      const u = new URL(tab.url);
      return u.hostname;
    } catch (e) {
      return '';
    }
  }
}

new IPPAddonActivator();

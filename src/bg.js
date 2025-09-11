/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// BREAKAGES is loaded via background.scripts (see manifest.json)

class IPPAddonActivator {
  #ignoredBreakages;

  constructor() {
    this.#ignoredBreakages = new Set();

    this.tabUpdated = this.#tabUpdated.bind(this);

    browser.ippActivator.isIPPActive().then(() => this.#init());
    browser.ippActivator.onIPPActivated.addListener((enabled) => {
      if (enabled) {
        this.#init();
      } else {
        this.#uninit();
      }
    });
  }

  async #init() {
    await this.#loadIgnored();

    browser.tabs.onUpdated.addListener(this.tabUpdated, { properties: ['url'] });
  }

  async #uninit() {
    browser.tabs.onUpdated.removeListener(this.tabUpdated);
  }

  async #tabUpdated(tabId, changeInfo, tab) {
    const domain = this.#retrieveDomainFromTab(tab);
    if (domain === '') return;

    const breakage = BREAKAGES.find((breakage) => breakage.domains.includes(domain));
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

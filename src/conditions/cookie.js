/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ConditionBase from './base.js';

class ConditionCookie extends ConditionBase {
  static STORAGE_KEY = 'cookies-';

  constructor(factory, desc) {
    super(factory, desc);
  }

  async init() {
    const { domain } = this.desc;
    if (!domain) return;

    let cache = this.factory.retrieveData(ConditionCookie.STORAGE_KEY + domain);
    if (Array.isArray(cache)) {
      return;
    }

    try {
      const cookies = await browser.cookies.getAll({ domain });
      cache = Array.isArray(cookies) ? cookies : [];
    } catch (e) {
      cache = [];
    }

    this.factory.storeData(ConditionCookie.STORAGE_KEY + domain, cache);
  }

  check() {
    const { domain, name, value, value_contain } = this.desc;
    if (!domain || !name) return false;

    const cookies = this.factory.retrieveData(ConditionCookie.STORAGE_KEY + domain) || [];
    const c = cookies.find((ck) => ck && ck.name === name);
    if (!c) return false;

    if (typeof value === 'string' && c.value !== value) return false;

    if (
      typeof value_contain === 'string' &&
      (typeof c.value !== 'string' || !c.value.includes(value_contain))
    ) {
      return false;
    }

    return true;
  }
}

export default ConditionCookie;

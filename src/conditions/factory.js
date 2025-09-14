/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ConditionAnd from './and.js';
import ConditionOr from './or.js';
import ConditionTest from './test.js';
import ConditionCookie from './cookie.js';

const CONDITIONS_MAP = {
  and: ConditionAnd,
  test: ConditionTest,
  or: ConditionOr,
  cookie: ConditionCookie,
};

export class ConditionFactory {
  #url;
  #storage = {};

  static async run(url, conditionDesc) {
    if (conditionDesc === undefined) {
      return true;
    }

    const factory = new ConditionFactory(url);

    const condition = await factory.create(conditionDesc);

    await condition.init();

    return condition.check();
  }

  constructor(url) {
    this.#url = url;
  }

  create(conditionDesc) {
    const conditionClass = CONDITIONS_MAP[conditionDesc.type];
    if (!conditionClass) throw new Error('No condition type', conditionDesc.type);
    return new conditionClass(this, conditionDesc);
  }

  storeData(key, value) {
    this.#storage[key] = value;
  }

  retrieveData(key) {
    return this.#storage[key];
  }
}

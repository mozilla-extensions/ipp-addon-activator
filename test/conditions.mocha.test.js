/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { expect } from 'chai';
import { ConditionFactory } from '../src/conditions/factory.js';

describe('Condition logic', function () {
  it('Condition Factory', async () => {
    expect(await ConditionFactory.run('http://example.com', undefined)).to.equal(
      true,
      'Undefined conditions means OK',
    );

    expect(await ConditionFactory.run('http://example.com', { type: 'test', ret: true })).to.equal(
      true,
      'Condition test works',
    );

    expect(await ConditionFactory.run('http://example.com', { type: 'test', ret: false })).to.equal(
      false,
      'Condition test works (2)',
    );

    const factory = new ConditionFactory('http://example.com');
    const a = factory.create({ type: 'test', ret: true });
    const b = factory.create({ type: 'test', ret: false });
    expect(a === b).to.equal(false, 'The factory create a single instance of the test object');
  });

  it('Condition And', async () => {
    expect(
      await ConditionFactory.run('http://example.com', { type: 'and', conditions: [] }),
    ).to.equal(true, 'Condition and: if no conditions, true');
    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'and',
        conditions: [{ type: 'test', ret: true }],
      }),
    ).to.equal(true, 'Condition and: one true condition => true');
    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'and',
        conditions: [{ type: 'test', ret: false }],
      }),
    ).to.equal(false, 'Condition and: one false condition => false');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'and',
        conditions: [
          { type: 'test', ret: true },
          { type: 'test', ret: true },
        ],
      }),
    ).to.equal(true, 'Condition and: multiple true conditions');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'and',
        conditions: [
          { type: 'test', ret: true },
          { type: 'test', ret: false },
          { type: 'test', ret: true },
        ],
      }),
    ).to.equal(false, 'Condition and: multiple mix conditions');
  });

  it('Condition Or', async () => {
    expect(
      await ConditionFactory.run('http://example.com', { type: 'or', conditions: [] }),
    ).to.equal(false, 'Condition or: if no conditions, false');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'or',
        conditions: [{ type: 'test', ret: true }],
      }),
    ).to.equal(true, 'Condition or: one true condition => true');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'or',
        conditions: [{ type: 'test', ret: false }],
      }),
    ).to.equal(false, 'Condition or: one false condition => false');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'or',
        conditions: [
          { type: 'test', ret: true },
          { type: 'test', ret: true },
        ],
      }),
    ).to.equal(true, 'Condition or: multiple true conditions');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'or',
        conditions: [
          { type: 'test', ret: false },
          { type: 'test', ret: false },
        ],
      }),
    ).to.equal(false, 'Condition or: multiple false conditions');

    expect(
      await ConditionFactory.run('http://example.com', {
        type: 'or',
        conditions: [
          { type: 'test', ret: false },
          { type: 'test', ret: true },
        ],
      }),
    ).to.equal(true, 'Condition or: multiple mix conditions');
  });
});

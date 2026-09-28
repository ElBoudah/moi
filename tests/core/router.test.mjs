import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHash, TABS } from '../../js/router.js';

test('parseRoute : onglet, vue, identifiant', () => {
  assert.deepEqual(parseRoute('#/suivi'), { tab: 'suivi', view: 'home', id: undefined });
  assert.deepEqual(parseRoute('#/suivi/data'), { tab: 'suivi', view: 'data', id: undefined });
  assert.deepEqual(parseRoute('#/mind/s/abc%20d'), { tab: 'mind', view: 's', id: 'abc d' });
  assert.deepEqual(parseRoute('#/tests/run/pvt'), { tab: 'tests', view: 'run', id: 'pvt' });
  assert.deepEqual(parseRoute('#/settings'), { tab: 'settings', view: 'home', id: undefined });
  assert.equal(parseRoute(''), null);
  assert.equal(parseRoute('#/'), null);
  assert.equal(parseRoute('#/inconnu'), null);
  assert.equal(TABS.length, 7);
});

test('routeHash est l\'inverse de parseRoute', () => {
  for (const r of [{ tab: 'suivi', view: 'home' }, { tab: 'suivi', view: 'data' }, { tab: 'mind', view: 's', id: 'x/y' }, { tab: 'rappel', view: 'capture' }]) {
    assert.deepEqual(parseRoute(routeHash(r)), { id: undefined, ...r });
  }
  assert.equal(routeHash({ tab: 'pulsion' }), '#/pulsion');
});

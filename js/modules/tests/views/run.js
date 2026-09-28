// Passation : la scène occupe l'écran, la route porte l'identifiant du test, quitter nettoie tout.
import { createStage } from '../stage.js';
import { testById, runsOfAny } from '../catalog/index.js';
import { addRun } from '../ops.js';

export function render(root, ctx) {
  const test = testById(ctx.route?.id);
  if (!test) {
    root.innerHTML = '<p class="empty">Test inconnu.</p><button type="button" class="btn-text" data-back>‹ Tests</button>';
    root.onclick = () => ctx.navigate({ tab: 'tests' });
    return;
  }
  const back = () => ctx.navigate({ tab: 'tests' });
  const stage = createStage(root, { onQuit: back });
  ctx.onLeave(() => stage.clearAll());
  const runs = runsOfAny(ctx.stores.tests.doc, test);
  const lastRun = runs.length ? runs[runs.length - 1] : null;
  test.run(stage, metrics => {
    // notify:false : la notification rerendrait cette vue avant que le changement de route soit traité.
    addRun(ctx.stores.tests, test.id, metrics, ctx.today(), { notify: false });
    back();
  }, { lastRun });
}

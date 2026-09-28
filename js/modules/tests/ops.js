// L'enregistrement d'un run est le seul écrit du module : il n'a lieu qu'au bouton final d'une passation.
export function addRun(store, testId, metrics, todayKey, { notify = true } = {}) {
  if (!metrics || typeof metrics !== 'object') throw new Error('Métriques manquantes.');
  return store.commit(doc => {
    const run = { id: store.makeId(), ts: store.now(), day: todayKey, test: testId, metrics };
    doc.runs.push(run);
    return run;
  }, { notify });
}

// Lectures pures sur le document Tests.
export function runsOf(doc, testId) {
  return doc.runs.filter(r => r.test === testId).sort((a, b) => a.ts.localeCompare(b.ts));
}

export function lastRun(doc, testId) {
  const runs = runsOf(doc, testId);
  return runs.length ? runs[runs.length - 1] : null;
}

export function history(doc, n = 12) {
  return [...doc.runs].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, n);
}

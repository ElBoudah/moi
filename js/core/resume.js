// Une PWA gardée en mémoire traverse minuit sans recharger : au retour au premier plan,
// si le jour a changé, on prévient pour rerendre sur la bonne date et lancer les backups du jour.
export function watchDayChange({ today, onChange, doc = document }) {
  let lastDay = today();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return;
    const now = today();
    if (now === lastDay) return;
    lastDay = now;
    onChange(now);
  });
}

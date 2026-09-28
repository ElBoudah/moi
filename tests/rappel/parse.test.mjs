import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStructured } from '../../js/modules/rappel/parse.js';

test('collage structuré : titre, contenu multi-lignes, type optionnel, rubrique ignorée', () => {
  const text = `
Titre : Éternel retour
Type : concept
Contenu : Nietzsche propose d'imaginer que chaque instant revient à l'infini.
La question devient : voudrais-tu cela encore une fois ?
Rubrique :
- Le Gai Savoir §341
- test existentiel

---
Titre : Date du Gai Savoir
Type : donnée
Contenu : 1882.
`;
  const out = parseStructured(text);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { title: 'Éternel retour', kind: 'idee', content: "Nietzsche propose d'imaginer que chaque instant revient à l'infini. La question devient : voudrais-tu cela encore une fois ?" });
  assert.deepEqual(out[1], { title: 'Date du Gai Savoir', kind: 'fait', content: '1882.' });
});

test('collage depuis du markdown rendu : clés en ligne, sans Type → fait, sans contenu → ignoré', () => {
  const out = parseStructured('Titre : A Contenu : Un savoir. Titre : B Type : argument Contenu : Une thèse. Titre : C');
  assert.deepEqual(out.map(i => [i.title, i.kind]), [['A', 'fait'], ['B', 'idee']]);
  assert.deepEqual(parseStructured('juste un brain dump sans structure'), []);
});

// Collage structuré (Titre / Type / Contenu / Rubrique) importé sans appel API.
// Tolère les collages depuis du markdown rendu : clés en ligne, puces en *. La rubrique est ignorée.
import { normKind } from './schema.js';

const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KIND_OF = { fait: 'fait', donnee: 'fait', definition: 'fait', idee: 'idee', concept: 'idee', chaine: 'idee', argument: 'idee' };

export function parseStructured(text) {
  const normalized = text.replace(/[ \t]+(Titre|Type|Contenu|Rubrique)[ \t]*:/g, '\n$1 :');
  const items = [];
  let cur = null, mode = null;
  const push = () => { if (cur && cur.title && cur.content) items.push({ title: cur.title, content: cur.content, kind: normKind(cur.kind) }); };
  for (const raw of normalized.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-=_*]{3,}$/.test(line) || /^#{1,6}\s/.test(line)) { mode = null; continue; }
    const kv = line.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
    if (kv) {
      const key = strip(kv[1]), val = kv[2].trim();
      if (key === 'titre') { push(); cur = { title: val, kind: 'fait', content: '' }; mode = null; continue; }
      if (cur && key === 'type') { cur.kind = KIND_OF[strip(val).replace(/[^a-z]/g, '')] ?? 'fait'; mode = null; continue; }
      if (cur && key === 'contenu') { cur.content = val; mode = 'content'; continue; }
      if (cur && key === 'rubrique') { mode = 'rubric'; continue; }
    }
    if (cur && mode === 'rubric' && /^[-·•*]\s+/.test(line)) continue;
    if (cur && mode === 'content') cur.content += (cur.content ? ' ' : '') + line;
  }
  push();
  return items;
}

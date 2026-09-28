// Les trois prompts, en fonctions pures. Deux genres, deux paliers, pas de rubrique, pas de relance.
import { KINDS } from './schema.js';

export const GRADES = [
  { g: 1, key: 'again', label: 'Raté' },
  { g: 2, key: 'hard', label: 'Incomplet' },
  { g: 3, key: 'good', label: 'Bon' },
  { g: 4, key: 'easy', label: 'Acquis' },
];
export const gradeFromVerdict = v => ({ again: 1, hard: 2, good: 3, easy: 4 }[v] || 2);

const KIND_HINT = { fait: 'savoir exact : date, chiffre, nom, définition stricte', idee: 'notion, enchaînement ou thèse à comprendre' };

const QUESTION_MODES = {
  restitution: `- UNE seule question ouverte (jamais de QCM), formulation nouvelle, à réponse COURTE : calibre-la pour être bien traitée en 1 à 4 phrases.
- Pour un fait : rappel précis, en variant la direction d'interrogation d'une fois sur l'autre (de la date vers l'événement ou l'inverse, du terme vers la définition ou l'inverse).
- Pour une idée : définir, distinguer, reconstruire l'enchaînement, exposer la thèse.`,
  explication: `- UNE seule question ouverte d'EXPLICATION ou de CONTREFACTUEL : « pourquoi… », « en quoi… », « que changerait ou perdrait-on si… ».
- La question doit exiger de justifier les mécanismes et les liens, pas de réciter le contenu.`,
};

export function questionPrompt(item, tier) {
  const past = (item.lastQuestions || []).slice(-3);
  return `Tu es le correcteur d'un protocole de rappel actif, en français, exigeant.

FICHE
Genre : ${KINDS[item.kind]} (${KIND_HINT[item.kind]})
Palier : ${tier}
Titre : ${item.title}
Contenu (le savoir lui-même, référence de correction) :
${item.content}
${past.length ? `Questions déjà posées (NE PAS reformuler pareil) :\n${past.map(q => '- ' + q).join('\n')}` : ''}

CONSIGNES
- OBLIGATOIRE : la question nomme son objet dès le début (œuvre et auteur, penseur, période ou domaine) : l'utilisateur passe d'une fiche à l'autre et ne doit jamais deviner de quoi on parle.
${QUESTION_MODES[tier]}

Réponds UNIQUEMENT avec ce JSON : {"question": "..."}`;
}

const GRADE_MODES = {
  fait: `Type d'exercice : RESTITUTION d'un savoir exact. Juge si la réponse est exacte et complète par rapport au contenu de référence.`,
  idee: `Type d'exercice : COMPRÉHENSION. Juge si l'idée est comprise : les mécanismes, distinctions et enchaînements du contenu de référence sont-ils présents et justes ? Un élément cité sans son rôle compte comme imprécis.`,
};

export function gradePrompt(item, question, answer, tier) {
  return `Tu es un correcteur strict dans un protocole de rappel actif, en français. Ne valide jamais une réponse à moitié juste : l'imprécision se signale.

FICHE
Genre : ${KINDS[item.kind]}
Palier : ${tier}
Titre : ${item.title}
Contenu de référence :
${item.content}

${GRADE_MODES[item.kind]}

QUESTION POSÉE
${question}

RÉPONSE DE L'ÉTUDIANT
${answer}

CORRECTION
1. Verdict global :
   - "again" : l'essentiel est absent ou faux
   - "hard" : incomplet ou imprécis sur des points importants
   - "good" : l'essentiel y est, formulé correctement
   - "easy" : complet, précis, maîtrisé
2. Explication en 3 à 5 phrases, ciblée sur CETTE réponse : ce qui manque ou ce qui est faux, pourquoi, et la formulation juste. Corrige le malentendu au lieu de le nommer (« tu as pris X pour Y, or… »). Si la réponse est juste, dis en une phrase ce qui la rend juste.
3. Le contenu de référence est un plancher, pas un plafond : ne pénalise jamais ce que la réponse apporte de juste au-delà.

Réponds UNIQUEMENT avec ce JSON : {"verdict": "again|hard|good|easy", "explication": "..."}`;
}

export function extractPrompt(dump, count) {
  const n = count === 'auto'
    ? `- Le nombre de fiches est libre : une idée = une fiche, préfère moins de fiches plus riches. Ne découpe jamais une même idée en plusieurs fiches. Maximum 8.`
    : `- Produis exactement ${count} fiche${count > 1 ? 's' : ''}.`;
  return `Tu prépares des fiches pour un système de rappel actif, en français.

CE QUE L'UTILISATEUR A ÉCRIT (cela fixe le sujet et ce qui l'a marqué)
${dump}

FICHES
- Chaque fiche a un "title" court, un "content" et un "kind".
- "content" est une réponse complète et autonome de 2 à 4 phrases : c'est la référence de correction future. Reprends les formulations de l'utilisateur quand elles sont justes, complète avec le savoir canonique et bien attesté quand il manque quelque chose. Aucune approximation ni invention : si le sujet est pointu ou peu documenté, fais moins de fiches plutôt que de broder.
- Du socle vers le fin : la définition ou le fait de base d'abord, puis ce qui est plus profond.
- "kind" : "fait" pour un savoir exact (date, chiffre, nom, définition stricte), "idee" pour une notion, un enchaînement ou une thèse à comprendre.
${n}

Réponds UNIQUEMENT avec ce JSON : [{"kind": "fait|idee", "title": "...", "content": "..."}]`;
}

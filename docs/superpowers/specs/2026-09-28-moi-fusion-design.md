# Moi — fusion de Suivi, Mind et Rappel : design

Date : 2026-09-28
Statut : validé en brainstorming, en attente de relecture

## 1. Intention

Une seule application personnelle, téléphone uniquement, qui regroupe en onglets indépendants les trois PWA existantes (Suivi, Mind, Rappel) et en ajoute un (Challenge). Chaque onglet est un instrument à part : pas de lien entre eux, hormis une lecture explicite décrite en 3.6. La structure doit accueillir plus tard d'autres onglets tout aussi indépendants (social, journal) sans toucher aux existants.

Ce que l'app fait : mesurer l'état du jour en une minute, tenir le journal des pulsions sans jugement, tester l'effet d'une activité sur quelques semaines, passer deux tests cognitifs de référence, poser ce qui occupe l'esprit, réviser des savoirs par rappel actif.

## 2. Contraintes et principes

- Téléphone en portrait, PWA statique sur GitHub Pages (`https://elboudah.github.io/moi/`), installable, hors ligne.
- Aucun serveur, aucun compte. Données dans le stockage local du navigateur. Seuls sortent : les appels LLM de Rappel (question, réponse, contenu de la fiche) vers le fournisseur choisi, et le backup chiffré vers un Gist privé.
- Pas d'outillage de build : HTML, CSS et modules JavaScript natifs. `node --test` pour les modules sans DOM, aucune dépendance npm.
- Local-first et confidentialité d'abord : les données sont très personnelles.
- Aucune feature de honte : pas de compteur de jours, pas de série, pas de compteur de retard, pas de rouge hors des teintes sémantiques listées en 8.
- Aucune notification.
- Périmètre fermé : ce document décrit tout ce qui entre dans cette version. Le reste est en 9.
- Identifiants et noms de fonctions en anglais, interface et messages en français.

## 3. Architecture

### 3.1 Fichiers

```
index.html  style.css  manifest.webmanifest  sw.js  icons/  README.md  package.json
js/version.js            export const APP_VERSION = '1.0.0'  (lu par sw.js et Réglages)
js/app.js                point d'entrée : stores, routeur, thème, backup quotidien, rendu
js/router.js             parseRoute / routeHash / navigate / onRoute
js/core/store.js         classe Store générique
js/core/backup.js        export par module, bundle global, chiffrement, Gist, fichier quotidien
js/core/dates.js         today, keyOf, addDays, frLong, frShort, daysBetween, relativeDays, hm
js/core/stats.js         mean, sd, masd, fmt, pm
js/core/ui.js            escapeHtml, openSheet, closeSheet, notice, downloadText, longPress, dayNav
js/core/chart.js         sparkline SVG (échelle 0-10 ou auto, repères verticaux, légende)
js/core/migrate-legacy.js reprise de suivi_v1 et suivi_tests_v1
js/modules/<module>/schema.js     STORAGE_KEY, SCHEMA_VERSION, empty(), validate(), MIGRATIONS
js/modules/<module>/queries.js    lectures pures
js/modules/<module>/views/*.js    render(root, ctx)
js/modules/tests/catalog/         pvt.js, phq8.js, index.js
js/modules/rappel/fsrs.js  parse.js  llm.js  prompts.js
tests/core/*.test.mjs  tests/<module>/*.test.mjs  tests/fixtures/*.mjs
docs/superpowers/specs/  docs/superpowers/plans/
```

Modules : `suivi`, `pulsion`, `challenge`, `tests`, `mind`, `rappel`, `settings`.

### 3.2 Store générique

Repris du store de Mind, paramétré par un descripteur `{ key, version, empty, validate, migrations }`.

- `load()` : clé absente → `empty()` sauvegardé. JSON invalide ou `validate()` en échec → le brut est mis de côté sous `<key>.corrupt`, le store repart de `empty()`. Version antérieure → migrations séquentielles puis sauvegarde.
- `commit(mutator, { notify = true })` : applique, sauvegarde, notifie les abonnés. `notify: false` pour les saisies au blur qui ne doivent pas rerendre.
- `subscribe(fn)` renvoie la fonction de désabonnement. `onSaveError` reçoit un message en cas de stockage plein ou indisponible.
- `exportJson()`, `importJson(text)` (validation, migration, remplacement, notification), `clearCorrupt()`.
- Injection de `now` et `makeId` pour les tests.

Clés : `moi.suivi`, `moi.pulsion`, `moi.challenge`, `moi.tests`, `moi.mind`, `moi.rappel`, `moi.settings`. Toutes les clés de l'app commencent par `moi.` sauf la config cloud (3.5).

### 3.3 Rendu et routage

Une vue est une fonction `render(root, ctx)` avec `ctx = { stores, route, navigate, notice, settings }`. `app.js` tient la route courante, rerend la vue à chaque `hashchange` et à chaque notification du store du module affiché. Le changement de route ferme toute feuille ouverte et remonte en haut de page.

Routes :

```
#/suivi            #/suivi/data
#/pulsion
#/challenge
#/tests            #/tests/run/<testId>
#/mind             #/mind/s/<id>   #/mind/search   #/mind/tree
#/rappel           #/rappel/review   #/rappel/capture   #/rappel/library
#/settings
```

Route vide ou inconnue → `#/suivi`. L'onglet ouvert est donc mémorisé dans l'URL ; au lancement, la PWA rouvre sur `start_url` (`./`), qui redirige vers le dernier onglet mémorisé dans `moi.settings.lastTab`.

### 3.4 Coquille

- Barre d'onglets fixe en bas : Suivi, Pulsion, Challenge, Tests, Mind, Rappel. Texte seul, l'onglet courant en couleur d'accent.
- Icône Réglages en haut à droite de chaque écran d'onglet.
- Composants communs (dans `core/ui.js` et `style.css`) : carte, ligne de liste, curseur ancré, chips, navigateur de jour, feuille glissante depuis le bas, notice éphémère, menu en feuille, bouton principal, bouton discret.

### 3.5 Backup, export, import

Trois couches, une implémentation dans `core/backup.js`.

**Export par module.** Depuis Réglages, un fichier `moi-<module>-AAAA-MM-JJ.json` au format `{ format: "moi-<module>-1", exportedAt, doc }`. Modules exportables : suivi, pulsion, challenge, tests, mind, rappel. Pas d'export de settings.

**Import par module.** Sélection d'un fichier, lecture, vérification que `format` correspond au module visé, `validate()` du module, confirmation « Remplacer toutes les données de <module> ? », remplacement et migration si besoin. En cas d'échec, message explicite et aucune modification.

**Bundle global.** `{ format: "moi-1", exportedAt, modules: { suivi, pulsion, challenge, tests, mind, rappel, settings } }` où `settings` a `llm.apiKey` vidé. Téléchargeable depuis Réglages.

**Fichier quotidien.** Au premier lancement de chaque jour, le bundle est déposé dans Téléchargements sous `moi_AAAA-MM-JJ.json`. Marque : `moi.lastLocalBackup`.

**Cloud.** Le bundle est chiffré côté client (PBKDF2 150 000 itérations SHA-256 → AES-256-GCM, sel et IV aléatoires, enveloppe `{ v: 1, kdf, salt, iv, data }`) et poussé une fois par jour dans le Gist privé, fichier `moi.enc.json`. Push seul, jamais de synchronisation. Marque : `moi.lastCloudBackup` plus un drapeau de session. La config reste dans les clés existantes `cloud_token`, `cloud_pass`, `cloud_gist`, déjà présentes sur cette origine : aucune reconfiguration. Les fichiers `suivi.enc.json`, `mind.enc.json`, `rappel.enc.json` du même Gist ne sont pas touchés.

**Restauration cloud.** Confirmation, téléchargement, déchiffrement, validation de chaque module ; si un seul module est invalide, rien n'est remplacé. Sinon tous les stores sont remplacés, la clé API locale est conservée, la page se recharge.

`navigator.storage.persist()` est demandé au lancement.

### 3.6 Liens entre modules

Un seul, en lecture seule : les courbes de Suivi affichent les repères d'actes de Pulsion (4.1, 4.2). Les bilans hebdo de Suivi et de Pulsion sont séparés. Challenge, Tests, Mind et Rappel ne lisent que leur propre store. Réglages, par nature, lit et écrit tous les stores (export, import, restauration, sujets posés de Mind).

### 3.7 Hors ligne

`sw.js` est enregistré en module (`{ type: 'module' }`) et importe `APP_VERSION` depuis `js/version.js` pour nommer son cache. Precache de tous les fichiers servis, stratégie cache d'abord avec rafraîchissement en arrière-plan, `skipWaiting` et `clients.claim` à l'activation, anciens caches supprimés. À chaque déploiement, on incrémente `APP_VERSION`, un seul endroit.

## 4. Modules

### 4.1 Suivi

**Données.**

```
moi.suivi = { version: 1, days: { "AAAA-MM-JJ": Day } }
Day = { bed: "HH:MM"|null, wake: "HH:MM"|null,
        clarity, mood, pleasure, drive : entier 0..10 | null }
```

Un jour n'existe que s'il a au moins une valeur non nulle.

**Écran `#/suivi`.** Navigateur de jour (jamais après aujourd'hui). Deux blocs :

- *Sommeil* : coucher (hier soir), lever (ce matin), durée calculée modulo 24 h.
- *État du jour* : quatre curseurs 0 à 10, pas de 1, plus haut = mieux, chacun avec trois ancres affichées sous le curseur (0, 5, 10). Curseur vide : valeur affichée « — », poignée au milieu, rien n'est enregistré tant qu'on ne glisse pas.

| Champ | Libellé | 0 | 5 | 10 |
|---|---|---|---|---|
| clarity | Clarté | brouillard, je relis trois fois | fonctionnel mais distractible | net, une tâche à la fois sans effort |
| mood | Humeur | au fond | neutre | léger, envie de rire |
| pleasure | Plaisir | rien ne fait envie ni plaisir | quelques moments agréables | plaisir franc dans ce que j'ai fait |
| drive | Motivation | rien ne démarre | je fais ce qu'il faut | je démarre sans me pousser |

Le glissement ne rerend pas la page : sauvegarde différée de 350 ms, flush immédiat quand la page devient invisible ou se ferme. Les heures se sauvegardent au changement.

Sous-onglet « Données » en haut de l'écran, vers `#/suivi/data`.

**Écran `#/suivi/data`.**

- Bloc 7 derniers jours : jours loggés sur 7, nuits renseignées, durée moyenne ± écart-type, régularité du coucher (écart-type du coucher recentré sur 18 h), et pour chaque curseur moyenne ± écart-type et variation jour à jour (moyenne des écarts absolus entre jours consécutifs).
- Fenêtre 14, 30 ou 90 jours, puis quatre sparklines (clarté, humeur, plaisir, motivation) avec lignes de grille à 0, 5, 10, points si 30 jours ou moins, et repères verticaux aux jours d'actes de Pulsion : rouge « contenu », ambre « sans », vert « partenaire ». Légende sous les courbes. Note fixe : « ± = dispersion. var = variation moyenne d'un jour au suivant : c'est elle qui mesure la stabilité, pas la moyenne. »
- Bouton « Copier le bilan hebdo » : texte des 7 derniers jours (en-tête daté, jours loggés, sommeil, quatre lignes de curseurs), sans événements ni pulsion.

**Lectures pures** (`queries.js`) : `stats(doc, window, today)`, `bilan(doc, today)`, `durMin`, `bedShift`.

### 4.2 Pulsion

**Données.**

```
moi.pulsion = { version: 1,
  days: { "AAAA-MM-JJ": { urge: 0..10|null, checksMin: entier|null } },
  events: [{ id, day: "AAAA-MM-JJ", ts: ISO, nature: "contenu"|"sans"|"partenaire", trigger: string|null }] }
```

`day` est le jour choisi pour l'acte, `ts` l'horodatage de saisie. Un événement « partenaire » a `trigger` null. Les événements sont append-only depuis l'interface (pas de modification ni de suppression).

**Écran `#/pulsion`, de haut en bas.**

1. *Protocole 10 minutes* : carte fixe, trois étapes et la définition de « contenu » fixée à froid, textes repris de l'app actuelle.
2. *Aujourd'hui* : navigateur de jour partagé avec Suivi (même composant, état indépendant). Curseur « Pression de l'envie » avec ancres 0 « aucune », 5 « présente, je peux faire autre chose », 10 « envahissante, je ne pense qu'à ça ». Chips « Checks, contenu vu sans acte » : 0, 5, 10, 20, 30, 60 minutes plus saisie libre.
3. *Enregistrer un acte* : trois boutons de nature. Écran intermédiaire : pour « contenu » et « sans », choix du déclencheur (Fatigue, Ennui, Seul le soir, Stress / conflit, Sans raison claire, Autre) ; pour toutes les natures, choix du jour (chips « Aujourd'hui », « Hier », et un champ date limité au passé), puis Enregistrer ou Annuler. Jamais de log en un seul tap. Après enregistrement, message fixe : pour « contenu », le texte actuel sans procès ; sinon « Enregistré. »
4. *Données* : fenêtre 14, 30 ou 90 jours, sparkline de la pression avec repères d'actes, bloc 7 jours (pression moyenne ± écart-type, soirs à 4 ou plus, checks en minutes et jours concernés, actes par nature avec date et déclencheur), liste des huit derniers actes. Bouton « Copier le bilan pulsion » : texte des 7 derniers jours.

**Lectures pures** : `stats`, `bilan`, `marks(doc)` (jour → nature la plus lourde, contenu > sans > partenaire), `lastEvents`.

### 4.3 Challenge

Un seul challenge actif à la fois. Le module enregistre, il n'analyse pas : l'analyse se fait à partir des exports.

**Données.**

```
moi.challenge = { version: 1, challenges: [{
  id, title, target: { daily: true } | { perWeek: 1..7 },
  startDay: "AAAA-MM-JJ", days: 14|30|60,
  endedAt: ISO|null, done: { "AAAA-MM-JJ": true } }] }
```

Un challenge est actif si `endedAt` est null et que `startDay + days` est après aujourd'hui. Quand la période est écoulée, il se clôt automatiquement au chargement (`endedAt` = fin de période).

**Écran `#/challenge`, challenge actif.** Titre, « jour N sur M », cible (« tous les jours » ou « 3 fois par semaine ») et compte de la semaine en cours (lundi à dimanche). Un gros bouton « Fait aujourd'hui », qui s'annule d'un second tap. Une bande de M cases, une par jour : fait, pas fait, à venir ; un tap sur une case passée la bascule, ce qui permet de rattraper un oubli. Un bouton discret « Arrêter » clôt avant terme après confirmation, tout est conservé. Aucun compteur de retard, aucune série.

**Écran, aucun challenge actif.** Formulaire : titre, cible (chips « tous les jours » ou « N fois par semaine » avec N de 1 à 7), durée (14, 30, 60), début aujourd'hui. Puis la liste des challenges passés : titre, période, jours faits sur jours de la période. Un tap ouvre la bande de cases en lecture seule.

**Lectures pures** : `active(doc, today)`, `weekCount`, `dayStrip`.

### 4.4 Tests

**Données.**

```
moi.tests = { version: 1, runs: [{ id, ts: ISO, day: "AAAA-MM-JJ", test: string, metrics: object }] }
```

**Catalogue enfichable.** `catalog/index.js` exporte la liste des tests proposés ; chaque test est un fichier exportant :

```
{ id, label, subtitle,                      // "3 min · hebdomadaire"
  run(stage, onDone),                       // pilote l'écran plein, appelle onDone(metrics) ou rien si abandon
  summary(run) -> string,                   // ligne d'historique
  chart: { title, value(run) -> number|null } }
```

`stage` expose `title(text)`, `timer(text)`, `body(html)`, `onQuit(fn)`. Retirer un test = retirer une ligne de l'index ; en ajouter = un fichier.

**Tests au départ.**

- *PVT-B* : 3 minutes, intervalle aléatoire 1 à 4 s, tap sur tout l'écran, faux départ si avant stimulus ou sous 100 ms, lapse au-dessus de 355 ms. Métriques : n, médiane, moyenne, lapses, faux départs, vitesse moyenne 1/RT. Courbe : médiane, plus bas = mieux.
- *PHQ-8* : 8 items, 4 réponses de 0 à 3, question précédente possible, score sur 24, bande de sévérité (minimal, léger, modéré, modérément sévère, sévère), avertissement si la dernière passation date de moins de 14 jours, phrase pour un score de 15 ou plus (« un chiffre à montrer à un médecin »). Métriques : score, bande, items. Courbe : score, plus bas = mieux.

**Libellés de repli** pour les runs historiques hors catalogue (`span`, `corsi`, `sdmt`, `fluence`) : ils apparaissent dans l'historique avec leur résumé, sans carte ni courbe.

**Écran `#/tests`.** Note fixe en tête (instruments de mesure, même créneau, tendance seule). Une carte par test du catalogue : nom, sous-titre, « Dernier : <date> <heure> — <résumé> » ou « Jamais lancé », courbe à partir du deuxième run (échelle automatique sur l'étendue, marge de 18 %, dates de début et de fin, étendue min–max), bouton Lancer. Puis l'historique des douze derniers runs tous tests confondus. Aucun rappel « à faire ».

**Écran `#/tests/run/<id>`.** Plein écran : libellé, minuteur ou progression, bouton Quitter. Sortir par le bouton retour du téléphone ou Quitter appelle le nettoyage du test (timers, écouteurs) et n'enregistre rien. L'enregistrement n'a lieu qu'au bouton « Enregistrer » de l'écran de résultat, puis retour à `#/tests`.

### 4.5 Mind

Reprise de la V1 telle que spécifiée dans `mind/docs/superpowers/specs/2026-09-20-tableau-de-bord-esprit-design.md` et implémentée, avec les différences suivantes :

- Clé `moi.mind`, store générique de 3.2, schéma inchangé (`{ version: 1, subjects, entries }`, types d'entrée `thought`, `decision`, `action`, `weight`).
- Aucun thème de départ : le document vide n'a ni sujet ni entrée. L'accueil sans thème affiche une ligne d'invitation et le bouton +. Le formulaire de nouveau sujet accepte « à la racine » comme parent.
- Routes préfixées : `#/mind`, `#/mind/s/<id>`, `#/mind/search`, `#/mind/tree`. Le pied de page de l'accueil garde ses trois icônes (vue d'ensemble, recherche, réglages) ; l'icône réglages mène aux Réglages globaux, section « Sujets posés » comprise.
- Export, import, cloud et thème sortent de Mind vers Réglages.
- Styles fondus dans le système commun (8).
- Une seule entrée de poids par jour et par sujet, journal agrégé du sous-arbre, conservés.

Les 40 tests existants sont repris et adaptés aux nouveaux chemins.

### 4.6 Rappel

**Données.**

```
moi.rappel = { version: 1, items: [{
  id, title, content, kind: "fait"|"idee",
  createdAt: ms, lastReview: ms|null, S: number|null, D: number|null,
  reps: entier, lapses: entier, lastQuestions: string[] (3 max) }] }
```

**Ordonnanceur.** FSRS repris tel quel (`fsrs.js` : poids par défaut, rétention 0,9, `applyReview`, `retrievability`, `intervalDays`). Fiches dues : révisées et rétrievabilité ≤ 0,9, triées par rétrievabilité croissante. Nouvelles : jamais révisées, par date de création. Aucun cap.

**Paliers.** `restitution` pour toute fiche ; `explication` pour une fiche `idee` révisée dont S ≥ 7 jours. Rien d'autre.

**Écran `#/rappel`.** « N dues · M nouvelles ». Bouton « Réviser » si N + M > 0, qui ouvre `#/rappel/review` sur la file dues puis nouvelles. Si N = 0 et qu'il existe des fiches révisées : bouton « Réviser quand même », qui ouvre la file de toutes les fiches révisées triées par rétrievabilité croissante. Bibliothèque vide : invitation vers Capturer. Sous-onglets en haut : Réviser, Capturer, Bibliothèque.

**Écran `#/rappel/review`.** Une fiche à la fois, en-tête : genre, palier ou « premier passage », position dans la file, bouton « Arrêter ». Phases : chargement de la question (la question de la fiche suivante se précharge pendant la rédaction), réponse (zone de texte, bouton « Corriger ma réponse »), correction, retour. Le retour affiche : verdict (Raté, Incomplet, Bon, Acquis) en tampon, l'explication du modèle, les quatre boutons de verdict pour ajuster, « prochain passage dans ~N j » recalculé sur le verdict choisi, bouton « Valider ». La validation applique FSRS, ajoute la question aux trois dernières, sauvegarde immédiatement, passe à la suivante. Arrêter à tout moment ne perd rien. Fin de file : « Terminé » et retour. Erreur réseau : message, Réessayer, Arrêter.

**Prompts** (`prompts.js`, fonctions pures testées).

- *Question* : rôle de correcteur exigeant en français ; la fiche (genre, titre, contenu) ; les questions déjà posées à ne pas reformuler ; règle de contexte (la question nomme son objet dès le début) ; une seule question ouverte, jamais de QCM. Palier restitution : réponse courte attendue, pour un fait varier la direction (de la date vers l'événement ou l'inverse). Palier explication : « pourquoi », « en quoi », « que changerait… si », exiger les mécanismes, pas la récitation. Sortie `{"question": "..."}`.
- *Correction* : la fiche, la question, la réponse. Pour un fait : la restitution est-elle exacte et complète par rapport au contenu ; pour une idée : l'idée est-elle comprise, mécanismes et distinctions compris. Verdict `again|hard|good|easy`. Explication en 3 à 5 phrases, ciblée sur la réponse : ce qui manque ou ce qui est faux, pourquoi, et la formulation juste ; corriger le malentendu plutôt que le nommer. Ne jamais pénaliser ce que la réponse apporte de juste au-delà du contenu. Sortie `{"verdict": "...", "explication": "..."}`.
- *Extraction* : le dump, le nombre demandé (auto ou N). Le dump fixe le sujet et ce qui a marqué ; chaque fiche a un contenu complet et autonome de 2 à 4 phrases, formulé à partir des mots du dump quand ils sont justes, complété par le savoir canonique et bien attesté sinon ; du socle vers le fin (définition d'abord) ; en auto, une idée = une fiche, préférer moins de fiches plus riches. Genre proposé par le modèle. Sortie `[{"kind": "fait|idee", "title": "...", "content": "..."}]`.

**Écran `#/rappel/capture`.** Une zone de texte. Au-dessus du bouton, chips « auto, 1, 3, 5, 8 ». Bouton « Extraire » actif dès 2 caractères. Un collage structuré (lignes `Titre :` / `Contenu :`, `Type :` optionnel converti : fait, donnée, définition → fait, sinon idée ; les lignes `Rubrique :` et leurs puces sont ignorées) est importé sans appel. Lien discret « ou ajouter une fiche à la main ». Le texte reste en place après extraction, pour relancer avec un autre nombre. Relecture : liste des propositions, chacune avec case cochée, genre, titre et contenu modifiables ; bouton « Ajouter N fiches ». Une fiche ajoutée est neuve pour FSRS.

**Écran `#/rappel/library`.** « N fiches, de la plus urgente à la plus solide ». Une ligne par fiche : genre, titre, et à droite « nouveau » ou « R 74 % · S 12 j ». Un tap déplie : contenu, passages, oublis, dernier passage, boutons Modifier (titre, contenu, genre) et Supprimer (confirmation en deux taps).

**Couche LLM.** `llm.js` reprend `fetchJSON` avec retries sur 429, 503, 529, les presets (Gemini, Mistral, Groq, Anthropic, autre OpenAI-compatible), le chemin Anthropic et le chemin OpenAI-compatible, `extractJSON`, `humanError`. Les réglages viennent du store settings.

### 4.7 Settings

```
moi.settings = { version: 1, theme: "system"|"light"|"dark", lastTab: string,
  llm: { provider, apiKey, model, baseUrl } }
```

**Écran `#/settings`.**

- Apparence : Système, Clair, Sombre.
- Fournisseur LLM : fournisseur, clé (champ masqué), modèle, URL de base si « autre ». Bouton Enregistrer. Note : la clé reste sur cet appareil et n'est envoyée qu'au fournisseur.
- Données : une ligne par module (suivi, pulsion, challenge, tests, mind, rappel) avec Exporter et Importer.
- Backup : Configurer le cloud (demande token et passphrase si absents, puis pousse), Restaurer depuis le cloud, état (« cloud ✓ dernier push <date> », « configuré, pas encore de push », « non configuré »), Télécharger le bundle complet.
- Sujets posés de Mind : liste, un tap ouvre la fiche.
- Reprise des données Suivi : visible si `suivi_v1` ou `suivi_tests_v1` existent ; relance la migration de 5 après confirmation « Remplacer Suivi, Pulsion et Tests par les anciennes données ? ».
- Données illisibles : pour chaque store ayant une clé `.corrupt`, Télécharger et Oublier.
- « Moi <APP_VERSION> ».

## 5. Reprise des données existantes

Au lancement, si aucune clé `moi.suivi`, `moi.pulsion`, `moi.tests` n'existe et que `suivi_v1` ou `suivi_tests_v1` existe :

- `suivi_v1.days[k]` → `moi.suivi.days[k] = { bed, wake, clarity, mood, pleasure: null, drive: elan }` si l'un de ces champs est non nul ; → `moi.pulsion.days[k] = { urge, checksMin }` si l'un des deux est non nul. Les champs sleepQ, cardioMin, readMin, medMin, focusMin, checks hérités, acts, note, cardio, focus, sleep ne sont pas repris.
- `suivi_v1.events` → `moi.pulsion.events`, nature calculée comme aujourd'hui (`nature`, sinon `type` rechute → contenu, solo → sans ; resistee abandonné), `id`, `day`, `ts`, `trigger` conservés.
- `suivi_tests_v1.runs` → `moi.tests.runs` par copie.
- Notice « Données Suivi reprises ». Les anciennes clés ne sont jamais effacées.

Mind et Rappel démarrent vides. Les clés `mind.doc`, `rappel-items-v1`, `rappel-settings-v1` sont ignorées.

## 6. Tests automatiques

`npm test` lance `node --test tests/`. Aucune dépendance. Le stockage est remplacé par un adaptateur en mémoire, `now` et `makeId` sont injectés.

Couverts au minimum :

- core : store (vide, validation, corruption mise de côté, migration, abonnement, erreur de sauvegarde, import), dates, stats, chart (chemin SVG sur série avec trous), backup (bundle sans clé API, validation d'un bundle, format d'export par module), migrate-legacy (jours, événements, runs, cas vides).
- suivi : stats sur 7 jours et sur fenêtre, bilan, durée et décalage de coucher.
- pulsion : stats, repères par jour (nature la plus lourde), bilan, événement daté dans le passé.
- challenge : actif ou non selon la date, clôture automatique, compte de la semaine, bande de cases, un seul actif.
- tests : résumés et courbes de PVT et PHQ-8, libellés de repli, bande PHQ-8, avertissement de recouvrement.
- mind : les 40 tests existants.
- rappel : FSRS (état initial, révision, oubli, intervalle), file dues puis nouvelles, « réviser quand même », paliers, parseur structuré (Type, Rubrique ignorée, collage markdown), prompts (contenu attendu selon genre et palier, nombre demandé), extraction du JSON de réponse.

Les vues sont vérifiées à la main sur téléphone.

## 7. Déploiement

Dépôt `ElBoudah/moi`, GitHub Pages depuis la racine de `main`. Tous les chemins sont relatifs (`./`). Identité git locale ElBoudah. À chaque déploiement : incrémenter `APP_VERSION`, `npm test`, commit en français, push. Les trois anciens dépôts restent en ligne jusqu'à vérification de la reprise des données, puis sont archivés.

## 8. Apparence

Système de Mind étendu à toute l'app :

- Variables clair et sombre, thème système par défaut, `color-scheme`.
- Typographie système, 17 px de base, interligne aéré, beaucoup de marge. Le texte de la question de Rappel en 1,25 rem.
- Une couleur d'accent pour les points de poids, les cases, les boutons principaux, l'onglet courant, les courbes de Suivi (une variante par curseur, dérivée de la palette actuelle de Suivi : sarcelle, bleu, violet, ambre).
- Teintes sémantiques, seules exceptions : les trois natures de Pulsion (rouge, ambre, vert), les quatre verdicts de Rappel. Aucun rouge ailleurs.
- Aucune animation hors l'apparition de la feuille glissante.

## 9. Hors périmètre

- Onglet social (fiches par relation, cercles, nouvelles rencontres).
- Onglet journal.
- Mind en mode TCC (pensée examinée, faits pour et contre, reformulation).
- Bilan de challenge (ligne de base contre période) et bande de challenge sur les courbes.
- Sonde d'attention en lecture, tests supplémentaires (GAD-7, Kirby, empan, Corsi).
- Génération de fiches Rappel depuis un sujet seul, champ source, rubriques, relance, palier transfert.
- Synchronisation deux sens, notifications, gamification.

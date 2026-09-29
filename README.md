# Moi

Une application personnelle, téléphone uniquement, qui regroupe des instruments indépendants :
Suivi (sommeil avec endormissement et réveils, état du jour, note), Pulsion (protocole, envies sur le vif, actes), Tests (PVT-B et PHQ-8), Mind (poser ce qui occupe l'esprit), Rappel (fiches de savoir révisées par rappel actif, questions et corrections par un LLM).
Rien ne quitte le téléphone, hormis le backup chiffré vers un Gist privé et, pour Rappel, les appels au fournisseur LLM choisi.

Design : `docs/superpowers/specs/2026-09-28-moi-fusion-design.md`

## Utiliser

Ouvrir https://elboudah.github.io/moi/ sur le téléphone, puis « Ajouter à l'écran d'accueil ».
Au premier lancement sur un téléphone qui avait l'ancienne app Suivi, ses données sont reprises automatiquement.

Rappel a besoin d'une clé API : Réglages → Fournisseur LLM (Gemini gratuit sur https://aistudio.google.com/app/apikey). La clé reste sur le téléphone ; seuls la fiche, la question et ta réponse partent vers le fournisseur.

## Développer

Aucune dépendance. Servir le dossier :

    python3 -m http.server 8080

Tests (Node 24) :

    npm test

## Déployer

Le site est servi par GitHub Pages depuis la racine de la branche `main`.
À chaque changement de fichier servi : incrémenter `APP_VERSION` dans `js/version.js`, ajouter les nouveaux fichiers à `ASSETS` dans `sw.js`, `npm test`, commit, push.

## Sauvegarder ses données

Réglages → Données : un export par module, réimportable dans le même module.
Réglages → Backup : bundle complet téléchargeable ; push quotidien chiffré vers le Gist configuré ; restauration depuis le cloud.
Un fichier `moi_AAAA-MM-JJ.json` est aussi déposé dans Téléchargements au premier lancement de chaque jour.
La clé API LLM n'entre dans aucun backup.

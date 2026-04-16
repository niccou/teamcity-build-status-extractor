# TeamCity Build Status Extractor

Extension navigateur (Firefox/Chrome compatible API) qui récupère le statut d’un build TeamCity depuis la page ouverte et copie un résumé prêt à coller (ex: dans Microsoft Teams).

## Objectif

Quand vous êtes sur la page d’un build TeamCity, l’extension :

1. lit l’ID du build depuis l’URL,
2. appelle l’API REST TeamCity pour récupérer le statut et les résultats de tests,
3. construit un message lisible,
4. copie ce message dans le presse-papier.

---

## Fonctionnalités

- Extraction de l’ID du build depuis l’URL active.
- Récupération des données build via `app/rest/builds/{id}`.
- Récupération des tests en échec via `app/rest/testOccurrences`.
- Formatage d’un message texte avec :
  - nom du build,
  - numéro de build,
  - branche,
  - statut global,
  - compteurs de tests (passés / échoués / ignorés),
  - liste des tests en échec.
- Copie en un clic dans le presse-papier.

---

## Prérequis

- Accès à une instance TeamCity.
- Être connecté à TeamCity dans le navigateur (la requête utilise les cookies de session).
- Ouvrir une page TeamCity dont l’URL se termine par un identifiant numérique de build.

Exemple d’URL compatible :

`https://teamcity.exemple.com/buildConfiguration/MonBuild/12345`

---

## Installation

> Le projet ne contient pas de phase de build : l’extension est chargée telle quelle.

### Firefox (temporaire, mode développeur)

1. Ouvrir Firefox.
2. Aller sur `about:debugging#/runtime/this-firefox`.
3. Cliquer sur **Charger un module complémentaire temporaire**.
4. Sélectionner le fichier :
   - `manifest.json`
   - chemin :  
     `<project-directory>/manifest.json`

### Chrome / Chromium (mode développeur)

1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Sélectionner le dossier du projet :  
   `<project-directory>`

---

## Utilisation

1. Ouvrir une page de build TeamCity avec un ID numérique dans l’URL.
2. Cliquer sur l’icône de l’extension.
3. Cliquer sur **Copier le résultat de build**.
4. Coller le contenu dans Teams, Slack, e-mail, etc.

Si tout se passe bien, la popup se ferme automatiquement après la copie.

---

## Format du message copié

Le message généré ressemble à ceci :

```text
Build: NomDuBuild (#12345)
Branche: refs/heads/main
Statut: SUCCESS
Tests: ✅ 120 | ❌ 2 | ⏭ 1

Tests en échec:
- MonTestQuiEchoue
- UnAutreTest
```

---

## Fonctionnement technique (détail)

### 1) Popup (`popup.html` + `popup.js`)

- Affiche un bouton unique : **Copier le résultat de build**.
- Au clic :
  1. récupère l’onglet actif,
  2. injecte `content.js` dans la page,
  3. envoie un message `extractTeamCityBuildStatus`,
  4. reçoit le résultat `{ ok, text | error }`,
  5. copie le texte via `document.execCommand('copy')`.

### 2) Script de contenu (`content.js`)

- Enregistre un listener de message (avec garde anti double-enregistrement).
- Extrait le `buildId` depuis l’URL courante.
- Construit deux endpoints TeamCity :
  - build principal :  
    `/app/rest/builds/{buildId}?fields=id,status,branchName,buildType(name),testOccurrences(passed,failed,ignored)`
  - tests en échec :  
    `/app/rest/testOccurrences?locator=build:(id:{buildId}),status:FAILURE&fields=testOccurrence(name)&count=100`
- Fait les deux requêtes en parallèle (`Promise.all`), avec `credentials: 'include'`.
- Parse les réponses XML (`DOMParser`).
- Formate le message final, puis renvoie `sendResponse`.

### 3) Permissions (`manifest.json`)

- `activeTab` : agir sur l’onglet actif.
- `clipboardWrite` : copier le texte dans le presse-papier.

---

## Gestion des erreurs

Des messages d’erreur sont remontés si :

- aucun onglet actif n’est trouvé,
- l’URL ne contient pas d’ID de build numérique,
- une requête TeamCity échoue (statut HTTP non OK),
- la copie dans le presse-papier échoue.

Dans ces cas, une alerte est affichée à l’utilisateur.

---

## Limites connues

- Le parse d’URL repose sur un identifiant numérique en fin d’URL.
- Le nombre de tests en échec récupérés est limité à 100 (`count=100`).
- `manifest_version: 2` est utilisé (legacy) : le support dépend du navigateur (ex: restrictions fortes côté Chrome/Chromium, support encore présent côté Firefox), la migration vers Manifest V3 doit donc être considérée comme nécessaire.
- La copie repose actuellement sur `document.execCommand('copy')` (implémentation de `popup.js`), API historique et dépréciée ; la cible recommandée est l’API Clipboard moderne (`navigator.clipboard`).

---

## Structure du projet

- `manifest.json` : manifeste de l’extension.
- `popup.html` : interface popup.
- `popup.js` : logique côté popup (injection + copie).
- `content.js` : logique d’extraction TeamCity côté page.
- `icon-48.png` : icône extension.

---

## Développement local

Il n’y a pas de dépendances Node/Python ni de pipeline lint/test dans ce dépôt.
Le cycle de développement est :

1. modifier les fichiers source,
2. recharger l’extension dans le navigateur,
3. tester sur une page TeamCity réelle.

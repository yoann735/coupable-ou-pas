# ⚖️ Coupable ou pas coupable ?

Jeu de société multijoueur en ligne, façon Jackbox : **un hôte crée une partie, reçoit un
code à 4 lettres, et ses amis rejoignent depuis leur propre téléphone**. L'appli sert
d'arbitre et d'affichage — la défense, elle, se plaide à l'oral.

> Les joueurs sont dans la même pièce (ou en appel vocal). L'appli gère les rôles, le tirage
> au sort, le minuteur, les votes et les points.

## Le jeu en une minute

À chaque manche :

1. **Accusation** — une carte est tirée (« Tu as mangé tous les gâteaux de la fête »), et
   l'accusateur du tour est annoncé. Le rôle tourne dans l'ordre d'arrivée.
2. **Tirage de l'accusé** — le serveur désigne l'accusé au hasard parmi tous les joueurs
   *sauf* l'accusateur. Personne ne choisit sa victime.
3. **Défense** — l'accusé pioche 3 mots (crayon, tiramisu, micro-ondes…) et a 2 minutes
   pour se défendre **à l'oral** en les plaçant tous. Il coche chaque mot sur son écran ;
   tout le monde voit les coches en direct.
4. **Vérification** — s'il manque un mot : **coupable direct**, pas de vote.
5. **Vote** — chaque juré (ni accusateur ni accusé) vote Coupable / Non coupable. Les votes
   restent secrets jusqu'au dépouillement. **Égalité = non coupable** (bénéfice du doute).
6. **Résultat** — verdict, points, manche suivante.

### Les points

| Situation | Qui marque |
| --- | --- |
| Verdict **non coupable** | l'accusé : **+1** (belle défense) |
| Verdict **coupable** | l'accusateur : **+1** (piège réussi) |
| **Coupable direct** (mots non placés) | l'accusateur : **+1** |
| Vote conforme à la majorité | chaque juré concerné : **+1** |

La partie s'arrête quand chaque joueur a été accusateur *N* fois (réglable de 1 à 5 dans le
salon), puis affiche le classement final.

## Démarrer en local

Prérequis : **Node.js 20+**.

```bash
npm install
npm run dev
```

- Client : http://localhost:5173
- Serveur : http://localhost:3001

`npm run dev` lance les deux d'un coup. Le client est configuré avec `host: true` : Vite
affiche aussi une adresse réseau (`http://192.168.x.x:5173`) — **c'est celle-ci qu'il faut
ouvrir sur les téléphones du même wifi** pour tester à plusieurs pour de vrai.

### Tester sans réunir 4 personnes

Des bots peuvent remplir la partie et jouer tout seuls :

```bash
# 1. crée une partie dans le navigateur, note le code (ex. PLUM)
npm run bots -- PLUM        # 3 bots rejoignent et jouent
npm run bots -- PLUM 5      # 5 bots
BOTS_LENT=1 npm run bots -- PLUM   # les bots ne coupent pas court à la défense
```

### Tests automatisés

Une partie complète à 4 joueurs est rejouée de bout en bout (rôles, tirage, mots,
votes, égalités, points, déconnexions, reconnexion, transfert d'hôte, codes uniques) :

```bash
npm run test:serveur    # dans un terminal (serveur avec des phases accélérées)
npm test                # dans un autre
```

## Structure

```
.
├── shared/types.ts        # types + protocole Socket.IO partagés client/serveur
├── server/
│   └── src/
│       ├── index.ts       # HTTP + Socket.IO, sert le client en production
│       ├── data/cards.ts  # 68 accusations + 102 objets (facile à compléter)
│       └── game/
│           ├── engine.ts  # machine à états, scoring, timers, déconnexions
│           └── utils.ts   # code à 4 lettres, mélange, nettoyage des entrées
├── client/                # React + Vite + TypeScript + Tailwind (mobile-first)
│   └── src/
│       ├── lib/           # socket, contexte de jeu, sons (WebAudio, sans fichiers)
│       ├── components/    # boutons, jetons joueurs, minuteur, confettis
│       └── screens/       # Accueil, Salon, Accusation, Tirage, Défense, Vote, Résultat, Fin
└── tests/                 # test de bout en bout + bots
```

**Règle d'or :** le serveur est l'unique source de vérité. À chaque changement il diffuse
l'état complet (`etat_partie`) à toute la room ; le client ne fait qu'afficher. Aucune règle
n'est implémentée côté client.

### Protocole Socket.IO

| Client → Serveur | |
| --- | --- |
| `creer_partie`, `rejoindre_partie` | avec accusé de réception (code + identifiant joueur) |
| `maj_reglages`, `ajouter_carte`, `supprimer_carte` | salon |
| `lancer_partie`, `manche_suivante`, `rejouer` | hôte |
| `cocher_mot`, `terminer_defense`, `voter`, `quitter_partie` | en jeu |

| Serveur → Clients | |
| --- | --- |
| `etat_partie` | l'état complet de la partie (source de vérité) |
| `erreur` | code invalide, partie pleine, pas assez de joueurs… |
| `fx` | déclencheurs de sons / animations (aucune logique) |

L'état contient `serverNow`, ce qui permet à chaque client de corriger son décalage
d'horloge : les minuteurs sont donc identiques sur tous les écrans.

## Cas limites gérés

- **Moins de 4 joueurs** : lancement bloqué, message explicite.
- **Déconnexion en cours de partie** : le joueur passe en `connected: false`, garde son
  score et sa place ; s'il était accusé (avant/pendant sa défense) un nouvel accusé est
  tiré au sort ; s'il était accusateur avant la défense, le rôle passe au suivant.
- **Reconnexion** : le code et l'identifiant sont stockés en `localStorage` ; après un
  refresh (ou avec le même pseudo depuis un autre appareil) le joueur retrouve sa place.
- **L'hôte quitte** : le rôle est transféré au joueur connecté suivant.
- **Vote incomplet** : dépouillement automatique au bout de 30 s avec les votes reçus.
- **Aucun juré** (0 restant) : verdict « non coupable » par défaut.
- **Deck épuisé** : les cartes sont remélangées.
- **Codes** : 4 lettres, sans I/O (ni 0/1), jamais deux parties avec le même code.
- **Partie vide** : supprimée de la mémoire au bout de 20 minutes sans personne.

## Réglages (variables d'environnement, serveur)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3001` | port d'écoute |
| `CORS_ORIGIN` | `*` | origine autorisée pour Socket.IO |
| `DUREE_ACCUSATION_MS` | `5000` | écran d'accusation |
| `DUREE_TIRAGE_MS` | `5200` | animation du tirage |
| `DUREE_VOTE_MS` | `30000` | limite de vote |
| `DUREE_RESULTAT_MS` | `20000` | avant la manche suivante |

## Déploiement

L'état des parties vit **en mémoire**, et les manches avancent avec des minuteurs
dans le processus : il faut donc **un serveur Node permanent et unique**.

> ⚠️ **Pourquoi pas le serveur sur Vercel ?** Vercel sait servir du Socket.IO, mais
> la doc est explicite : *« New WebSocket connections are not guaranteed to reach the
> same Vercel Function instance »* et *« WebSocket connections close when a Vercel
> Function reaches its maximum duration »* (300 s en Hobby). Une partie dure 10 à
> 20 minutes : elle casserait en plein milieu. Le client, lui, est un pur build
> statique et va très bien sur Vercel.

### 1. Le serveur temps réel sur Render

Le dépôt contient un blueprint `render.yaml`. Sur [render.com](https://render.com) :
**New → Blueprint → choisir ce dépôt → Apply**. Rien d'autre à régler.

Le build compile aussi le client : **l'URL Render sert donc le jeu complet à elle
seule** (`https://coupable-ou-pas.onrender.com`). Vercel n'est qu'une couche CDN
en plus.

Le plan gratuit met le service en veille après 15 minutes d'inactivité : la
première connexion peut mettre ~50 s à réveiller le serveur.

Railway et Fly.io fonctionnent aussi : build `npm install && npm run build`,
démarrage `npm start`, et c'est tout.

### 2. Le client sur Vercel

Le projet Vercel utilise `vercel.json` (framework Vite, sortie `client/dist`).
L'URL du serveur y est déjà inscrite :

```json
"build": { "env": { "VITE_SERVER_URL": "https://coupable-ou-pas.onrender.com" } }
```

Elle est figée **au moment du build** (comportement de Vite) : si tu changes de
serveur, modifie cette ligne et repousse — inutile de passer par le dashboard.
Sans cette variable, le client parle au serveur qui lui a servi la page, ce qui
est exactement le comportement voulu pour le déploiement Render tout-en-un.

Côté serveur, `CORS_ORIGIN` peut être restreint au domaine Vercel une fois celui-ci
connu (par défaut `*`).

## Personnaliser les cartes

- **Durablement** : ajoutez vos phrases dans `server/src/data/cards.ts` (deux tableaux de
  chaînes, rien d'autre à toucher).
- **Le temps d'une partie** : dans le salon, section « Cartes personnalisées » — les cartes
  ajoutées se mélangent au deck de base pour cette partie seulement.

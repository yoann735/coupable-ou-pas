import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ErreurPayload,
  GameState,
  Phase,
  Player,
  RoundPublic,
  ServerToClientEvents,
  Settings,
  Vote,
} from '../../../shared/types';
import { MAX_JOUEURS, MAX_PSEUDO, MIN_JOUEURS } from '../../../shared/types';
import { ACCUSATIONS, OBJETS } from '../data/cards';
import { auHasard, genererCode, melanger, nettoyerPseudo, nettoyerTexteCarte, nouvelId } from './utils';

// ---------------------------------------------------------------------------
// Durées des phases (ms)
// ---------------------------------------------------------------------------
const ms = (cle: string, defaut: number) => {
  const v = Number(process.env[cle]);
  return Number.isFinite(v) && v > 0 ? v : defaut;
};

export const DUREE_ACCUSATION = ms('DUREE_ACCUSATION_MS', 5000);
export const DUREE_TIRAGE = ms('DUREE_TIRAGE_MS', 5200);
export const DUREE_VOTE = ms('DUREE_VOTE_MS', 30000);
export const DUREE_RESULTAT = ms('DUREE_RESULTAT_MS', 20000);

const MAX_LONGUEUR_CARTE = 120;
/** Une partie sans aucun joueur connecté est supprimée après ce délai. */
const TTL_PARTIE_VIDE_MS = 20 * 60 * 1000;

// ---------------------------------------------------------------------------
// Modèle serveur
// ---------------------------------------------------------------------------
interface ServerRound {
  numero: number;
  accusateurId: string;
  accuseId: string | null;
  carteAccusation: string;
  cartesObjet: string[];
  motsUtilises: boolean[];
  votes: Record<string, Vote>;
  juresIds: string[];
  verdict: Vote | null;
  coupableDirect: boolean;
  finTimer: number | null;
  pointsGagnes: Record<string, number>;
  votesReveles: boolean;
}

export interface ServerGame {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  settings: Settings;
  round: ServerRound | null;
  usedAccusationCards: string[];
  usedObjectCards: string[];
  cartesPerso: { accusations: string[]; objets: string[] };
  /** Index dans `players` du dernier accusateur (rotation dans l'ordre d'arrivée). */
  accusateurIndex: number;
  mancheCourante: number;
  totalManches: number;
  timer: NodeJS.Timeout | null;
  derniereActivite: number;
  videDepuis: number | null;
}

export const parties = new Map<string, ServerGame>();

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
let io: IO;

export function initEngine(serveur: IO) {
  io = serveur;
  setInterval(nettoyerPartiesMortes, 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Diffusion
// ---------------------------------------------------------------------------
export function etatPublic(game: ServerGame): GameState {
  const round: RoundPublic | null = game.round
    ? {
        numero: game.round.numero,
        accusateurId: game.round.accusateurId,
        accuseId: game.round.accuseId,
        carteAccusation: game.round.carteAccusation,
        cartesObjet: game.round.cartesObjet,
        motsUtilises: game.round.motsUtilises,
        votants: Object.keys(game.round.votes),
        nbJures: game.round.juresIds.length,
        // Les votes ne sont révélés qu'au dépouillement.
        votes: game.round.votesReveles ? game.round.votes : null,
        verdict: game.round.verdict,
        coupableDirect: game.round.coupableDirect,
        finTimer: game.round.finTimer,
        pointsGagnes: game.round.pointsGagnes,
      }
    : null;

  return {
    code: game.code,
    hostId: game.hostId,
    phase: game.phase,
    players: game.players.map((p) => ({ ...p })),
    settings: { ...game.settings },
    round,
    totalManches: game.totalManches,
    serverNow: Date.now(),
    cartesPerso: {
      accusations: [...game.cartesPerso.accusations],
      objets: [...game.cartesPerso.objets],
    },
  };
}

export function diffuser(game: ServerGame) {
  game.derniereActivite = Date.now();
  io.to(game.code).emit('etat_partie', etatPublic(game));
}

function fx(game: ServerGame, type: 'VERDICT' | 'TIRAGE' | 'POINT' | 'DEBUT_MANCHE') {
  io.to(game.code).emit('fx', { type });
}

export function erreur(
  code: ErreurPayload['code'],
  message: string
): { ok: false; erreur: ErreurPayload } {
  return { ok: false, erreur: { code, message } };
}

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------
function annulerTimer(game: ServerGame) {
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

function poserTimer(game: ServerGame, ms: number, suite: () => void) {
  annulerTimer(game);
  if (game.round) game.round.finTimer = Date.now() + ms;
  game.timer = setTimeout(() => {
    game.timer = null;
    try {
      suite();
    } catch (e) {
      console.error('[timer]', game.code, e);
    }
  }, ms);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function trouverJoueur(game: ServerGame, id: string): Player | undefined {
  return game.players.find((p) => p.id === id);
}

function connectes(game: ServerGame): Player[] {
  return game.players.filter((p) => p.connected);
}

function piocherAccusation(game: ServerGame): string {
  const deck = [...ACCUSATIONS, ...game.cartesPerso.accusations];
  let dispo = deck.filter((c) => !game.usedAccusationCards.includes(c));
  if (dispo.length === 0) {
    game.usedAccusationCards = [];
    dispo = deck;
  }
  const carte = auHasard(dispo);
  game.usedAccusationCards.push(carte);
  return carte;
}

function piocherObjets(game: ServerGame, n = 3): string[] {
  const deck = [...OBJETS, ...game.cartesPerso.objets];
  let dispo = deck.filter((c) => !game.usedObjectCards.includes(c));
  if (dispo.length < n) {
    game.usedObjectCards = [];
    dispo = deck;
  }
  const tirage = melanger(dispo).slice(0, n);
  game.usedObjectCards.push(...tirage);
  return tirage;
}

/** Joueur connecté suivant dans l'ordre d'arrivée, en repartant de accusateurIndex. */
function prochainAccusateur(game: ServerGame, interdit?: string | null): Player | null {
  const n = game.players.length;
  for (let pas = 1; pas <= n; pas++) {
    const idx = (game.accusateurIndex + pas + n * 2) % n;
    const p = game.players[idx];
    if (p && p.connected && p.id !== interdit) {
      game.accusateurIndex = idx;
      return p;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Création / arrivée des joueurs
// ---------------------------------------------------------------------------
export function creerPartie(pseudoBrut: string): { game: ServerGame; player: Player } | null {
  const pseudo = nettoyerPseudo(pseudoBrut, MAX_PSEUDO);
  if (!pseudo) return null;

  const code = genererCode((c) => parties.has(c));
  const player: Player = { id: nouvelId(), pseudo, score: 0, connected: true };
  const game: ServerGame = {
    code,
    hostId: player.id,
    phase: 'LOBBY',
    players: [player],
    settings: { toursParJoueur: 3, dureeDefenseSec: 120 },
    round: null,
    usedAccusationCards: [],
    usedObjectCards: [],
    cartesPerso: { accusations: [], objets: [] },
    accusateurIndex: -1,
    mancheCourante: 0,
    totalManches: 0,
    timer: null,
    derniereActivite: Date.now(),
    videDepuis: null,
  };
  parties.set(code, game);
  return { game, player };
}

export function rejoindrePartie(
  codeBrut: string,
  pseudoBrut: string,
  playerId?: string
): { game: ServerGame; player: Player } | { erreur: ErreurPayload } {
  const code = String(codeBrut ?? '').trim().toUpperCase();
  const game = parties.get(code);
  if (!game) {
    return { erreur: { code: 'PARTIE_INTROUVABLE', message: "Aucune partie avec ce code." } };
  }
  const pseudo = nettoyerPseudo(pseudoBrut, MAX_PSEUDO);

  // 1. Reconnexion par identifiant (refresh de page)
  if (playerId) {
    const existant = trouverJoueur(game, playerId);
    if (existant) {
      existant.connected = true;
      if (pseudo) existant.pseudo = pseudo;
      game.videDepuis = null;
      return { game, player: existant };
    }
  }

  if (!pseudo) {
    return { erreur: { code: 'PSEUDO_INVALIDE', message: 'Choisis un pseudo.' } };
  }

  // 2. Reconnexion par pseudo (même nom, place et score récupérés)
  const memePseudo = game.players.find(
    (p) => p.pseudo.toLowerCase() === pseudo.toLowerCase()
  );
  if (memePseudo) {
    if (memePseudo.connected) {
      return { erreur: { code: 'PSEUDO_PRIS', message: 'Ce pseudo est déjà pris dans cette partie.' } };
    }
    memePseudo.connected = true;
    game.videDepuis = null;
    return { game, player: memePseudo };
  }

  // 3. Nouveau joueur
  if (game.phase !== 'LOBBY') {
    return { erreur: { code: 'PARTIE_EN_COURS', message: 'La partie a déjà commencé.' } };
  }
  if (game.players.length >= MAX_JOUEURS) {
    return { erreur: { code: 'PARTIE_PLEINE', message: `La partie est pleine (${MAX_JOUEURS} joueurs).` } };
  }
  const player: Player = { id: nouvelId(), pseudo, score: 0, connected: true };
  game.players.push(player);
  game.videDepuis = null;
  return { game, player };
}

// ---------------------------------------------------------------------------
// Salon
// ---------------------------------------------------------------------------
export function majReglages(game: ServerGame, byId: string, patch: Partial<Settings>) {
  if (game.hostId !== byId || game.phase !== 'LOBBY') return;
  if (typeof patch.toursParJoueur === 'number') {
    game.settings.toursParJoueur = Math.min(5, Math.max(1, Math.round(patch.toursParJoueur)));
  }
  if (typeof patch.dureeDefenseSec === 'number') {
    game.settings.dureeDefenseSec = Math.min(300, Math.max(30, Math.round(patch.dureeDefenseSec)));
  }
  diffuser(game);
}

export function ajouterCarte(game: ServerGame, type: 'ACCUSATION' | 'OBJET', texteBrut: string) {
  if (game.phase !== 'LOBBY') return;
  const texte = nettoyerTexteCarte(texteBrut, MAX_LONGUEUR_CARTE);
  if (!texte) return;
  const liste = type === 'ACCUSATION' ? game.cartesPerso.accusations : game.cartesPerso.objets;
  if (liste.length >= 60) return;
  if (liste.some((c) => c.toLowerCase() === texte.toLowerCase())) return;
  liste.push(texte);
  diffuser(game);
}

export function supprimerCarte(game: ServerGame, type: 'ACCUSATION' | 'OBJET', texte: string) {
  if (game.phase !== 'LOBBY') return;
  const liste = type === 'ACCUSATION' ? game.cartesPerso.accusations : game.cartesPerso.objets;
  const i = liste.indexOf(texte);
  if (i >= 0) liste.splice(i, 1);
  diffuser(game);
}

// ---------------------------------------------------------------------------
// Machine à états d'une manche
// ---------------------------------------------------------------------------
export function lancerPartie(game: ServerGame, byId: string): ErreurPayload | null {
  if (game.hostId !== byId) {
    return { code: 'PAS_HOTE', message: "Seul l'hôte peut lancer la partie." };
  }
  if (game.phase !== 'LOBBY' && game.phase !== 'FIN') {
    return { code: 'ACTION_INVALIDE', message: 'La partie est déjà en cours.' };
  }
  const joueurs = connectes(game);
  if (joueurs.length < MIN_JOUEURS) {
    return {
      code: 'PAS_ASSEZ_DE_JOUEURS',
      message: `Il faut au moins ${MIN_JOUEURS} joueurs pour commencer (vous êtes ${joueurs.length}).`,
    };
  }
  for (const p of game.players) p.score = 0;
  game.usedAccusationCards = [];
  game.usedObjectCards = [];
  game.accusateurIndex = -1;
  game.mancheCourante = 0;
  game.totalManches = joueurs.length * game.settings.toursParJoueur;
  demarrerManche(game);
  return null;
}

export function demarrerManche(game: ServerGame) {
  annulerTimer(game);
  if (connectes(game).length < 2) return terminerPartie(game);
  if (game.mancheCourante >= game.totalManches) return terminerPartie(game);

  const accusateur = prochainAccusateur(game);
  if (!accusateur) return terminerPartie(game);

  game.mancheCourante++;
  game.round = {
    numero: game.mancheCourante,
    accusateurId: accusateur.id,
    accuseId: null,
    carteAccusation: piocherAccusation(game),
    cartesObjet: [],
    motsUtilises: [false, false, false],
    votes: {},
    juresIds: [],
    verdict: null,
    coupableDirect: false,
    finTimer: null,
    pointsGagnes: {},
    votesReveles: false,
  };
  game.phase = 'ACCUSATION';
  fx(game, 'DEBUT_MANCHE');
  poserTimer(game, DUREE_ACCUSATION, () => tirerAccuse(game));
  diffuser(game);
}

function tirerAccuse(game: ServerGame) {
  const r = game.round;
  if (!r) return;
  const candidats = connectes(game).filter((p) => p.id !== r.accusateurId);
  if (candidats.length === 0) {
    // Plus personne à accuser : on saute la manche.
    return demarrerManche(game);
  }
  r.accuseId = auHasard(candidats).id;
  game.phase = 'TIRAGE_ACCUSE';
  fx(game, 'TIRAGE');
  poserTimer(game, DUREE_TIRAGE, () => lancerDefense(game));
  diffuser(game);
}

function lancerDefense(game: ServerGame) {
  const r = game.round;
  if (!r || !r.accuseId) return demarrerManche(game);
  r.cartesObjet = piocherObjets(game, 3);
  r.motsUtilises = [false, false, false];
  game.phase = 'DEFENSE';
  poserTimer(game, game.settings.dureeDefenseSec * 1000, () => finDefense(game));
  diffuser(game);
}

export function cocherMot(game: ServerGame, byId: string, index: number) {
  const r = game.round;
  if (!r || game.phase !== 'DEFENSE') return;
  // Seul l'accusé coche ses mots. L'hôte ne prend la main que si l'accusé
  // est déconnecté (téléphone à plat, appli fermée…).
  const accuse = r.accuseId ? trouverJoueur(game, r.accuseId) : undefined;
  const hoteDepanne = byId === game.hostId && (!accuse || !accuse.connected);
  if (byId !== r.accuseId && !hoteDepanne) return;
  if (!Number.isInteger(index) || index < 0 || index >= r.motsUtilises.length) return;
  r.motsUtilises[index] = !r.motsUtilises[index];
  diffuser(game);
}

export function terminerDefense(game: ServerGame, byId: string) {
  const r = game.round;
  if (!r || game.phase !== 'DEFENSE') return;
  if (byId !== r.accuseId && byId !== game.hostId) return;
  finDefense(game);
}

function finDefense(game: ServerGame) {
  annulerTimer(game);
  const r = game.round;
  if (!r) return;
  if (!r.motsUtilises.every(Boolean)) {
    // Les 3 mots n'ont pas été utilisés : coupable direct, pas de vote.
    r.coupableDirect = true;
    r.verdict = 'COUPABLE';
    return allerResultat(game);
  }
  allerVote(game);
}

function allerVote(game: ServerGame) {
  const r = game.round;
  if (!r) return;
  r.juresIds = connectes(game)
    .filter((p) => p.id !== r.accusateurId && p.id !== r.accuseId)
    .map((p) => p.id);
  if (r.juresIds.length === 0) {
    // Aucun juré : bénéfice du doute.
    r.verdict = 'NON_COUPABLE';
    return allerResultat(game);
  }
  r.votes = {};
  game.phase = 'VOTE';
  poserTimer(game, DUREE_VOTE, () => depouiller(game));
  diffuser(game);
}

export function voter(game: ServerGame, byId: string, vote: Vote) {
  const r = game.round;
  if (!r || game.phase !== 'VOTE') return;
  if (!r.juresIds.includes(byId)) return;
  if (vote !== 'COUPABLE' && vote !== 'NON_COUPABLE') return;
  r.votes[byId] = vote;
  if (r.juresIds.every((id) => r.votes[id])) {
    return depouiller(game);
  }
  diffuser(game);
}

function depouiller(game: ServerGame) {
  annulerTimer(game);
  const r = game.round;
  if (!r) return;
  let coupable = 0;
  let nonCoupable = 0;
  for (const v of Object.values(r.votes)) {
    if (v === 'COUPABLE') coupable++;
    else nonCoupable++;
  }
  // Égalité (y compris 0-0) => non coupable, bénéfice du doute.
  r.verdict = coupable > nonCoupable ? 'COUPABLE' : 'NON_COUPABLE';
  allerResultat(game);
}

function allerResultat(game: ServerGame) {
  annulerTimer(game);
  const r = game.round;
  if (!r) return;
  r.votesReveles = true;
  attribuerPoints(game);
  game.phase = 'RESULTAT';
  fx(game, 'VERDICT');
  poserTimer(game, DUREE_RESULTAT, () => demarrerManche(game));
  diffuser(game);
}

function attribuerPoints(game: ServerGame) {
  const r = game.round;
  if (!r) return;
  const pts: Record<string, number> = {};
  const ajouter = (id: string | null | undefined, n: number) => {
    if (!id) return;
    pts[id] = (pts[id] ?? 0) + n;
  };

  if (r.verdict === 'COUPABLE') {
    // Piège réussi (verdict coupable ou coupable direct) : point pour l'accusateur.
    ajouter(r.accusateurId, 1);
  } else {
    // Belle défense : point pour l'accusé.
    ajouter(r.accuseId, 1);
  }

  // Les jurés qui ont voté comme la majorité marquent (pas de vote si coupable direct).
  if (!r.coupableDirect) {
    for (const [jureId, v] of Object.entries(r.votes)) {
      if (v === r.verdict) ajouter(jureId, 1);
    }
  }

  r.pointsGagnes = pts;
  for (const [id, n] of Object.entries(pts)) {
    const p = trouverJoueur(game, id);
    if (p) p.score += n;
  }
}

export function mancheSuivante(game: ServerGame, byId: string) {
  if (game.phase !== 'RESULTAT') return;
  if (byId !== game.hostId) return;
  demarrerManche(game);
}

function terminerPartie(game: ServerGame) {
  annulerTimer(game);
  game.phase = 'FIN';
  if (game.round) game.round.finTimer = null;
  diffuser(game);
}

export function rejouer(game: ServerGame, byId: string): ErreurPayload | null {
  if (byId !== game.hostId) {
    return { code: 'PAS_HOTE', message: "Seul l'hôte peut relancer une partie." };
  }
  if (game.phase !== 'FIN') {
    return { code: 'ACTION_INVALIDE', message: 'La partie est encore en cours.' };
  }
  annulerTimer(game);
  for (const p of game.players) p.score = 0;
  game.round = null;
  game.usedAccusationCards = [];
  game.usedObjectCards = [];
  game.accusateurIndex = -1;
  game.mancheCourante = 0;
  game.totalManches = 0;
  game.phase = 'LOBBY';

  if (connectes(game).length >= MIN_JOUEURS) {
    return lancerPartie(game, byId);
  }
  diffuser(game);
  return null;
}

// ---------------------------------------------------------------------------
// Déconnexions / départs
// ---------------------------------------------------------------------------
export function deconnecter(game: ServerGame, playerId: string) {
  const p = trouverJoueur(game, playerId);
  if (!p || !p.connected) return;
  p.connected = false;
  finaliserDepart(game, playerId, false);
}

export function quitter(game: ServerGame, playerId: string) {
  game.players = game.players.filter((x) => x.id !== playerId);
  finaliserDepart(game, playerId, true);
}

function finaliserDepart(game: ServerGame, playerId: string, retire: boolean) {
  // Transfert de l'hôte au joueur connecté suivant.
  if (game.hostId === playerId) {
    const suivant = connectes(game)[0];
    if (suivant) game.hostId = suivant.id;
  }

  // Dans le salon, un joueur déconnecté disparaît simplement de la liste.
  if (game.phase === 'LOBBY' && !retire) {
    game.players = game.players.filter((x) => x.id !== playerId);
  }

  if (connectes(game).length === 0) {
    annulerTimer(game);
    game.videDepuis = Date.now();
    return;
  }
  game.videDepuis = null;

  const r = game.round;
  if (r) {
    // L'accusé s'en va avant/pendant sa défense : on retire au sort.
    if (playerId === r.accuseId && (game.phase === 'TIRAGE_ACCUSE' || game.phase === 'DEFENSE')) {
      const candidats = connectes(game).filter((x) => x.id !== r.accusateurId);
      if (candidats.length === 0) return demarrerManche(game);
      r.accuseId = auHasard(candidats).id;
      fx(game, 'TIRAGE');
      return lancerDefense(game);
    }

    // L'accusateur s'en va avant le début de la défense : on passe au suivant.
    if (
      playerId === r.accusateurId &&
      (game.phase === 'ACCUSATION' || game.phase === 'TIRAGE_ACCUSE')
    ) {
      const remplacant = prochainAccusateur(game, r.accuseId);
      if (!remplacant) return demarrerManche(game);
      r.accusateurId = remplacant.id;
      // Si le remplaçant était l'accusé désigné, on retire un accusé.
      if (r.accuseId === remplacant.id) {
        const candidats = connectes(game).filter((x) => x.id !== r.accusateurId);
        r.accuseId = candidats.length ? auHasard(candidats).id : null;
      }
      diffuser(game);
      return;
    }

    // Un juré s'en va pendant le vote : on l'enlève du décompte.
    if (game.phase === 'VOTE' && r.juresIds.includes(playerId)) {
      r.juresIds = r.juresIds.filter((id) => id !== playerId);
      delete r.votes[playerId];
      if (r.juresIds.length === 0) {
        r.verdict = 'NON_COUPABLE';
        return allerResultat(game);
      }
      if (r.juresIds.every((id) => r.votes[id])) return depouiller(game);
    }
  }

  diffuser(game);
}

function nettoyerPartiesMortes() {
  const maintenant = Date.now();
  for (const [code, game] of parties) {
    const vide = game.videDepuis !== null && maintenant - game.videDepuis > TTL_PARTIE_VIDE_MS;
    const oubliee = maintenant - game.derniereActivite > 6 * 60 * 60 * 1000;
    if (vide || oubliee) {
      annulerTimer(game);
      parties.delete(code);
    }
  }
}

/**
 * Types partages entre le client et le serveur.
 * Le serveur est l'unique source de verite : il envoie `etat_partie` a chaque
 * changement, le client se contente d'afficher.
 */

export type Phase =
  | 'LOBBY'
  | 'ACCUSATION'
  | 'TIRAGE_ACCUSE'
  | 'DEFENSE'
  | 'VOTE'
  | 'RESULTAT'
  | 'FIN';

export type Vote = 'COUPABLE' | 'NON_COUPABLE';

export interface Player {
  id: string;
  pseudo: string;
  score: number;
  connected: boolean;
}

export interface Settings {
  toursParJoueur: number; // 1 a 5
  dureeDefenseSec: number; // 60 a 300
}

/** Etat de la manche tel qu'il est diffuse aux clients. */
export interface RoundPublic {
  numero: number;
  accusateurId: string;
  accuseId: string | null;
  carteAccusation: string;
  cartesObjet: string[];
  motsUtilises: boolean[];
  /** Ids des jures ayant deja vote (sans reveler leur choix). */
  votants: string[];
  /** Nombre de jures attendus pour cette manche. */
  nbJures: number;
  /** Detail des votes : null tant que le vote n'est pas depouille. */
  votes: Record<string, Vote> | null;
  verdict: Vote | null;
  /** true si l'accuse n'a pas coche ses 3 mots => coupable direct. */
  coupableDirect: boolean;
  /** Timestamp (ms, horloge serveur) de fin du minuteur en cours. */
  finTimer: number | null;
  /** Points gagnes pendant cette manche, par joueur. */
  pointsGagnes: Record<string, number>;
}

export interface GameState {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  settings: Settings;
  round: RoundPublic | null;
  /** Nombre total de manches de la partie. */
  totalManches: number;
  /** Horloge serveur, pour que les clients corrigent leur decalage. */
  serverNow: number;
  /** Cartes personnalisees ajoutees dans le salon. */
  cartesPerso: { accusations: string[]; objets: string[] };
}

export interface ErreurPayload {
  code:
    | 'PARTIE_INTROUVABLE'
    | 'PARTIE_PLEINE'
    | 'PSEUDO_PRIS'
    | 'PARTIE_EN_COURS'
    | 'PAS_ASSEZ_DE_JOUEURS'
    | 'PAS_HOTE'
    | 'ACTION_INVALIDE'
    | 'PSEUDO_INVALIDE';
  message: string;
}

/** Reponse a `creer_partie` / `rejoindre_partie`. */
export interface SessionPayload {
  code: string;
  playerId: string;
}

export const MIN_JOUEURS = 4;
export const MAX_JOUEURS = 12;
export const MAX_PSEUDO = 14;

/** Client -> Serveur */
export interface ClientToServerEvents {
  creer_partie: (
    p: { pseudo: string },
    ack: (r: { ok: true; session: SessionPayload } | { ok: false; erreur: ErreurPayload }) => void
  ) => void;
  rejoindre_partie: (
    p: { code: string; pseudo: string; playerId?: string },
    ack: (r: { ok: true; session: SessionPayload } | { ok: false; erreur: ErreurPayload }) => void
  ) => void;
  quitter_partie: () => void;
  maj_reglages: (p: Partial<Settings>) => void;
  ajouter_carte: (p: { type: 'ACCUSATION' | 'OBJET'; texte: string }) => void;
  supprimer_carte: (p: { type: 'ACCUSATION' | 'OBJET'; texte: string }) => void;
  lancer_partie: () => void;
  demarrer_manche: () => void;
  cocher_mot: (p: { index: number }) => void;
  terminer_defense: () => void;
  voter: (p: { vote: Vote }) => void;
  manche_suivante: () => void;
  rejouer: () => void;
}

/** Serveur -> Client */
export interface ServerToClientEvents {
  etat_partie: (state: GameState) => void;
  erreur: (e: ErreurPayload) => void;
  /** Petits evenements pour les sons / animations, sans logique metier. */
  fx: (e: { type: 'VERDICT' | 'TIRAGE' | 'POINT' | 'DEBUT_MANCHE' }) => void;
  partie_terminee: (p: { raison: string }) => void;
}

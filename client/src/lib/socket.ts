import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

/**
 * En dev, Vite proxifie /socket.io vers le serveur (voir vite.config.ts).
 * En prod : VITE_SERVER_URL pour pointer un serveur séparé,
 * VITE_SOCKET_PATH pour un chemin particulier (Vercel sert la Function sur
 * /api/socket-io, donc le chemin devient /api/socket-io/socket.io).
 */
const URL_SERVEUR = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;
const CHEMIN = (import.meta.env.VITE_SOCKET_PATH as string | undefined) || '/socket.io';
const SUR_VERCEL = CHEMIN !== '/socket.io';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL_SERVEUR, {
  path: CHEMIN,
  // Sur Vercel, le long-polling n'est pas fiable (les requêtes peuvent tomber
  // sur des instances différentes) : on impose le WebSocket.
  transports: SUR_VERCEL ? ['websocket'] : ['websocket', 'polling'],
  reconnectionDelay: 400,
  reconnectionDelayMax: 3000,
});

// --- Session locale (survit à un refresh de page) --------------------------
const CLE = 'coupable:session';

export interface SessionLocale {
  code: string;
  playerId: string;
  pseudo: string;
}

export function lireSession(): SessionLocale | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const s = JSON.parse(brut);
    if (s && typeof s.code === 'string' && typeof s.playerId === 'string') return s;
  } catch {
    /* localStorage indisponible : on joue sans reconnexion automatique */
  }
  return null;
}

export function ecrireSession(s: SessionLocale | null) {
  try {
    if (s) localStorage.setItem(CLE, JSON.stringify(s));
    else localStorage.removeItem(CLE);
  } catch {
    /* ignoré */
  }
}

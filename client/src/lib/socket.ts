import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

/**
 * En dev, Vite proxifie /socket.io vers le serveur (voir vite.config.ts).
 * En prod : VITE_SERVER_URL pour pointer le serveur temps réel quand il est
 * hébergé ailleurs que le client (client sur Vercel + serveur sur Render).
 * Sans cette variable, on parle au serveur qui a servi la page.
 */
const URL_SERVEUR = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL_SERVEUR, {
  transports: ['websocket', 'polling'],
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

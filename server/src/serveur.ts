import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';
import {
  ajouterCartes,
  cocherMot,
  creerPartie,
  deconnecter,
  diffuser,
  erreur,
  initEngine,
  lancerPartie,
  majReglages,
  mancheSuivante,
  parties,
  quitter,
  rejoindrePartie,
  rejouer,
  supprimerCarte,
  terminerDefense,
  trouverJoueur,
  voter,
} from './game/engine';

interface SocketData {
  playerId?: string;
  code?: string;
}

/**
 * Construit l'application complète (HTTP + Socket.IO) sans l'écouter.
 * `index.ts` l'écoute sur un port ; `api/socket-io.ts` l'exporte pour Vercel.
 */
export function creerApplication() {
  const ORIGINE = process.env.CORS_ORIGIN ?? '*';

  const app = express();
  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
    cors: { origin: ORIGINE, methods: ['GET', 'POST'] },
  });

  initEngine(io);

  app.get('/api/sante', (_req, res) => {
    res.json({ ok: true, parties: parties.size, uptime: process.uptime() });
  });

  /** Permet au client de vérifier un code avant d'afficher le formulaire. */
  app.get('/api/partie/:code', (req, res) => {
    const game = parties.get(String(req.params.code).toUpperCase());
    if (!game) return res.status(404).json({ ok: false });
    res.json({ ok: true, phase: game.phase, joueurs: game.players.length });
  });

  // Hors Vercel, le même serveur sert aussi le build du client.
  try {
    const ici = path.dirname(fileURLToPath(import.meta.url));
    const dossierClient = path.resolve(ici, '../../client/dist');
    if (fs.existsSync(dossierClient)) {
      app.use(express.static(dossierClient));
      app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
        res.sendFile(path.join(dossierClient, 'index.html'));
      });
    }
  } catch {
    /* environnement sans système de fichiers accessible : on sert juste l'API */
  }

  brancherSockets(io);

  return { app, httpServer, io };
}

// ---------------------------------------------------------------------------
// Socket.IO : le serveur est l'unique source de vérité.
// ---------------------------------------------------------------------------
function brancherSockets(io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) {
  io.on('connection', (socket) => {
    const partieDuSocket = () => {
      const code = socket.data.code;
      return code ? parties.get(code) : undefined;
    };

    /** Exécute une action en s'assurant que le socket appartient bien à une partie. */
    const avecPartie = (
      fn: (game: NonNullable<ReturnType<typeof partieDuSocket>>, playerId: string) => void
    ) => {
      const game = partieDuSocket();
      const playerId = socket.data.playerId;
      if (!game || !playerId) return;
      if (!trouverJoueur(game, playerId)) return;
      fn(game, playerId);
    };

    socket.on('creer_partie', (p, ack) => {
      const resultat = creerPartie(p?.pseudo ?? '');
      if (!resultat) {
        return ack?.(erreur('PSEUDO_INVALIDE', 'Choisis un pseudo.'));
      }
      const { game, player } = resultat;
      socket.data.playerId = player.id;
      socket.data.code = game.code;
      socket.join(game.code);
      ack?.({ ok: true, session: { code: game.code, playerId: player.id } });
      diffuser(game);
    });

    socket.on('rejoindre_partie', (p, ack) => {
      const res = rejoindrePartie(p?.code ?? '', p?.pseudo ?? '', p?.playerId);
      if ('erreur' in res) {
        return ack?.({ ok: false, erreur: res.erreur });
      }
      const { game, player } = res;

      // Un même joueur ne doit pas rester connecté depuis deux onglets fantômes.
      for (const [, autre] of io.sockets.sockets) {
        if (autre.id !== socket.id && autre.data?.playerId === player.id) {
          autre.data.playerId = undefined;
          autre.leave(game.code);
          autre.disconnect(true);
        }
      }

      socket.data.playerId = player.id;
      socket.data.code = game.code;
      socket.join(game.code);
      ack?.({ ok: true, session: { code: game.code, playerId: player.id } });
      diffuser(game);
    });

    socket.on('maj_reglages', (patch) => {
      avecPartie((game, playerId) => majReglages(game, playerId, patch ?? {}));
    });

    socket.on('ajouter_cartes', (p) => {
      avecPartie((game, playerId) => ajouterCartes(game, playerId, p ?? {}));
    });

    socket.on('supprimer_carte', (p) => {
      avecPartie((game, playerId) => {
        if (!p || (p.type !== 'ACCUSATION' && p.type !== 'OBJET')) return;
        supprimerCarte(game, playerId, p.type, p.texte);
      });
    });

    socket.on('lancer_partie', () => {
      avecPartie((game, playerId) => {
        const err = lancerPartie(game, playerId);
        if (err) socket.emit('erreur', err);
      });
    });

    socket.on('demarrer_manche', () => {
      avecPartie((game, playerId) => mancheSuivante(game, playerId));
    });

    socket.on('cocher_mot', (p) => {
      avecPartie((game, playerId) => cocherMot(game, playerId, p?.index ?? -1));
    });

    socket.on('terminer_defense', () => {
      avecPartie((game, playerId) => terminerDefense(game, playerId));
    });

    socket.on('voter', (p) => {
      avecPartie((game, playerId) => {
        if (!p) return;
        voter(game, playerId, p.vote);
      });
    });

    socket.on('manche_suivante', () => {
      avecPartie((game, playerId) => mancheSuivante(game, playerId));
    });

    socket.on('rejouer', () => {
      avecPartie((game, playerId) => {
        const err = rejouer(game, playerId);
        if (err) socket.emit('erreur', err);
      });
    });

    socket.on('quitter_partie', () => {
      avecPartie((game, playerId) => {
        socket.leave(game.code);
        socket.data.playerId = undefined;
        socket.data.code = undefined;
        quitter(game, playerId);
      });
    });

    socket.on('disconnect', () => {
      avecPartie((game, playerId) => deconnecter(game, playerId));
    });
  });
}

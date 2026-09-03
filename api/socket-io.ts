/**
 * Point d'entrée Socket.IO pour Vercel Functions.
 * Vercel sert ce fichier sur /api/socket-io ; le client se connecte donc sur
 * le chemin /api/socket-io/socket.io (voir client/src/lib/socket.ts).
 *
 * Attention : les WebSockets sur Vercel exigent Fluid compute, et deux
 * connexions ne sont pas garanties d'atterrir sur la même instance.
 */
import { creerApplication } from '../server/src/serveur';

const { httpServer } = creerApplication();

export default httpServer;

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Le deck vit dans `cards.json` à la racine du projet : on peut le modifier
 * sans toucher au code. Structure attendue :
 *   { "accusations": ["Tu as ...", ...], "objets": ["crayon", ...] }
 */
export interface Deck {
  accusations: string[];
  objets: string[];
}

function localiserFichier(): string {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const candidats = [
    process.env.CARDS_FILE,
    path.resolve(ici, '../../../cards.json'), // server/src/data -> racine du dépôt
    path.resolve(process.cwd(), 'cards.json'),
  ].filter((c): c is string => Boolean(c));

  for (const chemin of candidats) {
    if (fs.existsSync(chemin)) return chemin;
  }
  throw new Error(
    `cards.json introuvable. Cherché dans :\n  - ${candidats.join('\n  - ')}\n` +
      'Place le fichier à la racine du projet ou renseigne CARDS_FILE.'
  );
}

function nettoyerListe(valeur: unknown, nom: string, longueurMax: number): string[] {
  if (!Array.isArray(valeur)) {
    throw new Error(`cards.json : « ${nom} » doit être un tableau de chaînes.`);
  }
  const vues = new Set<string>();
  const propre: string[] = [];
  for (const brut of valeur) {
    if (typeof brut !== 'string') continue;
    const texte = brut.replace(/\s+/g, ' ').trim().slice(0, longueurMax);
    if (!texte) continue;
    const cle = texte.toLowerCase();
    if (vues.has(cle)) continue; // doublons ignorés
    vues.add(cle);
    propre.push(texte);
  }
  if (propre.length === 0) {
    throw new Error(`cards.json : « ${nom} » ne contient aucune carte exploitable.`);
  }
  return propre;
}

export const LONGUEUR_MAX_ACCUSATION = 200;
export const LONGUEUR_MAX_OBJET = 30;

function chargerDeck(): Deck {
  const chemin = localiserFichier();
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch (e) {
    throw new Error(`cards.json illisible (${chemin}) : ${(e as Error).message}`);
  }
  const objet = json as Record<string, unknown>;
  const deck: Deck = {
    accusations: nettoyerListe(objet.accusations, 'accusations', LONGUEUR_MAX_ACCUSATION),
    objets: nettoyerListe(objet.objets, 'objets', LONGUEUR_MAX_OBJET),
  };
  if (deck.objets.length < 3) {
    throw new Error('cards.json : il faut au moins 3 objets pour distribuer une défense.');
  }
  console.log(
    `  🃏 deck chargé : ${deck.accusations.length} accusations, ${deck.objets.length} objets (${chemin})`
  );
  return deck;
}

/** Deck de base, chargé une fois au démarrage. */
export const DECK_BASE: Deck = chargerDeck();

/** Copie fraîche pour une nouvelle partie (les cartes custom s'y ajoutent). */
export function nouveauDeck(): Deck {
  return { accusations: [...DECK_BASE.accusations], objets: [...DECK_BASE.objets] };
}

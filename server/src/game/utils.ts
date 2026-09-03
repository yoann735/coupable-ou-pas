/** Petites fonctions utilitaires sans effet de bord. */

/** Alphabet sans lettres ambiguës : pas de I, O (ni chiffres 0/1). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function genererCode(estPris: (code: string) => boolean): string {
  for (let essai = 0; essai < 500; essai++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!estPris(code)) return code;
  }
  // Filet de sécurité : on rallonge plutôt que de risquer un doublon.
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export function melanger<T>(tableau: T[]): T[] {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export function auHasard<T>(tableau: T[]): T {
  return tableau[Math.floor(Math.random() * tableau.length)];
}

export function nettoyerPseudo(pseudo: unknown, maxLen: number): string {
  if (typeof pseudo !== 'string') return '';
  return pseudo.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function nettoyerTexteCarte(texte: unknown, maxLen: number): string {
  if (typeof texte !== 'string') return '';
  return texte.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function nouvelId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
  );
}

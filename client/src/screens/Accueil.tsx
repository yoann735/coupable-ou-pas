import { useEffect, useState } from 'react';
import { MAX_PSEUDO } from '../../../shared/types';
import { useJeu } from '../lib/jeu';
import { Bouton, Ecran, Panneau } from '../components/ui';

const CLE_PSEUDO = 'coupable:pseudo';

function pseudoMemorise() {
  try {
    return localStorage.getItem(CLE_PSEUDO) ?? '';
  } catch {
    return '';
  }
}

export default function Accueil() {
  const { actions, connecte } = useJeu();
  const [mode, setMode] = useState<'accueil' | 'creer' | 'rejoindre'>('accueil');
  const [pseudo, setPseudo] = useState(pseudoMemorise);
  const [code, setCode] = useState('');

  // Un lien partagé ?code=PLUM amène directement sur le formulaire de connexion.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c && /^[A-Za-z]{4,6}$/.test(c)) {
      setCode(c.toUpperCase());
      setMode('rejoindre');
    }
  }, []);

  const memoriser = (p: string) => {
    try {
      localStorage.setItem(CLE_PSEUDO, p);
    } catch {
      /* ignoré */
    }
  };

  const valider = () => {
    const p = pseudo.trim();
    if (!p) return;
    memoriser(p);
    if (mode === 'creer') actions.creer(p);
    else actions.rejoindre(code.trim().toUpperCase(), p);
  };

  const pretARejoindre = pseudo.trim().length > 0 && code.trim().length >= 4;
  const pretACreer = pseudo.trim().length > 0;

  return (
    <Ecran className="justify-center py-6">
      <header className="text-center">
        <div className="mb-1 text-6xl">⚖️</div>
        <h1 className="titre-jeu text-4xl font-bold leading-none text-parchemin">
          Coupable
          <span className="block text-2xl text-laiton">ou pas coupable&nbsp;?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm font-bold text-parchemin/75">
          Défendez-vous devant le tribunal. Chacun son téléphone, 4 joueurs minimum.
        </p>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-wide text-laiton/80">
          🔞 Jeu d'ambiance pour adultes
        </p>
      </header>

      {mode === 'accueil' && (
        <Panneau className="flex flex-col gap-3">
          <Bouton taille="grand" onClick={() => setMode('creer')}>
            🎩 Créer une partie
          </Bouton>
          <Bouton taille="grand" variante="secondaire" onClick={() => setMode('rejoindre')}>
            🚪 Rejoindre
          </Bouton>
        </Panneau>
      )}

      {mode !== 'accueil' && (
        <Panneau className="flex flex-col gap-4">
          <h2 className="text-center text-2xl font-bold">
            {mode === 'creer' ? 'Nouvelle partie' : 'Rejoindre une partie'}
          </h2>

          {mode === 'rejoindre' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
                Code de la partie
              </span>
              <input
                className="champ text-center font-titre text-3xl tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6))}
                placeholder="PLUM"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
              Ton pseudo
            </span>
            <input
              className="champ"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value.slice(0, MAX_PSEUDO))}
              placeholder="Ton nom"
              maxLength={MAX_PSEUDO}
              autoComplete="nickname"
              onKeyDown={(e) => {
                if (e.key === 'Enter') valider();
              }}
            />
          </label>

          <div className="flex gap-2">
            <Bouton variante="fantome" className="!text-encre !border-encre/40" onClick={() => setMode('accueil')}>
              ←
            </Bouton>
            <Bouton
              className="flex-1"
              taille="grand"
              onClick={valider}
              disabled={!connecte || (mode === 'creer' ? !pretACreer : !pretARejoindre)}
            >
              {mode === 'creer' ? 'Créer' : 'Rejoindre'}
            </Bouton>
          </div>

          {!connecte && (
            <p className="text-center text-sm font-bold text-coupable">
              Connexion au serveur en cours…
            </p>
          )}
        </Panneau>
      )}

      <p className="text-center text-xs font-bold text-parchemin/50">
        La défense se joue à l'oral&nbsp;: restez ensemble ou en appel vocal.
      </p>
    </Ecran>
  );
}

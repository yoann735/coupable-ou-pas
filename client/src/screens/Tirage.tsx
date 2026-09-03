import { useEffect, useMemo, useState } from 'react';
import { useCompteARebours, useJeu } from '../lib/jeu';
import { jouer } from '../lib/sons';
import { Ecran, Jeton, Panneau } from '../components/ui';

/** Durée de la roue avant la révélation (le serveur laisse 5,2 s au total). */
const REVELE_A = 2.4;

export default function Tirage() {
  const { etat, moi } = useJeu();
  const r = etat?.round;
  const restant = useCompteARebours(r?.finTimer);
  const [tick, setTick] = useState(0);

  const candidats = useMemo(
    () => (etat && r ? etat.players.filter((p) => p.connected && p.id !== r.accusateurId) : []),
    [etat, r]
  );
  const revele = restant <= REVELE_A;

  useEffect(() => {
    if (revele) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 95);
    return () => window.clearInterval(id);
  }, [revele]);

  useEffect(() => {
    if (revele) jouer('point');
  }, [revele]);

  if (!etat || !r) return null;

  const accuse = etat.players.find((p) => p.id === r.accuseId);
  const affiche = revele ? accuse : candidats[tick % Math.max(1, candidats.length)];
  const cEstMoi = revele && accuse?.id === moi?.id;

  return (
    <Ecran className="justify-center">
      <p className="text-center font-titre text-2xl font-bold text-parchemin">
        {revele ? "L'accusé est…" : 'Tirage au sort…'}
      </p>

      <Panneau className={`text-center ${revele ? 'animate-pop' : ''}`}>
        {affiche ? (
          <div className="flex flex-col items-center gap-3">
            <Jeton
              joueur={affiche}
              taille="grand"
              className={revele ? 'ring-4 ring-coupable ring-offset-2' : ''}
            />
            <p className="font-titre text-4xl font-bold leading-none">{affiche.pseudo}</p>
          </div>
        ) : (
          <p className="font-titre text-3xl font-bold">🎲</p>
        )}

        {revele && (
          <p className="mt-4 text-lg font-extrabold text-coupable">
            {cEstMoi ? 'Tu es sur le banc des accusés ! 😬' : 'Bonne chance…'}
          </p>
        )}
      </Panneau>

      <Panneau className="border-dashed bg-white text-center">
        <p className="font-titre text-xl font-bold leading-snug">« {r.carteAccusation} »</p>
      </Panneau>

      {!revele && (
        <p className="text-center text-sm font-bold text-parchemin/60">
          L'accusateur ne choisit pas sa victime : c'est le hasard qui décide.
        </p>
      )}
    </Ecran>
  );
}

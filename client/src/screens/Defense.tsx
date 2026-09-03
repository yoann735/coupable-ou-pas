import { useEffect, useRef } from 'react';
import { useCompteARebours, useJeu } from '../lib/jeu';
import { jouer } from '../lib/sons';
import { Bouton, Ecran, Etiquette, Jeton, Minuteur, Panneau } from '../components/ui';

export default function Defense() {
  const { etat, moi, estHote, actions } = useJeu();
  const r = etat?.round;
  const restant = useCompteARebours(r?.finTimer);
  const dernierTic = useRef<number>(-1);

  // Tic-tac sur les 20 dernières secondes.
  useEffect(() => {
    const s = Math.ceil(restant);
    if (s !== dernierTic.current) {
      if (s > 0 && s <= 20) jouer(s <= 5 ? 'tic-urgent' : 'tic');
      dernierTic.current = s;
    }
  }, [restant]);

  if (!etat || !r) return null;

  const accuse = etat.players.find((p) => p.id === r.accuseId);
  const accusateur = etat.players.find((p) => p.id === r.accusateurId);
  const jeSuisAccuse = moi?.id === r.accuseId;
  // L'hôte ne peut cocher à la place de l'accusé que si celui-ci a décroché.
  const peutCocher = jeSuisAccuse || (estHote && !accuse?.connected);
  const restantsACocher = r.motsUtilises.filter((m) => !m).length;

  return (
    <Ecran>
      <Panneau className="!p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Etiquette>Manche {r.numero}/{etat.totalManches}</Etiquette>
          <p className="truncate text-sm font-extrabold text-encre/60">
            {accusateur?.pseudo} accuse {accuse?.pseudo}
          </p>
        </div>
        <p className="text-center font-titre text-xl font-bold leading-snug">
          « {r.carteAccusation} »
        </p>
      </Panneau>

      <Panneau className="!py-4">
        <Minuteur restant={restant} total={etat.settings.dureeDefenseSec} />
      </Panneau>

      <Panneau>
        <p className="text-center text-sm font-extrabold uppercase tracking-wide text-encre/60">
          {jeSuisAccuse
            ? 'Place ces 3 mots dans ta défense'
            : `Les 3 mots imposés à ${accuse?.pseudo}`}
        </p>

        <div className="mt-3 flex flex-col gap-2.5">
          {r.cartesObjet.map((mot, i) => {
            const coche = r.motsUtilises[i];
            const cliquable = peutCocher;
            return (
              <button
                key={mot + i}
                disabled={!cliquable}
                onClick={() => actions.cocherMot(i)}
                className={`flex items-center justify-between gap-3 rounded-2xl border-[3px] border-encre px-4 py-4 text-left transition active:translate-y-[2px] disabled:active:translate-y-0 ${
                  coche
                    ? 'bg-innocent text-white shadow-none'
                    : 'bg-white text-encre shadow-bd-sm'
                } ${!cliquable ? 'cursor-default' : ''}`}
              >
                <span className="font-titre text-2xl font-bold">{mot}</span>
                <span className="text-3xl">{coche ? '✅' : '⬜️'}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs font-bold text-encre/50">
          {peutCocher
            ? "Tape sur un mot dès que tu l'as prononcé. Tout le monde voit les coches."
            : `${accuse?.pseudo ?? "L'accusé"} coche les mots au fur et à mesure.`}
        </p>
      </Panneau>

      <Panneau className="!py-3 text-center">
        {jeSuisAccuse ? (
          <p className="text-base font-extrabold">
            🎤 Défends-toi à l'oral&nbsp;!{' '}
            {restantsACocher > 0 ? (
              <span className="text-coupable">
                Encore {restantsACocher} mot{restantsACocher > 1 ? 's' : ''} à placer.
              </span>
            ) : (
              <span className="text-innocent">Les 3 mots sont placés 👏</span>
            )}
          </p>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {accuse && <Jeton joueur={accuse} />}
            <p className="text-base font-extrabold text-encre/70">
              {accuse?.pseudo} plaide sa cause. Écoute bien&nbsp;!
            </p>
          </div>
        )}
      </Panneau>

      {(jeSuisAccuse || estHote) && (
        <Bouton
          variante="secondaire"
          taille="grand"
          className="mt-auto w-full"
          onClick={actions.terminerDefense}
        >
          ⏭️ Terminer la défense
        </Bouton>
      )}
    </Ecran>
  );
}

import { useJeu } from '../lib/jeu';
import { Ecran, Etiquette, Jeton, Marteau, Panneau } from '../components/ui';

export default function Accusation() {
  const { etat, moi } = useJeu();
  const r = etat?.round;
  if (!etat || !r) return null;

  const accusateur = etat.players.find((p) => p.id === r.accusateurId);
  const jeSuisAccusateur = moi?.id === r.accusateurId;

  return (
    <Ecran className="justify-center">
      <div className="text-center">
        <Marteau anime className="text-6xl" />
      </div>

      <Panneau className="text-center">
        <Etiquette>Manche {r.numero} / {etat.totalManches}</Etiquette>
        <p className="mt-4 text-sm font-extrabold uppercase tracking-wide text-encre/60">
          L'accusateur
        </p>
        <div className="mt-2 flex flex-col items-center gap-2">
          {accusateur && <Jeton joueur={accusateur} taille="grand" className="animate-pop" />}
          <p className="font-titre text-3xl font-bold">
            {jeSuisAccusateur ? "C'est toi !" : accusateur?.pseudo}
          </p>
        </div>
      </Panneau>

      <Panneau className="border-dashed bg-white text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-encre/50">
          Chef d'accusation
        </p>
        <p className="mt-3 font-titre text-2xl font-bold leading-snug">« {r.carteAccusation} »</p>
      </Panneau>

      <p className="animate-flotte text-center text-lg font-extrabold text-parchemin/80">
        Qui va devoir se défendre&nbsp;? 🎲
      </p>
    </Ecran>
  );
}

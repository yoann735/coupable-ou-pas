import { MIN_JOUEURS } from '../../../shared/types';
import { useJeu } from '../lib/jeu';
import { Bouton, Confettis, Ecran, Jeton, Panneau } from '../components/ui';

const MEDAILLES = ['🥇', '🥈', '🥉'];

/** « Ana, Ben & Cléo » */
function listerPseudos(joueurs: { pseudo: string }[]) {
  const noms = joueurs.map((j) => j.pseudo);
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} & ${noms[noms.length - 1]}`;
}

export default function Fin() {
  const { etat, estHote, actions } = useJeu();
  if (!etat) return null;

  const classement = [...etat.players].sort((a, b) => b.score - a.score || a.pseudo.localeCompare(b.pseudo));
  const meilleurScore = classement[0]?.score ?? 0;
  const vainqueurs = classement.filter((p) => p.score === meilleurScore);
  const podium = classement.slice(0, 3);
  const suite = classement.slice(3);
  const assezDeJoueurs = etat.players.filter((p) => p.connected).length >= MIN_JOUEURS;

  // Ordre visuel du podium : 2e, 1er, 3e
  const ordrePodium = [podium[1], podium[0], podium[2]].filter(Boolean);
  const hauteurs = ['h-24', 'h-32', 'h-16'];

  return (
    <Ecran className="justify-center">
      <Confettis />

      <div className="text-center">
        <p className="text-5xl">⚖️</p>
        <h1 className="titre-jeu text-3xl font-bold text-parchemin">Le verdict final</h1>
        <p className="mt-1 text-lg font-extrabold text-laiton">
          {vainqueurs.length > 1 ? `Égalité : ${listerPseudos(vainqueurs)} !` : `${vainqueurs[0]?.pseudo} remporte le procès !`}
        </p>
      </div>

      <Panneau>
        <div className="flex items-end justify-center gap-2 border-b-[3px] border-encre">
          {ordrePodium.map((p, i) => {
            const rang = classement.indexOf(p);
            return (
              <div key={p.id} className="flex w-1/3 flex-col items-center gap-1">
                <Jeton
                  joueur={p}
                  taille={rang === 0 ? 'grand' : 'normal'}
                  className={`animate-pop ${rang === 0 ? 'ring-4 ring-laiton ring-offset-2' : ''}`}
                />
                <span className="max-w-full truncate text-sm font-extrabold">{p.pseudo}</span>
                <div
                  className={`flex w-full flex-col items-center justify-center rounded-t-xl border-[3px] border-b-0 border-encre bg-laiton ${
                    hauteurs[i]
                  }`}
                >
                  <span className="text-2xl">{MEDAILLES[rang]}</span>
                  <span className="font-titre text-xl font-bold">{p.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panneau>

      {suite.length > 0 && (
        <Panneau className="!py-3">
          <ul className="flex flex-col gap-1.5">
            {suite.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-2 py-1.5">
                <span className="w-5 text-center font-titre font-bold text-encre/40">{i + 4}</span>
                <Jeton joueur={p} taille="petit" />
                <span className="flex-1 truncate font-extrabold">{p.pseudo}</span>
                <span className="font-titre text-lg font-bold">{p.score}</span>
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      {estHote ? (
        <Bouton taille="grand" className="w-full" onClick={actions.rejouer}>
          🔁 Rejouer
        </Bouton>
      ) : (
        <div className="parchemin px-4 py-3 text-center font-extrabold text-encre/70">
          L'hôte peut relancer une partie.
        </div>
      )}
      {estHote && !assezDeJoueurs && (
        <p className="text-center text-xs font-bold text-parchemin/60">
          Il faut {MIN_JOUEURS} joueurs connectés : vous retournerez dans le salon.
        </p>
      )}
    </Ecran>
  );
}

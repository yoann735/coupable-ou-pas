import { useCompteARebours, useJeu } from '../lib/jeu';
import { Bouton, Ecran, Jeton, Panneau } from '../components/ui';

export default function Resultat() {
  const { etat, estHote, actions } = useJeu();
  const r = etat?.round;
  const restant = useCompteARebours(r?.finTimer);
  if (!etat || !r) return null;

  const coupable = r.verdict === 'COUPABLE';
  const accuse = etat.players.find((p) => p.id === r.accuseId);
  const accusateur = etat.players.find((p) => p.id === r.accusateurId);
  const gagnants = Object.entries(r.pointsGagnes).filter(([, n]) => n > 0);
  const derniereManche = r.numero >= etat.totalManches;

  return (
    <Ecran>
      <div
        className={`animate-pop rounded-3xl border-[3px] border-encre p-6 text-center shadow-carte ${
          coupable ? 'bg-coupable' : 'bg-innocent'
        }`}
      >
        <p className="text-5xl">{coupable ? '🔨' : '🕊️'}</p>
        <p className="mt-2 font-titre text-4xl font-bold uppercase leading-none text-white drop-shadow">
          {coupable ? 'Coupable !' : 'Non coupable'}
        </p>
        <p className="mt-3 text-base font-extrabold text-white/90">
          {r.coupableDirect
            ? `${accuse?.pseudo} n'a pas placé les 3 mots : coupable direct.`
            : coupable
              ? `Le jury n'a pas cru ${accuse?.pseudo}.`
              : `Le jury a été convaincu par ${accuse?.pseudo}.`}
        </p>
      </div>

      {/* Détail des votes */}
      {!r.coupableDirect && r.votes && Object.keys(r.votes).length > 0 && (
        <Panneau className="!py-4">
          <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-wide text-encre/60">
            Les votes du jury
          </p>
          <ul className="flex flex-col gap-1.5">
            {Object.entries(r.votes).map(([id, v]) => {
              const j = etat.players.find((p) => p.id === id);
              if (!j) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl bg-white/60 px-2 py-1.5">
                  <Jeton joueur={j} taille="petit" />
                  <span className="flex-1 truncate font-extrabold">{j.pseudo}</span>
                  <span
                    className={`rounded-full border-2 border-encre px-2 py-0.5 text-xs font-extrabold text-white ${
                      v === 'COUPABLE' ? 'bg-coupable' : 'bg-innocent'
                    }`}
                  >
                    {v === 'COUPABLE' ? 'Coupable' : 'Non coupable'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panneau>
      )}

      {/* Points */}
      <Panneau className="!py-4">
        <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-wide text-encre/60">
          Points de la manche
        </p>
        {gagnants.length === 0 ? (
          <p className="text-center font-extrabold text-encre/50">Personne ne marque cette fois.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {gagnants.map(([id, n], idx) => {
              const j = etat.players.find((p) => p.id === id);
              if (!j) return null;
              const role =
                id === r.accuseId ? 'belle défense' : id === r.accusateurId ? 'piège réussi' : 'bon vote';
              return (
                <li
                  key={id}
                  className="flex animate-pop items-center gap-2 rounded-xl bg-white/60 px-2 py-1.5"
                  style={{ animationDelay: `${idx * 90}ms` }}
                >
                  <Jeton joueur={j} taille="petit" />
                  <span className="flex-1 truncate font-extrabold">{j.pseudo}</span>
                  <span className="text-xs font-bold text-encre/45">{role}</span>
                  <span className="font-titre text-xl font-bold text-innocent">+{n}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      {/* Scores courants */}
      <Panneau className="!py-3">
        <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-wide text-encre/60">
          Scores
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[...etat.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-full border-2 border-encre/20 bg-white/70 px-2 py-1"
              >
                <Jeton joueur={p} taille="petit" />
                <span className="text-sm font-extrabold">{p.pseudo}</span>
                <span className="font-titre text-base font-bold">{p.score}</span>
              </div>
            ))}
        </div>
      </Panneau>

      <div className="mt-auto">
        {estHote ? (
          <Bouton taille="grand" className="w-full" onClick={actions.mancheSuivante}>
            {derniereManche ? '🏆 Voir le classement' : '▶️ Manche suivante'}
          </Bouton>
        ) : (
          <div className="parchemin px-4 py-3 text-center font-extrabold text-encre/70">
            Suite dans {Math.ceil(restant)} s…
          </div>
        )}
        {estHote && (
          <p className="mt-1.5 text-center text-xs font-bold text-parchemin/60">
            Sinon, ça continue tout seul dans {Math.ceil(restant)} s.
          </p>
        )}
      </div>
    </Ecran>
  );
}

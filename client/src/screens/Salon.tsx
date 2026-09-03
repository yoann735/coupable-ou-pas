import { useState } from 'react';
import { MIN_JOUEURS } from '../../../shared/types';
import { useJeu } from '../lib/jeu';
import { Bouton, Ecran, Etiquette, Jeton, Panneau } from '../components/ui';

export default function Salon() {
  const { etat, moi, estHote, actions } = useJeu();
  const [copie, setCopie] = useState(false);
  const [ongletCartes, setOngletCartes] = useState<'ferme' | 'ACCUSATION' | 'OBJET'>('ferme');
  const [nouvelleCarte, setNouvelleCarte] = useState('');
  if (!etat) return null;

  const connectes = etat.players.filter((p) => p.connected);
  const manque = Math.max(0, MIN_JOUEURS - connectes.length);
  const lien = `${window.location.origin}/?code=${etat.code}`;

  const partager = async () => {
    const texte = `Rejoins ma partie de « Coupable ou pas coupable ? » avec le code ${etat.code} : ${lien}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Coupable ou pas coupable ?', text: texte, url: lien });
        return;
      } catch {
        /* partage annulé : on retombe sur la copie */
      }
    }
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* ignoré */
    }
  };

  const ajouter = () => {
    if (ongletCartes === 'ferme') return;
    const t = nouvelleCarte.trim();
    if (!t) return;
    actions.ajouterCarte(ongletCartes, t);
    setNouvelleCarte('');
  };

  const listePerso =
    ongletCartes === 'ACCUSATION'
      ? etat.cartesPerso.accusations
      : ongletCartes === 'OBJET'
        ? etat.cartesPerso.objets
        : [];

  return (
    <Ecran>
      {/* Code de la partie */}
      <Panneau className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
          Code de la partie
        </p>
        <p className="font-titre text-[3.5rem] font-bold leading-tight tracking-[0.18em] text-bois-fonce">
          {etat.code}
        </p>
        <Bouton variante="secondaire" className="mt-1 w-full" onClick={partager}>
          {copie ? '✓ Lien copié !' : '📤 Partager le lien'}
        </Bouton>
        <p className="mt-2 text-xs font-bold text-encre/50">
          Les autres rejoignent avec ce code depuis leur téléphone.
        </p>
      </Panneau>

      {/* Joueurs */}
      <Panneau>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Joueurs</h2>
          <Etiquette className={connectes.length >= MIN_JOUEURS ? '!bg-innocent text-white' : ''}>
            {connectes.length} / {MIN_JOUEURS} min
          </Etiquette>
        </div>
        <ul className="flex flex-col gap-2">
          {etat.players.map((p) => (
            <li
              key={p.id}
              className="flex animate-pop items-center gap-3 rounded-2xl border-2 border-encre/15 bg-white/60 px-3 py-2"
            >
              <Jeton joueur={p} couronne={p.id === etat.hostId} />
              <span className="flex-1 truncate text-lg font-extrabold">
                {p.pseudo}
                {p.id === moi?.id && <span className="ml-2 text-sm text-encre/45">(toi)</span>}
              </span>
              {!p.connected && <span className="text-xs font-bold text-encre/40">déconnecté</span>}
            </li>
          ))}
        </ul>
      </Panneau>

      {/* Réglages */}
      <Panneau>
        <h2 className="mb-3 text-xl font-bold">Réglages</h2>

        <div className="mb-4">
          <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-encre/60">
            Tours par joueur
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={!estHote}
                onClick={() => actions.majReglages({ toursParJoueur: n })}
                className={`rounded-xl border-[3px] border-encre py-2.5 text-lg font-extrabold transition disabled:opacity-60 ${
                  etat.settings.toursParJoueur === n
                    ? 'bg-laiton text-encre shadow-bd-sm'
                    : 'bg-white/70 text-encre/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs font-bold text-encre/50">
            {connectes.length >= 2
              ? `≈ ${connectes.length * etat.settings.toursParJoueur} manches`
              : 'Chaque joueur sera accusateur ce nombre de fois.'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-encre/60">
            Temps de défense
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[60, 90, 120, 180].map((s) => (
              <button
                key={s}
                disabled={!estHote}
                onClick={() => actions.majReglages({ dureeDefenseSec: s })}
                className={`rounded-xl border-[3px] border-encre py-2.5 text-base font-extrabold transition disabled:opacity-60 ${
                  etat.settings.dureeDefenseSec === s
                    ? 'bg-laiton text-encre shadow-bd-sm'
                    : 'bg-white/70 text-encre/50'
                }`}
              >
                {s < 120 ? `${s}s` : `${s / 60}min`}
              </button>
            ))}
          </div>
        </div>

        {!estHote && (
          <p className="mt-3 text-center text-xs font-bold text-encre/50">
            Seul l'hôte peut modifier les réglages.
          </p>
        )}
      </Panneau>

      {/* Cartes personnalisées */}
      <Panneau>
        <button
          onClick={() => setOngletCartes(ongletCartes === 'ferme' ? 'ACCUSATION' : 'ferme')}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="text-xl font-bold">Cartes personnalisées</h2>
          <span className="text-sm font-extrabold text-encre/50">
            {etat.cartesPerso.accusations.length + etat.cartesPerso.objets.length > 0
              ? `+${etat.cartesPerso.accusations.length + etat.cartesPerso.objets.length}`
              : ''}{' '}
            {ongletCartes === 'ferme' ? '▾' : '▴'}
          </span>
        </button>

        {ongletCartes !== 'ferme' && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1.5">
              {(['ACCUSATION', 'OBJET'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOngletCartes(t)}
                  className={`rounded-xl border-[3px] border-encre py-2 text-sm font-extrabold ${
                    ongletCartes === t ? 'bg-laiton shadow-bd-sm' : 'bg-white/70 text-encre/50'
                  }`}
                >
                  {t === 'ACCUSATION' ? 'Accusations' : 'Objets'}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="champ !py-2.5 !text-base"
                value={nouvelleCarte}
                onChange={(e) => setNouvelleCarte(e.target.value.slice(0, 120))}
                placeholder={
                  ongletCartes === 'ACCUSATION' ? 'Tu as mangé mon dessert…' : 'un mot (ex. tiramisu)'
                }
                onKeyDown={(e) => e.key === 'Enter' && ajouter()}
              />
              <Bouton onClick={ajouter} disabled={!nouvelleCarte.trim()}>
                +
              </Bouton>
            </div>

            {listePerso.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {listePerso.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-1.5 rounded-full border-2 border-encre/25 bg-white/70 px-3 py-1 text-sm font-bold"
                  >
                    {c}
                    <button
                      onClick={() => actions.supprimerCarte(ongletCartes, c)}
                      className="text-encre/40 hover:text-coupable"
                      aria-label={`Supprimer ${c}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panneau>

      {/* Lancement */}
      <div className="sticky bottom-2 mt-auto">
        {estHote ? (
          <Bouton
            taille="grand"
            className="w-full"
            disabled={connectes.length < MIN_JOUEURS}
            onClick={actions.lancer}
          >
            {manque > 0
              ? `Il manque ${manque} joueur${manque > 1 ? 's' : ''}`
              : '⚖️ Ouvrir le procès !'}
          </Bouton>
        ) : (
          <div className="parchemin px-4 py-3 text-center text-base font-extrabold text-encre/70">
            {manque > 0
              ? `En attente de ${manque} joueur${manque > 1 ? 's' : ''} de plus…`
              : "En attente de l'hôte…"}
          </div>
        )}
      </div>
    </Ecran>
  );
}

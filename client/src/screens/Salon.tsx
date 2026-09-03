import { useState } from 'react';
import { MIN_JOUEURS } from '../../../shared/types';
import { useJeu } from '../lib/jeu';
import { Bouton, Ecran, Etiquette, Jeton, Panneau } from '../components/ui';

export default function Salon() {
  const { etat, moi, estHote, actions } = useJeu();
  const [copie, setCopie] = useState(false);
  const [deckOuvert, setDeckOuvert] = useState(false);
  const [txtAccusations, setTxtAccusations] = useState('');
  const [txtObjets, setTxtObjets] = useState('');
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

  /** Une ligne = une carte. */
  const lignes = (texte: string) =>
    texte
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  const aQuoiAjouter = lignes(txtAccusations).length > 0 || lignes(txtObjets).length > 0;

  const ajouterCartes = () => {
    if (!aQuoiAjouter) return;
    actions.ajouterCartes({
      accusations: lignes(txtAccusations),
      objets: lignes(txtObjets),
    });
    setTxtAccusations('');
    setTxtObjets('');
  };

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

      {/* Deck de la partie */}
      <Panneau>
        <button
          onClick={() => setDeckOuvert(!deckOuvert)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <h2 className="text-xl font-bold">Deck de la partie</h2>
          <span className="text-sm font-extrabold text-encre/50">
            {etat.deck.accusations} accus · {etat.deck.objets} objets {deckOuvert ? '▴' : '▾'}
          </span>
        </button>

        {deckOuvert && (
          <div className="mt-3 flex flex-col gap-3">
            {estHote ? (
              <>
                <p className="text-xs font-bold text-encre/50">
                  Ajoute tes propres cartes : <strong>une ligne = une carte</strong>. Les doublons
                  et les lignes vides sont ignorés.
                </p>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
                    Accusations
                  </span>
                  <textarea
                    className="champ !py-2.5 !text-base"
                    rows={3}
                    value={txtAccusations}
                    onChange={(e) => setTxtAccusations(e.target.value)}
                    placeholder={"Tu as vidé le frigo de la coloc.\nTu as vendu le chat du voisin."}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
                    Objets
                  </span>
                  <textarea
                    className="champ !py-2.5 !text-base"
                    rows={3}
                    value={txtObjets}
                    onChange={(e) => setTxtObjets(e.target.value)}
                    placeholder={"perceuse\ncornichon"}
                  />
                </label>

                <Bouton variante="secondaire" onClick={ajouterCartes} disabled={!aQuoiAjouter}>
                  ＋ Ajouter au deck
                </Bouton>
              </>
            ) : (
              <p className="text-xs font-bold text-encre/50">
                Seul l'hôte peut ajouter des cartes.
              </p>
            )}

            {(etat.cartesPerso.accusations.length > 0 || etat.cartesPerso.objets.length > 0) && (
              <div className="flex flex-col gap-2 border-t-2 border-encre/10 pt-3">
                <p className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
                  Ajoutées ({etat.cartesPerso.accusations.length + etat.cartesPerso.objets.length})
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {[
                    ...etat.cartesPerso.accusations.map((c) => ['ACCUSATION', c] as const),
                    ...etat.cartesPerso.objets.map((c) => ['OBJET', c] as const),
                  ].map(([type, c]) => (
                    <li
                      key={type + c}
                      className="flex max-w-full items-center gap-1.5 rounded-full border-2 border-encre/25 bg-white/70 px-3 py-1 text-sm font-bold"
                    >
                      <span className="truncate">{c}</span>
                      {estHote && (
                        <button
                          onClick={() => actions.supprimerCarte(type, c)}
                          className="shrink-0 text-encre/40 hover:text-coupable"
                          aria-label={`Supprimer ${c}`}
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
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

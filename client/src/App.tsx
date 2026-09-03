import { useState } from 'react';
import { useJeu } from './lib/jeu';
import { Bouton, BoutonMuet, cn } from './components/ui';
import Accueil from './screens/Accueil';
import Salon from './screens/Salon';
import AccusationEcran from './screens/Accusation';
import Tirage from './screens/Tirage';
import Defense from './screens/Defense';
import VoteEcran from './screens/Vote';
import Resultat from './screens/Resultat';
import Fin from './screens/Fin';

function Entete() {
  const { etat, actions } = useJeu();
  const [confirme, setConfirme] = useState(false);
  if (!etat) return null;

  return (
    <header className="mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-3">
      <div className="flex items-center gap-2 rounded-xl border-2 border-parchemin/40 bg-white/10 px-3 py-1.5">
        <span className="text-lg">⚖️</span>
        <span className="font-titre text-lg font-bold tracking-[0.15em] text-parchemin">
          {etat.code}
        </span>
      </div>

      {etat.phase !== 'LOBBY' && etat.round && (
        <span className="rounded-xl border-2 border-parchemin/40 bg-white/10 px-3 py-1.5 text-sm font-extrabold text-parchemin">
          {Math.min(etat.round.numero, etat.totalManches)}/{etat.totalManches}
        </span>
      )}

      <div className="flex-1" />
      <BoutonMuet />

      {confirme ? (
        <div className="flex gap-1">
          <Bouton taille="petit" variante="coupable" onClick={actions.quitter}>
            Quitter
          </Bouton>
          <Bouton taille="petit" variante="fantome" onClick={() => setConfirme(false)}>
            ✕
          </Bouton>
        </div>
      ) : (
        <button
          onClick={() => setConfirme(true)}
          aria-label="Quitter la partie"
          className="grid h-10 w-10 place-items-center rounded-xl border-2 border-parchemin/60 bg-white/10 text-lg text-parchemin active:scale-95"
        >
          🚪
        </button>
      )}
    </header>
  );
}

function BandeauErreur() {
  const { erreur, effacerErreur } = useJeu();
  if (!erreur) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <button
        onClick={effacerErreur}
        className="pointer-events-auto animate-tremble rounded-2xl border-[3px] border-encre bg-coupable px-4 py-3 text-center text-base font-extrabold text-white shadow-carte"
      >
        {erreur.message}
      </button>
    </div>
  );
}

function BandeauConnexion() {
  const { connecte } = useJeu();
  if (connecte) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-encre px-4 py-2 text-center text-sm font-extrabold text-parchemin">
      Connexion perdue… reconnexion en cours 🔌
    </div>
  );
}

function Chargement() {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="text-center">
        <p className="animate-flotte text-6xl">⚖️</p>
        <p className="mt-3 font-titre text-xl font-bold text-parchemin">On retrouve ta place…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { etat, chargement } = useJeu();

  let contenu: JSX.Element;
  if (chargement && !etat) contenu = <Chargement />;
  else if (!etat) contenu = <Accueil />;
  else
    switch (etat.phase) {
      case 'LOBBY':
        contenu = <Salon />;
        break;
      case 'ACCUSATION':
        contenu = <AccusationEcran />;
        break;
      case 'TIRAGE_ACCUSE':
        contenu = <Tirage />;
        break;
      case 'DEFENSE':
        contenu = <Defense />;
        break;
      case 'VOTE':
        contenu = <VoteEcran />;
        break;
      case 'RESULTAT':
        contenu = <Resultat />;
        break;
      case 'FIN':
        contenu = <Fin />;
        break;
      default:
        contenu = <Chargement />;
    }

  return (
    <div className={cn('zone-sure flex min-h-full flex-col')}>
      <BandeauErreur />
      {etat && <Entete />}
      {contenu}
      <BandeauConnexion />
    </div>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ErreurPayload, GameState, Player, Settings, Vote } from '../../../shared/types';
import { ecrireSession, lireSession, socket, type SessionLocale } from './socket';
import { jouer } from './sons';

interface Actions {
  creer: (pseudo: string) => void;
  rejoindre: (code: string, pseudo: string) => void;
  quitter: () => void;
  majReglages: (patch: Partial<Settings>) => void;
  ajouterCartes: (p: { accusations?: string[]; objets?: string[] }) => void;
  supprimerCarte: (type: 'ACCUSATION' | 'OBJET', texte: string) => void;
  lancer: () => void;
  cocherMot: (index: number) => void;
  terminerDefense: () => void;
  voter: (vote: Vote) => void;
  mancheSuivante: () => void;
  rejouer: () => void;
}

interface ValeurJeu {
  etat: GameState | null;
  session: SessionLocale | null;
  moi: Player | null;
  estHote: boolean;
  connecte: boolean;
  chargement: boolean;
  erreur: ErreurPayload | null;
  effacerErreur: () => void;
  maintenantServeur: () => number;
  actions: Actions;
}

const ContexteJeu = createContext<ValeurJeu | null>(null);

export function FournisseurJeu({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<GameState | null>(null);
  const [session, setSession] = useState<SessionLocale | null>(() => lireSession());
  const [erreur, setErreur] = useState<ErreurPayload | null>(null);
  const [connecte, setConnecte] = useState(socket.connected);
  // Une session enregistrée = on tente une reconnexion avant d'afficher l'accueil.
  const [chargement, setChargement] = useState(() => lireSession() !== null);

  const decalage = useRef(0); // horloge serveur - horloge locale
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const minuteurErreur = useRef<number | null>(null);

  const signalerErreur = useCallback((e: ErreurPayload) => {
    setErreur(e);
    if (minuteurErreur.current) window.clearTimeout(minuteurErreur.current);
    minuteurErreur.current = window.setTimeout(() => setErreur(null), 5000);
  }, []);

  const oublierSession = useCallback(() => {
    ecrireSession(null);
    setSession(null);
    setEtat(null);
    setChargement(false);
  }, []);

  useEffect(() => {
    const onEtat = (s: GameState) => {
      decalage.current = s.serverNow - Date.now();
      setEtat(s);
      setChargement(false);
    };
    const onErreur = (e: ErreurPayload) => signalerErreur(e);
    const onFx = (e: { type: string }) => {
      if (e.type === 'VERDICT') jouer('marteau');
      else if (e.type === 'TIRAGE') jouer('tirage');
      else if (e.type === 'POINT') jouer('point');
    };
    const onConnect = () => {
      setConnecte(true);
      const s = sessionRef.current;
      if (!s) return;
      // Reprise automatique de la place et du score après un refresh / une coupure.
      socket.emit('rejoindre_partie', { code: s.code, pseudo: s.pseudo, playerId: s.playerId }, (r) => {
        if (r.ok) {
          const maj = { ...s, ...r.session };
          ecrireSession(maj);
          setSession(maj);
        } else {
          oublierSession();
        }
      });
    };
    const onDisconnect = () => setConnecte(false);

    socket.on('etat_partie', onEtat);
    socket.on('erreur', onErreur);
    socket.on('fx', onFx);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();

    // Filet : si le serveur ne répond pas, on retourne à l'accueil.
    const secours = window.setTimeout(() => setChargement(false), 6000);

    return () => {
      socket.off('etat_partie', onEtat);
      socket.off('erreur', onErreur);
      socket.off('fx', onFx);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      window.clearTimeout(secours);
    };
  }, [signalerErreur, oublierSession]);

  const actions = useMemo<Actions>(
    () => ({
      creer: (pseudo) => {
        socket.emit('creer_partie', { pseudo }, (r) => {
          if (r.ok) {
            const s = { ...r.session, pseudo };
            ecrireSession(s);
            setSession(s);
          } else signalerErreur(r.erreur);
        });
      },
      rejoindre: (code, pseudo) => {
        socket.emit('rejoindre_partie', { code: code.toUpperCase(), pseudo }, (r) => {
          if (r.ok) {
            const s = { ...r.session, pseudo };
            ecrireSession(s);
            setSession(s);
          } else signalerErreur(r.erreur);
        });
      },
      quitter: () => {
        socket.emit('quitter_partie');
        oublierSession();
      },
      majReglages: (patch) => socket.emit('maj_reglages', patch),
      ajouterCartes: (p) => socket.emit('ajouter_cartes', p),
      supprimerCarte: (type, texte) => socket.emit('supprimer_carte', { type, texte }),
      lancer: () => socket.emit('lancer_partie'),
      cocherMot: (index) => socket.emit('cocher_mot', { index }),
      terminerDefense: () => socket.emit('terminer_defense'),
      voter: (vote) => socket.emit('voter', { vote }),
      mancheSuivante: () => socket.emit('manche_suivante'),
      rejouer: () => socket.emit('rejouer'),
    }),
    [signalerErreur, oublierSession]
  );

  const moi = useMemo(
    () => etat?.players.find((p) => p.id === session?.playerId) ?? null,
    [etat, session]
  );

  const valeur: ValeurJeu = {
    etat,
    session,
    moi,
    estHote: !!etat && !!moi && etat.hostId === moi.id,
    connecte,
    chargement,
    erreur,
    effacerErreur: () => setErreur(null),
    maintenantServeur: () => Date.now() + decalage.current,
    actions,
  };

  return <ContexteJeu.Provider value={valeur}>{children}</ContexteJeu.Provider>;
}

export function useJeu(): ValeurJeu {
  const v = useContext(ContexteJeu);
  if (!v) throw new Error('useJeu doit être utilisé dans <FournisseurJeu>');
  return v;
}

/** Secondes restantes avant `finTimer` (timestamp serveur), 0 si pas de minuteur. */
export function useCompteARebours(finTimer: number | null | undefined) {
  const { maintenantServeur } = useJeu();
  const calcule = useCallback(() => {
    if (!finTimer) return 0;
    return Math.max(0, (finTimer - maintenantServeur()) / 1000);
  }, [finTimer, maintenantServeur]);

  const [restant, setRestant] = useState(calcule);

  useEffect(() => {
    setRestant(calcule());
    if (!finTimer) return;
    const id = window.setInterval(() => setRestant(calcule()), 200);
    return () => window.clearInterval(id);
  }, [finTimer, calcule]);

  return restant;
}

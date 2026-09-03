import { useCompteARebours, useJeu } from '../lib/jeu';
import { Bouton, Ecran, Jeton, Panneau } from '../components/ui';

export default function Vote() {
  const { etat, moi, actions } = useJeu();
  const r = etat?.round;
  const restant = useCompteARebours(r?.finTimer);
  if (!etat || !r || !moi) return null;

  const accuse = etat.players.find((p) => p.id === r.accuseId);
  const jeSuisJure = moi.id !== r.accusateurId && moi.id !== r.accuseId && moi.connected;
  const jaiVote = r.votants.includes(moi.id);
  const secondes = Math.ceil(restant);

  return (
    <Ecran className="justify-center">
      <Panneau className="text-center !py-4">
        <p className="text-sm font-extrabold uppercase tracking-wide text-encre/60">
          Le jury délibère
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {accuse && <Jeton joueur={accuse} />}
          <p className="font-titre text-2xl font-bold">{accuse?.pseudo}</p>
        </div>
        <p className="mt-2 text-sm font-bold text-encre/60">« {r.carteAccusation} »</p>
      </Panneau>

      {jeSuisJure && !jaiVote ? (
        <>
          <p className="text-center font-titre text-2xl font-bold text-parchemin">
            Ton verdict&nbsp;?
          </p>
          <div className="flex flex-col gap-3">
            <Bouton
              variante="coupable"
              taille="grand"
              className="w-full !py-6 !text-2xl"
              onClick={() => actions.voter('COUPABLE')}
            >
              👎 Coupable
            </Bouton>
            <Bouton
              variante="innocent"
              taille="grand"
              className="w-full !py-6 !text-2xl"
              onClick={() => actions.voter('NON_COUPABLE')}
            >
              👍 Non coupable
            </Bouton>
          </div>
        </>
      ) : (
        <Panneau className="text-center">
          <p className="text-4xl">{jaiVote ? '🗳️' : '👀'}</p>
          <p className="mt-2 text-lg font-extrabold">
            {jaiVote
              ? 'Ton vote est enregistré.'
              : moi.id === r.accuseId
                ? 'Tu es jugé : tu ne votes pas.'
                : moi.id === r.accusateurId
                  ? "L'accusateur ne vote pas."
                  : 'Tu ne fais pas partie du jury.'}
          </p>
        </Panneau>
      )}

      <Panneau className="!py-3 text-center">
        <p className="font-titre text-xl font-bold">
          {r.votants.length}/{r.nbJures} juré{r.nbJures > 1 ? 's' : ''} ont voté
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {etat.players
            .filter((p) => p.id !== r.accusateurId && p.id !== r.accuseId && p.connected)
            .map((p) => (
              <div
                key={p.id}
                className={`transition ${r.votants.includes(p.id) ? '' : 'opacity-30 grayscale'}`}
              >
                <Jeton joueur={p} taille="petit" />
              </div>
            ))}
        </div>
        <p className="mt-2 text-sm font-extrabold text-encre/50">
          Dépouillement dans {secondes} s
        </p>
      </Panneau>
    </Ecran>
  );
}

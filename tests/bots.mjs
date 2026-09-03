/**
 * Bots de test : rejoignent une partie et jouent tout seuls.
 * Pratique pour essayer l'interface sans réunir 4 téléphones.
 *
 *   npm run bots -- PLUM               (3 bots sur http://localhost:3001)
 *   npm run bots -- PLUM 5 http://...  (5 bots, serveur personnalisé)
 */
import { io } from 'socket.io-client';

const code = (process.argv[2] ?? '').toUpperCase();
const nombre = Number(process.argv[3] ?? 3);
const url = process.argv[4] ?? 'http://localhost:3001';

if (!/^[A-Z]{4,6}$/.test(code)) {
  console.error('Usage : npm run bots -- CODE [nombre] [url]');
  process.exit(1);
}

const NOMS = ['Robot', 'Bidule', 'Marcel', 'Zoé', 'Gaston', 'Nadia', 'Pixel', 'Truc'];

for (let i = 0; i < nombre; i++) {
  const pseudo = NOMS[i % NOMS.length] + (i >= NOMS.length ? i : '');
  const socket = io(url, { transports: ['websocket'] });
  let dernierePhase = null;
  let monId = null;

  socket.on('connect', () => {
    socket.emit('rejoindre_partie', { code, pseudo }, (r) => {
      if (!r.ok) {
        console.error(`${pseudo} : ${r.erreur.message}`);
        process.exit(1);
      }
      monId = r.session.playerId;
      console.log(`🤖 ${pseudo} a rejoint ${code}`);
    });
  });

  socket.on('etat_partie', (etat) => {
    const r = etat.round;
    const cle = `${etat.phase}:${r?.numero ?? 0}`;
    if (cle === dernierePhase || !monId) return;
    dernierePhase = cle;

    if (etat.phase === 'DEFENSE' && r.accuseId === monId) {
      // Le bot coche ses 3 mots puis conclut (il rate un mot une fois sur cinq).
      const rate = process.env.BOTS_LENT ? false : Math.random() < 0.2;
      r.cartesObjet.forEach((_, i) => {
        if (rate && i === 2) return;
        setTimeout(() => socket.emit('cocher_mot', { index: i }), 900 + i * 900);
      });
      // BOTS_LENT=1 : les bots laissent filer le minuteur (pratique pour inspecter l'écran).
      if (!process.env.BOTS_LENT) setTimeout(() => socket.emit('terminer_defense'), 4200);
    }

    if (etat.phase === 'VOTE' && r.accuseId !== monId && r.accusateurId !== monId) {
      setTimeout(
        () => socket.emit('voter', { vote: Math.random() < 0.5 ? 'COUPABLE' : 'NON_COUPABLE' }),
        1200 + Math.random() * 2500
      );
    }
  });
}

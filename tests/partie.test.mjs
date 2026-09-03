/**
 * Test de bout en bout des regles du jeu.
 * Lancer d'abord un serveur en mode rapide :
 *   npm run test:serveur   (dans un terminal)
 *   npm test               (dans un autre)
 */
import { io } from 'socket.io-client';

const URL = process.env.URL_TEST ?? 'http://localhost:3111';
let echecs = 0;
const ok = (c, msg) => {
  console.log(`${c ? '  ✓' : '  ✗'} ${msg}`);
  if (!c) echecs++;
};
const titre = (t) => console.log(`\n${t}`);

function creerClient(pseudo) {
  const socket = io(URL, { transports: ['websocket'] });
  const c = { pseudo, socket, etat: null, id: null, phases: [], erreurs: [], attentes: [] };
  socket.on('etat_partie', (e) => {
    if (c.phases[c.phases.length - 1] !== e.phase) c.phases.push(e.phase);
    c.etat = e;
    c.attentes = c.attentes.filter((a) => {
      if (a.test(e)) { a.resolve(e); return false; }
      return true;
    });
  });
  socket.on('erreur', (e) => c.erreurs.push(e));
  return c;
}

const emit = (c, ev, p) => new Promise((res) => c.socket.emit(ev, p, res));
function attendre(c, test, label, timeout = 9000) {
  return new Promise((res, rej) => {
    if (c.etat && test(c.etat)) return res(c.etat);
    const a = { test, resolve: res };
    c.attentes.push(a);
    setTimeout(() => {
      c.attentes = c.attentes.filter((x) => x !== a);
      rej(new Error(`timeout en attendant : ${label} (phase=${c.etat?.phase})`));
    }, timeout);
  });
}
const phase = (c, p) => attendre(c, (e) => e.phase === p, `phase ${p}`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
async function main() {
  titre('1. Salon : création, code, arrivées en temps réel');
  const j = ['Alice', 'Bob', 'Chloé', 'David'].map(creerClient);
  const r1 = await emit(j[0], 'creer_partie', { pseudo: 'Alice' });
  ok(r1.ok, 'création de la partie');
  const code = r1.session.code;
  j[0].id = r1.session.playerId;
  ok(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code), `code à 4 lettres sans I/O/0/1 : ${code}`);

  for (let i = 1; i < 4; i++) {
    const r = await emit(j[i], 'rejoindre_partie', { code, pseudo: j[i].pseudo });
    ok(r.ok, `${j[i].pseudo} rejoint`);
    j[i].id = r.session.playerId;
  }
  await Promise.all(j.map((c) => attendre(c, (e) => e.players.length === 4, '4 joueurs')));
  ok(j.every((c) => c.etat.players.length === 4), 'tous les écrans voient 4 joueurs');
  ok(j[0].etat.hostId === j[0].id, 'Alice est hôte');
  ok(j[0].etat.players.map((p) => p.pseudo).join(',') === 'Alice,Bob,Chloé,David', "ordre d'arrivée conservé");

  titre('2. Garde-fous du salon');
  const doublon = await emit(creerClient('x'), 'rejoindre_partie', { code, pseudo: 'Bob' });
  ok(!doublon.ok && doublon.erreur.code === 'PSEUDO_PRIS', 'pseudo déjà pris refusé');
  const inconnu = await emit(creerClient('y'), 'rejoindre_partie', { code: 'ZZZZ', pseudo: 'Zoé' });
  ok(!inconnu.ok && inconnu.erreur.code === 'PARTIE_INTROUVABLE', 'code invalide refusé');
  j[1].socket.emit('lancer_partie');
  await pause(150);
  ok(j[1].erreurs.some((e) => e.code === 'PAS_HOTE'), 'un non-hôte ne peut pas lancer');

  titre('3. Réglages');
  j[0].socket.emit('maj_reglages', { toursParJoueur: 1, dureeDefenseSec: 30 });
  await attendre(j[2], (e) => e.settings.toursParJoueur === 1, 'réglages diffusés');
  ok(j[2].etat.settings.toursParJoueur === 1, 'réglage propagé à tous');

  titre('4. Partie complète (4 manches)');
  j[0].socket.emit('lancer_partie');
  await phase(j[0], 'ACCUSATION');
  ok(j[0].etat.totalManches === 4, 'totalManches = 4 joueurs × 1 tour');

  const attendus = Object.fromEntries(j.map((x) => [x.id, 0]));
  const accusateurs = [];

  for (let manche = 1; manche <= 4; manche++) {
    await attendre(j[0], (e) => e.phase === 'ACCUSATION' && e.round.numero === manche, `manche ${manche}`);
    const r = j[0].etat.round;
    accusateurs.push(r.accusateurId);
    ok(!!r.carteAccusation, `m${manche} : carte accusation tirée`);

    await phase(j[0], 'TIRAGE_ACCUSE');
    const accuseId = j[0].etat.round.accuseId;
    ok(accuseId !== r.accusateurId, `m${manche} : l'accusé n'est pas l'accusateur`);

    await phase(j[0], 'DEFENSE');
    const rd = j[0].etat.round;
    ok(rd.cartesObjet.length === 3, `m${manche} : 3 cartes objet`);
    const finDefense = rd.finTimer;
    const resteDefense = finDefense - j[0].etat.serverNow;
    ok(
      resteDefense > 0 && resteDefense <= j[0].etat.settings.dureeDefenseSec * 1000 + 500,
      `m${manche} : minuteur de défense cohérent (${Math.round(resteDefense / 1000)}s)`
    );
    ok(new Set(rd.cartesObjet).size === 3, `m${manche} : 3 mots différents`);
    const accuse = j.find((x) => x.id === accuseId);
    const accusateur = j.find((x) => x.id === r.accusateurId);
    const jures = j.filter((x) => x.id !== accuseId && x.id !== r.accusateurId);

    // Manche 3 : on ne coche que 2 mots sur 3 => coupable direct.
    const motsACocher = manche === 3 ? 2 : 3;
    for (let i = 0; i < motsACocher; i++) accuse.socket.emit('cocher_mot', { index: i });
    await attendre(accuse, (e) => e.round.motsUtilises.filter(Boolean).length === motsACocher, 'mots cochés');
    // Les coches doivent arriver sur les écrans des autres joueurs (timeout = échec).
    const temoinCoche = j.find((x) => x.id !== accuseId);
    await attendre(
      temoinCoche,
      (e) => e.round.motsUtilises.filter(Boolean).length === motsACocher,
      'coches diffusées'
    );
    ok(true, `m${manche} : les coches sont visibles par tous`);
    accuse.socket.emit('terminer_defense');

    if (manche === 3) {
      await phase(j[0], 'RESULTAT');
      const rr = j[0].etat.round;
      ok(rr.coupableDirect === true && rr.verdict === 'COUPABLE', 'm3 : coupable direct (mots manquants)');
      ok(!j[0].phases.slice(-2).includes('VOTE'), 'm3 : le vote est bien sauté');
      ok(rr.pointsGagnes[r.accusateurId] === 1, "m3 : +1 pour l'accusateur");
      ok(Object.keys(rr.pointsGagnes).length === 1, 'm3 : aucun point de juré');
      attendus[r.accusateurId] += 1;
    } else {
      await phase(j[0], 'VOTE');
      ok(j[0].etat.round.nbJures === 2, `m${manche} : 2 jurés`);
      // Régression : le minuteur diffusé doit être celui du vote, pas celui de la défense.
      const resteVote = j[0].etat.round.finTimer - j[0].etat.serverNow;
      ok(
        j[0].etat.round.finTimer !== finDefense && resteVote > 0 && resteVote <= 30000,
        `m${manche} : minuteur de vote propre à la phase (${Math.round(resteVote / 1000)}s)`
      );
      ok(j[0].etat.round.votes === null, `m${manche} : les votes restent secrets pendant le vote`);

      let verdictAttendu;
      if (manche === 1) {
        jures.forEach((x) => x.socket.emit('voter', { vote: 'COUPABLE' }));
        verdictAttendu = 'COUPABLE';
        attendus[r.accusateurId] += 1;
        jures.forEach((x) => (attendus[x.id] += 1));
      } else if (manche === 2) {
        // Égalité 1-1 => bénéfice du doute.
        jures[0].socket.emit('voter', { vote: 'COUPABLE' });
        await pause(80);
        ok(j[0].etat.round.votants.length === 1, 'm2 : décompte « 1/2 » sans révéler le vote');
        jures[1].socket.emit('voter', { vote: 'NON_COUPABLE' });
        verdictAttendu = 'NON_COUPABLE';
        attendus[accuseId] += 1;
        attendus[jures[1].id] += 1;
      } else {
        // Personne ne vote : on laisse expirer le minuteur de vote.
        verdictAttendu = 'NON_COUPABLE';
        attendus[accuseId] += 1;
      }

      await phase(j[0], 'RESULTAT');
      const rr = j[0].etat.round;
      ok(rr.verdict === verdictAttendu, `m${manche} : verdict ${verdictAttendu}`);
      if (manche === 2) ok(rr.verdict === 'NON_COUPABLE', 'm2 : égalité = non coupable');
      if (manche === 4) ok(Object.keys(rr.votes ?? {}).length === 0, 'm4 : dépouillement sans vote reçu');
      ok(rr.votes !== null, `m${manche} : votes révélés au résultat`);
    }

    // Vérification des scores cumulés vus par un autre client.
    await attendre(j[2], (e) => e.phase === 'RESULTAT' && e.round.numero === manche, 'résultat vu par tous');
    const vus = Object.fromEntries(j[2].etat.players.map((p) => [p.id, p.score]));
    const conforme = j.every((x) => vus[x.id] === attendus[x.id]);
    ok(conforme, `m${manche} : scores corrects (${j.map((x) => `${x.pseudo}=${vus[x.id]}`).join(' ')})`);

    if (manche < 4) {
      j[0].socket.emit('manche_suivante');
    }
  }

  ok(new Set(accusateurs).size === 4, 'chaque joueur a été accusateur une fois');
  ok(accusateurs.join(',') === j.map((x) => x.id).join(','), "rotation dans l'ordre d'arrivée");

  titre('5. Fin de partie');
  j[0].socket.emit('manche_suivante');
  await phase(j[0], 'FIN');
  ok(j[0].etat.phase === 'FIN', 'phase FIN atteinte après 4 manches');
  const total = j[0].etat.players.reduce((s, p) => s + p.score, 0);
  ok(total === Object.values(attendus).reduce((a, b) => a + b, 0), `total des points cohérent (${total})`);

  titre('6. Rejouer');
  j[0].socket.emit('rejouer');
  await phase(j[0], 'ACCUSATION');
  ok(j[0].etat.players.every((p) => p.score === 0), 'scores remis à zéro');
  ok(j[0].etat.round.numero === 1, 'nouvelle partie à la manche 1');

  j.forEach((x) => x.socket.disconnect());
  await pause(200);

  // =========================================================================
  titre('7. Minimum 4 joueurs');
  const petit = ['A', 'B', 'C'].map(creerClient);
  const rp = await emit(petit[0], 'creer_partie', { pseudo: 'A' });
  petit[0].id = rp.session.playerId;
  for (let i = 1; i < 3; i++) await emit(petit[i], 'rejoindre_partie', { code: rp.session.code, pseudo: petit[i].pseudo });
  petit[0].socket.emit('lancer_partie');
  await pause(200);
  ok(petit[0].erreurs.some((e) => e.code === 'PAS_ASSEZ_DE_JOUEURS'), 'lancement bloqué à 3 joueurs');
  petit.forEach((x) => x.socket.disconnect());

  // =========================================================================
  titre('8. Déconnexions et reconnexion');
  const k = ['Ana', 'Ben', 'Cléo', 'Dan', 'Eve'].map(creerClient);
  const rk = await emit(k[0], 'creer_partie', { pseudo: 'Ana' });
  const codeK = rk.session.code;
  k[0].id = rk.session.playerId;
  for (let i = 1; i < 5; i++) {
    const r = await emit(k[i], 'rejoindre_partie', { code: codeK, pseudo: k[i].pseudo });
    k[i].id = r.session.playerId;
  }
  k[0].socket.emit('maj_reglages', { toursParJoueur: 2, dureeDefenseSec: 40 });
  await attendre(k[4], (e) => e.settings.toursParJoueur === 2, 'réglages');
  k[0].socket.emit('lancer_partie');

  await phase(k[1], 'DEFENSE');
  const accuseId = k[1].etat.round.accuseId;
  const accusateurId = k[1].etat.round.accusateurId;
  const clientAccuse = k.find((x) => x.id === accuseId);
  const temoin = k.find((x) => x.id !== accuseId && x.id !== accusateurId);
  clientAccuse.socket.disconnect();
  await attendre(temoin, (e) => e.phase === 'DEFENSE' && e.round.accuseId !== accuseId, 'retirage accusé');
  ok(temoin.etat.round.accuseId !== accuseId, "accusé déconnecté => nouvel accusé tiré au sort");
  ok(temoin.etat.round.accuseId !== accusateurId, "le nouvel accusé n'est pas l'accusateur");
  ok(temoin.etat.players.find((p) => p.id === accuseId).connected === false, 'joueur marqué déconnecté');

  // Reconnexion avec le même identifiant : place et score conservés.
  const revenu = creerClient('Retour');
  const rr = await emit(revenu, 'rejoindre_partie', { code: codeK, pseudo: clientAccuse.pseudo, playerId: accuseId });
  ok(rr.ok && rr.session.playerId === accuseId, 'reconnexion par identifiant (refresh)');
  await attendre(temoin, (e) => e.players.find((p) => p.id === accuseId).connected === true, 'reconnecté');
  ok(temoin.etat.players.length === 5, 'aucun joueur fantôme après reconnexion');

  // L'hôte quitte : transfert automatique.
  const ancienHote = k[0].etat.hostId;
  k[0].socket.disconnect();
  await attendre(temoin, (e) => e.hostId !== ancienHote, 'transfert hôte');
  ok(temoin.etat.hostId !== ancienHote, "l'hôte est transféré quand il part");
  ok(temoin.etat.players.find((p) => p.id === temoin.etat.hostId).connected, 'le nouvel hôte est connecté');

  [...k, revenu].forEach((x) => x.socket.disconnect());
  await pause(200);

  // =========================================================================
  titre('9. Codes uniques');
  const codes = new Set();
  const tmp = [];
  for (let i = 0; i < 40; i++) {
    const c = creerClient('t' + i);
    tmp.push(c);
    const r = await emit(c, 'creer_partie', { pseudo: 't' + i });
    codes.add(r.session.code);
  }
  ok(codes.size === 40, '40 parties simultanées, 40 codes distincts');
  tmp.forEach((x) => x.socket.disconnect());

  // =========================================================================
  titre('10. Plus aucun juré pendant le vote');
  const q = ['Ida', 'Jo', 'Kim', 'Léo'].map(creerClient);
  const rq = await emit(q[0], 'creer_partie', { pseudo: 'Ida' });
  q[0].id = rq.session.playerId;
  for (let i = 1; i < 4; i++) {
    const r = await emit(q[i], 'rejoindre_partie', { code: rq.session.code, pseudo: q[i].pseudo });
    q[i].id = r.session.playerId;
  }
  q[0].socket.emit('maj_reglages', { toursParJoueur: 1, dureeDefenseSec: 60 });
  await attendre(q[3], (e) => e.settings.toursParJoueur === 1, 'réglages');
  q[0].socket.emit('lancer_partie');
  await phase(q[1], 'DEFENSE');
  const accuseQ = q.find((x) => x.id === q[1].etat.round.accuseId);
  q[1].etat.round.cartesObjet.forEach((_, i) => accuseQ.socket.emit('cocher_mot', { index: i }));
  await attendre(accuseQ, (e) => e.round.motsUtilises.every(Boolean), 'mots cochés');
  accuseQ.socket.emit('terminer_defense');
  await phase(accuseQ, 'VOTE');
  const juresQ = q.filter((x) => x.id !== accuseQ.id && x.id !== accuseQ.etat.round.accusateurId);
  ok(juresQ.length === 2, '2 jurés au départ');
  juresQ.forEach((x) => x.socket.disconnect());
  await phase(accuseQ, 'RESULTAT');
  ok(accuseQ.etat.round.verdict === 'NON_COUPABLE', 'plus aucun juré => non coupable (bénéfice du doute)');
  ok(accuseQ.etat.round.pointsGagnes[accuseQ.id] === 1, "+1 pour l'accusé malgré l'absence de jury");
  q.forEach((x) => x.socket.disconnect());
  await pause(200);

  console.log(`\n${echecs === 0 ? '✅ Tous les tests passent.' : `❌ ${echecs} test(s) en échec.`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n💥', e.message);
  process.exit(1);
});

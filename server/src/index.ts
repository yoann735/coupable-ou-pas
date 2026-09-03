import { MIN_JOUEURS } from '../../shared/types';
import { creerApplication } from './serveur';

const PORT = Number(process.env.PORT ?? 3001);
const { httpServer } = creerApplication();

httpServer.listen(PORT, () => {
  console.log(`\n  ⚖️  Coupable ou pas coupable ? — serveur prêt`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → minimum ${MIN_JOUEURS} joueurs par partie\n`);
});

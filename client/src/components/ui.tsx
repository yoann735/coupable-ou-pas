import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Player } from '../../../shared/types';
import { basculerMuet, estMuet, jouer, surChangementMuet } from '../lib/sons';

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Bouton
// ---------------------------------------------------------------------------
type Variante = 'primaire' | 'secondaire' | 'coupable' | 'innocent' | 'fantome';

const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-laiton text-encre border-encre hover:brightness-105',
  secondaire: 'bg-bois-clair text-white border-encre hover:brightness-105',
  coupable: 'bg-coupable text-white border-encre hover:brightness-105',
  innocent: 'bg-innocent text-white border-encre hover:brightness-105',
  fantome: 'bg-white/10 text-parchemin border-parchemin/60 hover:bg-white/20',
};

export function Bouton({
  variante = 'primaire',
  taille = 'normal',
  className,
  onClick,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  taille?: 'normal' | 'grand' | 'petit';
}) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!props.disabled) jouer('clic');
        onClick?.(e);
      }}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-2xl border-[3px] font-extrabold',
        'shadow-bd transition-[transform,filter] active:translate-y-[3px] active:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 disabled:active:shadow-bd',
        taille === 'grand' && 'px-6 py-4 text-xl',
        taille === 'normal' && 'px-5 py-3 text-base',
        taille === 'petit' && 'px-3 py-2 text-sm',
        VARIANTES[variante],
        className
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Avatars : dérivés du pseudo, stables d'un écran à l'autre
// ---------------------------------------------------------------------------
const EMOJIS = ['🐻', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🐰', '🐨', '🐯', '🦄', '🐢', '🦉', '🐙', '🦖', '🐷'];
const TEINTES = ['#F4A259', '#7FB069', '#5BC0EB', '#E8A0BF', '#C3A6F2', '#F2C14E', '#79C7C5', '#EF8354'];

function hash(texte: string) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarDe(pseudo: string) {
  const h = hash(pseudo);
  return { emoji: EMOJIS[h % EMOJIS.length], teinte: TEINTES[(h >> 4) % TEINTES.length] };
}

export function Jeton({
  joueur,
  taille = 'normal',
  couronne = false,
  className,
}: {
  joueur: Player;
  taille?: 'normal' | 'grand' | 'petit';
  couronne?: boolean;
  className?: string;
}) {
  const { emoji, teinte } = avatarDe(joueur.pseudo);
  return (
    <div
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full border-[3px] border-encre',
        taille === 'grand' && 'h-20 w-20 text-4xl',
        taille === 'normal' && 'h-12 w-12 text-2xl',
        taille === 'petit' && 'h-9 w-9 text-lg',
        !joueur.connected && 'opacity-40 grayscale',
        className
      )}
      style={{ backgroundColor: teinte }}
    >
      <span>{emoji}</span>
      {couronne && (
        <span className="absolute -top-3 -right-2 rotate-12 text-lg drop-shadow">👑</span>
      )}
      {!joueur.connected && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-encre px-1 text-[10px] text-white">
          ⏻
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocs de mise en page
// ---------------------------------------------------------------------------
export function Ecran({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pb-6', className)}>
      {children}
    </div>
  );
}

export function Panneau({
  children,
  className,
  anime = true,
}: {
  children: ReactNode;
  className?: string;
  anime?: boolean;
}) {
  return (
    <div className={cn('parchemin shrink-0 p-5', anime && 'animate-entree', className)}>{children}</div>
  );
}

export function Etiquette({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border-2 border-encre bg-laiton px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-encre',
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Minuteur
// ---------------------------------------------------------------------------
export function Minuteur({ restant, total }: { restant: number; total: number }) {
  const secondes = Math.ceil(restant);
  const urgent = secondes <= 20;
  const ratio = total > 0 ? Math.max(0, Math.min(1, restant / total)) : 0;
  const mm = Math.floor(secondes / 60);
  const ss = String(secondes % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'font-titre text-5xl font-bold tabular-nums',
          urgent ? 'animate-urgent text-coupable' : 'text-encre'
        )}
      >
        {mm}:{ss}
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border-2 border-encre bg-encre/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200 ease-linear',
            urgent ? 'bg-coupable' : 'bg-innocent'
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bouton muet
// ---------------------------------------------------------------------------
export function BoutonMuet() {
  const [muet, setMuet] = useState(estMuet);
  useEffect(() => surChangementMuet(setMuet), []);
  return (
    <button
      onClick={() => setMuet(basculerMuet())}
      aria-label={muet ? 'Activer le son' : 'Couper le son'}
      className="grid h-10 w-10 place-items-center rounded-xl border-2 border-parchemin/60 bg-white/10 text-lg text-parchemin transition active:scale-95"
    >
      {muet ? '🔇' : '🔊'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Confettis (fin de partie)
// ---------------------------------------------------------------------------
export function Confettis({ nombre = 40 }: { nombre?: number }) {
  const morceaux = useMemo(
    () =>
      Array.from({ length: nombre }, (_, i) => ({
        id: i,
        gauche: Math.random() * 100,
        delai: Math.random() * 2.5,
        duree: 2.6 + Math.random() * 2,
        teinte: TEINTES[i % TEINTES.length],
        taille: 7 + Math.random() * 9,
      })),
    [nombre]
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {morceaux.map((m) => (
        <span
          key={m.id}
          className="absolute top-0 block animate-confetti rounded-[2px]"
          style={{
            left: `${m.gauche}%`,
            width: m.taille,
            height: m.taille * 1.6,
            backgroundColor: m.teinte,
            animationDelay: `${m.delai}s`,
            animationDuration: `${m.duree}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marteau de juge
// ---------------------------------------------------------------------------
export function Marteau({ className, anime = false }: { className?: string; anime?: boolean }) {
  return (
    <span
      className={cn('inline-block origin-bottom-left text-5xl', anime && 'animate-marteau', className)}
      aria-hidden
    >
      🔨
    </span>
  );
}

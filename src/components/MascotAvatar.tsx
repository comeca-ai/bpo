import type { ReactNode } from 'react';

export type MascotId = 'bia' | 'tom' | 'lia' | 'pedro';

type MascotDef = {
  bg: string;
  skin: string;
  hair: string;
  extra?: ReactNode;
};

/** Definições canônicas dos mascotes (design.md / mockups). */
const MASCOTS: Record<MascotId, MascotDef> = {
  bia: { bg: '#FFF4E6', skin: '#F2C29B', hair: '#8A5A2B' },
  tom: {
    bg: '#E7F8F2',
    skin: '#E8B08A',
    hair: '#2E2721',
    extra: <rect x={14} y={17} width={16} height={3.5} rx={1.75} fill="#2FC79E" />,
  },
  lia: { bg: '#FBEBEA', skin: '#F2C29B', hair: '#C96A2B' },
  pedro: {
    bg: '#2E2721',
    skin: '#C98D5E',
    hair: '#3B2F26',
    extra: <rect x={14} y={34} width={16} height={3} rx={1.5} fill="#2FC79E" />,
  },
};

/**
 * Avatar mascote em SVG inline — réplica da função `avatar()` dos mockups.
 * Quadrado arredondado (rx=12), NÃO circular.
 */
export default function MascotAvatar({
  id,
  size = 38,
  radius = 12,
  className,
}: {
  id: MascotId;
  size?: number;
  radius?: number;
  className?: string;
}) {
  const m = MASCOTS[id];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      style={{ display: 'block', borderRadius: radius }}
      aria-hidden="true"
    >
      <rect width={44} height={44} rx={12} fill={m.bg} />
      <circle cx={22} cy={27} r={9} fill={m.skin} />
      <path
        d="M13 24 q0 -12 9 -12 q9 0 9 12 l-2 0 q0 -8 -7 -8 q-7 0 -7 8 z"
        fill={m.hair}
      />
      <circle cx={18.5} cy={26} r={1.6} fill="#2E2721" />
      <circle cx={25.5} cy={26} r={1.6} fill="#2E2721" />
      <path
        d="M18.5 30.5 q3.5 3 7 0"
        stroke="#2E2721"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      {m.extra}
    </svg>
  );
}

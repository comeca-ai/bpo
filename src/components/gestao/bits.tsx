import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ---------- micro-componentes compartilhados das páginas de gestão ----------
   Mesma linguagem do console (Home.tsx): pills, live-dot, entradas Rise,
   count-up e a topbar padrão (busca pill + Pipeline ao vivo + avatar NJ). */

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn('h-[9px] w-[9px] shrink-0 animate-pulse-ring rounded-full bg-aj-teal', className)}
    />
  );
}

export type PillTone = 'green' | 'orange' | 'gray' | 'red' | 'teal';

export function Pill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] whitespace-nowrap rounded-full px-[15px] py-[9px] text-[12.5px] font-black',
        tone === 'green' && 'border border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark',
        tone === 'orange' && 'bg-aj-actbg text-aj-orange',
        tone === 'gray' && 'border border-aj-border bg-white text-aj-muted',
        tone === 'red' && 'bg-aj-danger-soft text-aj-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Rise({
  delay = 0,
  y = 16,
  className,
  children,
}: {
  delay?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
      fromRef.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  return <>{format(useCountUp(value))}</>;
}

/** Bloco de skeleton nos tokens do design (trilho #F1E8D8, pulso suave). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[12px] bg-aj-rail', className)} />;
}

/** Topbar padrão do console: busca pill + pill green "Pipeline ao vivo" + avatar NJ. */
export function OpsTopbar({
  placeholder,
  search,
  onSearch,
  delay = 0,
}: {
  placeholder: string;
  search?: string;
  onSearch?: (v: string) => void;
  delay?: number;
}) {
  return (
    <Rise delay={delay} y={12} className="flex items-center gap-3">
      <div className="flex flex-1 items-center gap-[10px] rounded-full border border-aj-border bg-white px-[18px] py-[11px] text-[14px] font-bold text-aj-faint transition-shadow focus-within:[box-shadow:0_0_0_3px_rgba(245,130,13,.15)]">
        🔎
        <input
          value={search}
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent font-[inherit] text-aj-ink outline-none placeholder:text-aj-faint"
        />
      </div>
      <Pill tone="green">
        <LiveDot />
        Pipeline ao vivo
      </Pill>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aj-orange text-[15px] font-black text-white">
        NJ
      </div>
    </Rise>
  );
}

import { cn } from '@/lib/utils';

/**
 * Logo "ajeita" (peso 800, minúscula) com o tick teal:
 * barra de 4px embaixo + traço vertical 4x14 à direita da barra.
 * `variant="light"` → branca (sidebar escura); `variant="dark"` → ink (superfícies claras).
 */
export default function LogoTick({
  variant = 'dark',
  className,
}: {
  variant?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-block text-[28px] font-extrabold leading-none tracking-[-0.02em]',
        variant === 'light' ? 'text-white' : 'text-aj-ink',
        className,
      )}
    >
      ajeita
      <span className="absolute bottom-[-6px] left-[1px] right-[16%] h-1 rounded-[2px] bg-aj-teal">
        <span className="absolute bottom-0 right-[-4px] h-[14px] w-1 rounded-[2px] bg-aj-teal" />
      </span>
    </span>
  );
}

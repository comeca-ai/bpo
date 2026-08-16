import { cn } from "@/lib/utils";

/**
 * Logo da vitrine pública — réplica fiel do mockup landing-original.html.
 * variant="header": "ajeita" laranja (34px/800) + tick teal + ".ia" em ink.
 * variant="footer": "ajeita" branca (44px/800) + tick branco (footer escuro).
 */
export default function LogoVitrine({
  variant = "header",
  className,
}: {
  variant?: "header" | "footer";
  className?: string;
}) {
  if (variant === "footer") {
    return (
      <span
        className={cn(
          "relative inline-block whitespace-nowrap text-[44px] font-extrabold leading-none tracking-[-0.02em] text-white",
          className,
        )}
      >
        ajeita
        <span className="absolute bottom-[-11px] left-[1px] right-[19%] h-[5px] rounded-l-[3px] bg-white">
          <span className="absolute bottom-0 right-[-5px] h-[16px] w-[5px] rounded-br-[3px] bg-white" />
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap leading-none", className)}>
      <span className="relative inline-block text-[34px] font-extrabold tracking-[-0.02em] text-aj-orange">
        ajeita
        <span className="absolute bottom-[-9px] left-[1px] right-[19%] h-1 rounded-l-[2px] bg-aj-teal">
          <span className="absolute bottom-0 right-[-4px] h-[13px] w-1 rounded-br-[2px] bg-aj-teal" />
        </span>
      </span>
      <span className="text-[34px] font-extrabold tracking-[-0.02em] text-aj-ink">.ia</span>
    </span>
  );
}

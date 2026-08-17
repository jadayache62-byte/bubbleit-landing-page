import clsx from "clsx";

type ServicePopularBadgeProps = {
  label: string;
  selected?: boolean;
  className?: string;
};

export function ServicePopularBadge({
  label,
  selected = false,
  className,
}: ServicePopularBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] shadow-[0_6px_18px_rgba(38,34,98,0.22)]",
        selected
          ? "border-white/70 bg-white text-[color:var(--navy)]"
          : "border-[color:var(--navy)] bg-[color:var(--navy)] text-white",
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-3.5 w-3.5 shrink-0 text-[color:var(--cyan)]"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 1.75 12.1 7.9 18.25 10l-6.15 2.1L10 18.25l-2.1-6.15L1.75 10 7.9 7.9 10 1.75Z" />
      </svg>
      {label}
    </span>
  );
}

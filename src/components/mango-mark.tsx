export function MangoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Mango Bank">
      <path d="M18 30c2-12 14-18 24-16 8 2 16 12 14 24-2 14-14 20-26 16-10-3-14-12-12-24z" fill="#f08a24" />
      <path d="M36 16c2-8 10-10 14-8-2 6-6 10-12 10" fill="#2f6b45" />
      <path d="M28 28c4 2 8 8 8 14" fill="none" stroke="#c45e12" strokeWidth="2" />
    </svg>
  );
}

export function MangoWordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={"inline-flex items-center gap-2 font-serif text-2xl " + (light ? "text-gold-ink" : "text-fg")}>
      <MangoMark className="h-8 w-8" />
      Mango Bank
    </span>
  );
}

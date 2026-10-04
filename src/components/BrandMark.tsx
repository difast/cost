// Знак ЭВМО: крыша над буквой «Э». Тот же рисунок — в public/icons (фавикон, PWA, иконка «Домой» на iOS).
export function BrandMark({ size = 26, bg = "#176b4d", fg = "#fff" }: { size?: number; bg?: string; fg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0">
      <rect width="512" height="512" rx="112" fill={bg} />
      <g fill="none" stroke={fg} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round">
        <path d="M124 176 256 92l132 84" />
        <path d="M191.8 250.7A96 96 0 1 1 191.8 393.3" />
        <path d="M220 322H352" />
      </g>
    </svg>
  );
}

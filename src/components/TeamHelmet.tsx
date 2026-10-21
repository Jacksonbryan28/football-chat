import { useId, type CSSProperties } from 'react';
import { TEAM_COLORS } from '@/lib/teamColors';
import { cn } from '@/lib/utils';

// A football helmet that wears a team's colors. Pass an NFL abbreviation ("KC");
// with no team (or an unknown one) it shows in neutral gray.
//
// Colors reach the drawing through CSS variables (--helmet-shell, --helmet-stripe,
// --helmet-accent), so they fade smoothly when the team changes. To use your own
// artwork, keep the three fill slots (shell, stripe, accent) and the mask, and
// replace the shapes below.

const NEUTRAL = { name: 'Football', shell: '#9CA3AF', stripe: '#D1D5DB', accent: '#6B7280' };

export type HelmetAnimation = 'none' | 'bob' | 'clash';

interface TeamHelmetProps {
  team?: string | null;
  /** Width in pixels (height follows). */
  size?: number;
  /** none: still. bob: gentle thinking motion. clash: lunges forward, for two helmets facing each other. */
  animation?: HelmetAnimation;
  /** Face left instead of right. */
  flip?: boolean;
  /** Accessible name. Leave out when the team name is shown in text next to it. */
  label?: string;
  className?: string;
}

export function TeamHelmet({ team, size = 40, animation = 'none', flip = false, label, className }: TeamHelmetProps) {
  const clipId = useId();
  const colors = (team && TEAM_COLORS[team]) || NEUTRAL;

  const style = {
    width: size,
    '--helmet-shell': colors.shell,
    '--helmet-stripe': colors.stripe,
    '--helmet-accent': colors.accent,
  } as CSSProperties;

  return (
    <span
      className={cn('helmet inline-block shrink-0', animation !== 'none' && `helmet-${animation}`, flip && 'helmet-flip', className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 104 76" className="block h-auto w-full overflow-visible" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <defs>
          <clipPath id={clipId}>
            <path d={SHELL} />
          </clipPath>
        </defs>

        {/* shell */}
        <path d={SHELL} className="helmet-fill" style={{ fill: 'var(--helmet-shell)' }} />

        {/* stripe, trimmed to the shell */}
        <g clipPath={`url(#${clipId})`}>
          <path d="M18 28 C34 6 70 4 94 26" fill="none" strokeWidth="7" strokeLinecap="round" className="helmet-stroke" style={{ stroke: 'var(--helmet-stripe)' }} />
          <circle cx="36" cy="38" r="6.5" className="helmet-fill" style={{ fill: 'var(--helmet-accent)' }} />
        </g>

        {/* shading and ear hole */}
        <path d="M24 34 C28 22 38 14 50 12" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <circle cx="58" cy="48" r="3.5" fill="#000" fillOpacity="0.4" />

        {/* outline so very dark or very light helmets stay visible on any background */}
        <path d={SHELL} fill="none" strokeWidth="1.5" style={{ stroke: 'var(--helmet-outline, rgb(128 128 128 / 0.55))' }} />

        {/* facemask */}
        <g fill="none" stroke="#9AA0A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M92 34 H101 M92 42 H101 M90 50 H99" />
          <path d="M101 34 V50 L88 60 L78 60" />
        </g>
      </svg>
    </span>
  );
}

const SHELL =
  'M14 48 C12 24 28 8 54 8 C76 8 92 20 94 38 L94 46 C94 49 92 51 89 51 L78 51 L76 58 C75 63 71 66 66 66 L42 66 C26 66 15 60 14 48 Z';

import type { CSSProperties } from 'react';
import { TEAM_COLORS } from '@/lib/teamColors';
import { cn } from '@/lib/utils';

// A pixel-art football helmet that wears a team's colors. Pass an NFL abbreviation
// ("KC"); with no team (or an unknown one) it shows in the neutral gray and purple.
//
// The artwork is the PIXELS grid below: one character per pixel.
//   #  shell (team's main color)     E  ear hole
//   M  facemask (a team color that stands out from the shell)   .  empty
// Edit the grid to redraw the helmet. Colors reach the drawing through CSS variables
// (--helmet-shell, --helmet-mask, --helmet-ear), so they fade smoothly when the team changes.
//
// Pixels stay sharp when the width is a multiple of 17 (34, 51, 68, ...).

const PIXELS = [
  '......###........',
  '....#######......',
  '..###########....',
  '.#############...',
  '.#############...',
  '###############..',
  '###############..',
  '###############..',
  '###############..',
  '#############....',
  '#####EE####MM....',
  '#####EE#####M....',
  '##########MMMMM..',
  '.########MM.M.MMM',
  '..#######MMMM.M.M',
  '...########.MMMMM',
];

const COLS = PIXELS[0].length;
const ROWS = PIXELS.length;

const NEUTRAL = { name: 'Football', shell: '#D9D9D9', mask: '#6524E6', ear: '#242A30' };

// Merge neighboring pixels of the same kind in a row into one rectangle.
const RECTS = PIXELS.flatMap((line, y) =>
  [...line.matchAll(/#+|E+|M+/g)].map((m) => ({ kind: m[0][0], x: m.index!, y, width: m[0].length })),
);

const FILL: Record<string, string> = { '#': 'var(--helmet-shell)', M: 'var(--helmet-mask)', E: 'var(--helmet-ear)' };

// Order for the "build" animation, one entry per pixel: bottom row first, working up
// and left to right, so the helmet is stacked from the bottom. Each pixel slides down
// into its spot from above (see helmet-drop in src/styles/global.css).
const BUILD_ORDER = PIXELS.flatMap((line, y) => [...line].map((kind, x) => ({ kind, x, y })))
  .filter((p) => p.kind !== '.')
  .sort((a, b) => b.y - a.y || a.x - b.x);

// Delay between one pixel starting to drop in and the next. The full build takes about
// BUILD_ORDER.length * BUILD_STEP_MS plus the drop itself (--helmet-drop-duration in
// src/styles/global.css).
const BUILD_STEP_MS = 10;

export type HelmetAnimation = 'none' | 'bob' | 'clash';

interface TeamHelmetProps {
  team?: string | null;
  /** Width in pixels (height follows). Multiples of 17 keep the pixels sharp. */
  size?: number;
  /** none: still. bob: gentle thinking motion. clash: lunges forward, for two helmets facing each other. */
  animation?: HelmetAnimation;
  /** Load the helmet in pixel by pixel, each pixel dropping into place from above, top to bottom.
   *  Plays once when the helmet first appears and then stays put. Can be combined with `animation`. */
  build?: boolean;
  /** Face left instead of right. */
  flip?: boolean;
  /** Accessible name. Leave out when the team name is shown in text next to it. */
  label?: string;
  className?: string;
}

export function TeamHelmet({ team, size = 51, animation = 'none', build = false, flip = false, label, className }: TeamHelmetProps) {
  const colors = (team && TEAM_COLORS[team]) || NEUTRAL;

  const style = {
    width: size,
    '--helmet-shell': colors.shell,
    '--helmet-mask': colors.mask,
    '--helmet-ear': colors.ear,
  } as CSSProperties;

  return (
    <span
      className={cn('helmet inline-block shrink-0', animation !== 'none' && `helmet-${animation}`, flip && 'helmet-flip', className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox={`0 0 ${COLS} ${ROWS}`}
        shapeRendering="crispEdges"
        className="block h-auto w-full overflow-visible"
        style={{
          transform: flip ? 'scaleX(-1)' : undefined,
          // a faint edge so very dark or very light helmets stay visible on any background
          filter: 'drop-shadow(0 0 0.5px var(--helmet-outline, rgb(128 128 128 / 0.8)))',
        }}
      >
        {build
          ? BUILD_ORDER.map((p, i) => (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={1}
                height={1}
                className="helmet-fill helmet-px"
                style={{ fill: FILL[p.kind], animationDelay: `${i * BUILD_STEP_MS}ms` }}
              />
            ))
          : RECTS.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.width} height={1} className="helmet-fill" style={{ fill: FILL[r.kind] }} />
            ))}
      </svg>
    </span>
  );
}

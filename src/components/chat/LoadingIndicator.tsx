import { TeamHelmet } from '@/components/TeamHelmet';
import { Skeleton } from '@/components/ui/skeleton';
import { TEAM_COLORS } from '@/lib/teamColors';

// "Nickname" of a team: Kansas City Chiefs -> Chiefs.
function nickname(abbr: string) {
  const name = TEAM_COLORS[abbr]?.name ?? abbr;
  return name.split(' ').pop() as string;
}

function describe(teams: string[], lookingUp: boolean) {
  if (teams.length === 1) return `Pulling ${nickname(teams[0])} data…`;
  if (teams.length === 2) return `Pulling ${nickname(teams[0])} vs ${nickname(teams[1])}…`;
  return lookingUp ? 'Looking that up…' : 'Thinking…';
}

// Shown while an answer is on its way. The helmet takes the colors of the team(s) being
// looked up as soon as they're known: one team bobs, two teams lunge at each other.
export function LoadingIndicator({ teams, lookingUp }: { teams: string[]; lookingUp: boolean }) {
  const label = describe(teams, lookingUp);
  const matchup = teams.length === 2;

  return (
    <div className="flex items-center gap-3 py-0.5" role="status">
      <div className="flex w-[5.5rem] shrink-0 items-center justify-center gap-1.5">
        {matchup ? (
          <>
            <TeamHelmet key="a" team={teams[0]} size={34} animation="clash" />
            <TeamHelmet key="b" team={teams[1]} size={34} animation="clash" flip />
          </>
        ) : (
          <TeamHelmet key="a" team={teams[0]} size={51} animation="bob" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Skeleton className="h-3 w-44 max-w-full" />
      </div>
    </div>
  );
}

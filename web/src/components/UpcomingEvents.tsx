import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { hijriLabel, upcomingEvents, type IslamicEvent } from '@/lib/hijri';
import { Card } from '@/ui';

export const KIND_STYLE: Record<IslamicEvent['kind'], string> = {
  eid: 'bg-gold text-[#2b1d00]',
  major: 'bg-accent text-accent-fg',
  minor: 'bg-accent-soft text-accent-strong',
};

/** The next few Islamic events with a countdown. Either links to the calendar or calls onPick. */
export function UpcomingEvents({ todayKey, limit = 5, onPick, className }: { todayKey: string; limit?: number; onPick?: (date: string) => void; className?: string }) {
  const items = upcomingEvents(todayKey, limit);
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-accent" /> Coming up
        </h3>
        {!onPick && (
          <Link to="/calendar" className="text-xs font-medium text-accent hover:underline">
            Full calendar
          </Link>
        )}
      </div>
      <ul className="space-y-1">
        {items.map((u) => {
          const inner = (
            <>
              <span className={cn('flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none', KIND_STYLE[u.event.kind])}>
                <span className="text-[10px] font-semibold uppercase">{new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${u.date}T12:00:00Z`))}</span>
                <span className="text-base font-bold">{Number(u.date.slice(8))}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.event.name}</span>
                <span className="block text-xs text-muted">
                  {u.daysAway === 0 ? 'Today' : u.daysAway === 1 ? 'Tomorrow' : `in ${u.daysAway} days`} · {hijriLabel(u.hijri, true)}
                </span>
              </span>
            </>
          );
          const cls = 'flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-surface-2';
          return (
            <li key={u.date + u.event.name}>
              {onPick ? (
                <button className={cls} onClick={() => onPick(u.date)}>
                  {inner}
                </button>
              ) : (
                <Link className={cls} to={`/calendar?date=${u.date}`}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Hijri dates and Islamic events, based on the Umm al-Qura calendar built into the browser (Intl). */

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi‘ al-awwal', 'Rabi‘ al-thani', 'Jumada al-awwal', 'Jumada al-thani',
  'Rajab', 'Sha‘ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi‘dah', 'Dhu al-Hijjah',
] as const;

export interface Hijri {
  year: number;
  month: number; // 1-12
  day: number;
}

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });

/**
 * Hijri date of a civil (Gregorian) day, given as "YYYY-MM-DD".
 * `adjust` shifts the Hijri date by whole days (−2…+2) to match local moon sighting.
 */
export function hijriOf(dateKey: string, adjust = 0): Hijri {
  const [y, m, d] = dateKey.split('-').map(Number);
  const parts = fmt.formatToParts(new Date(Date.UTC(y, m - 1, d + adjust, 12)));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year') || get('relatedYear'), month: get('month'), day: get('day') };
}

export type EventKind = 'eid' | 'major' | 'minor';
export interface IslamicEvent {
  name: string;
  kind: EventKind;
  about: string;
  /** shown in the "upcoming" list (multi-day events only list their first day) */
  primary: boolean;
}

interface Rule extends IslamicEvent {
  month: number;
  day: number;
}

const RULES: Rule[] = [
  { month: 1, day: 1, name: 'Islamic New Year', kind: 'major', primary: true, about: 'First day of Muharram, the start of the Hijri year.' },
  { month: 1, day: 10, name: 'Day of Ashura', kind: 'major', primary: true, about: '10 Muharram. Many Muslims fast on this day, often with the 9th or 11th.' },
  { month: 3, day: 12, name: 'Mawlid al-Nabi', kind: 'minor', primary: true, about: '12 Rabi‘ al-awwal, the birthday of the Prophet ﷺ. Observed by many communities, not all.' },
  { month: 7, day: 27, name: 'Isra and Mi‘raj', kind: 'minor', primary: true, about: 'Commemorates the Night Journey and Ascension, traditionally on 27 Rajab.' },
  { month: 8, day: 15, name: 'Mid-Sha‘ban', kind: 'minor', primary: true, about: 'Night of 15 Sha‘ban (Laylat al-Bara’ah), observed by many.' },
  { month: 9, day: 1, name: 'Ramadan begins', kind: 'major', primary: true, about: 'The month of fasting begins (subject to local moon sighting).' },
  { month: 9, day: 27, name: 'Laylat al-Qadr (27th night)', kind: 'major', primary: true, about: 'The Night of Power is sought in the last ten nights; many observe the 27th.' },
  { month: 10, day: 1, name: 'Eid al-Fitr', kind: 'eid', primary: true, about: 'Festival marking the end of Ramadan. Eid prayer after sunrise.' },
  { month: 10, day: 2, name: 'Eid al-Fitr (day 2)', kind: 'eid', primary: false, about: 'Second day of Eid al-Fitr.' },
  { month: 10, day: 3, name: 'Eid al-Fitr (day 3)', kind: 'eid', primary: false, about: 'Third day of Eid al-Fitr.' },
  { month: 12, day: 9, name: 'Day of Arafah', kind: 'major', primary: true, about: '9 Dhu al-Hijjah. Fasting is recommended for those not performing Hajj.' },
  { month: 12, day: 10, name: 'Eid al-Adha', kind: 'eid', primary: true, about: 'Festival of Sacrifice, 10 Dhu al-Hijjah. Eid prayer after sunrise.' },
  { month: 12, day: 11, name: 'Days of Tashreeq', kind: 'minor', primary: false, about: '11–13 Dhu al-Hijjah, days of remembrance after Eid al-Adha.' },
  { month: 12, day: 12, name: 'Days of Tashreeq', kind: 'minor', primary: false, about: '11–13 Dhu al-Hijjah, days of remembrance after Eid al-Adha.' },
  { month: 12, day: 13, name: 'Days of Tashreeq', kind: 'minor', primary: false, about: '11–13 Dhu al-Hijjah, days of remembrance after Eid al-Adha.' },
];

export function eventsFor(h: Hijri): IslamicEvent[] {
  return RULES.filter((r) => r.month === h.month && r.day === h.day);
}

export const isRamadan = (h: Hijri) => h.month === 9;

export function hijriLabel(h: Hijri, short = false): string {
  const m = HIJRI_MONTHS[h.month - 1];
  return short ? `${h.day} ${m.split(' ')[0].slice(0, 3)}` : `${h.day} ${m} ${h.year} AH`;
}

export const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** The next primary events after (and including) `fromKey`. */
export function upcomingEvents(fromKey: string, count = 5, adjust = 0): Array<{ date: string; daysAway: number; event: IslamicEvent; hijri: Hijri }> {
  const out: Array<{ date: string; daysAway: number; event: IslamicEvent; hijri: Hijri }> = [];
  for (let i = 0; i < 420 && out.length < count; i++) {
    const date = addDaysKey(fromKey, i);
    const h = hijriOf(date, adjust);
    for (const event of eventsFor(h)) if (event.primary) out.push({ date, daysAway: i, event, hijri: h });
  }
  return out;
}

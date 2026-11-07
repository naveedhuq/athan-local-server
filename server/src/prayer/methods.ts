import { CalculationMethod, CalculationParameters, HighLatitudeRule, Madhab } from 'adhan';

export interface MethodInfo {
  key: string;
  label: string;
  region: string;
  /** Aladhan API method id */
  aladhan: number;
  /** Offline calculation (adhan-js) */
  offline: () => CalculationParameters;
  /** true when the offline result is only an approximation of the authority's method */
  approximate?: boolean;
}

const custom = (fajr: number, isha: number, ishaInterval = 0) => () => {
  const p = CalculationMethod.Other();
  p.fajrAngle = fajr;
  p.ishaAngle = isha;
  p.ishaInterval = ishaInterval;
  return p;
};

export const METHODS: MethodInfo[] = [
  { key: 'mwl', label: 'Muslim World League', region: 'Europe, Far East, parts of America', aladhan: 3, offline: () => CalculationMethod.MuslimWorldLeague() },
  { key: 'isna', label: 'ISNA – Islamic Society of North America', region: 'North America', aladhan: 2, offline: () => CalculationMethod.NorthAmerica() },
  { key: 'egypt', label: 'Egyptian General Authority of Survey', region: 'Africa, Syria, Lebanon, Malaysia', aladhan: 5, offline: () => CalculationMethod.Egyptian() },
  { key: 'makkah', label: 'Umm al-Qura University, Makkah', region: 'Arabian Peninsula', aladhan: 4, offline: () => CalculationMethod.UmmAlQura() },
  { key: 'karachi', label: 'Univ. of Islamic Sciences, Karachi', region: 'Pakistan, India, Bangladesh, Afghanistan', aladhan: 1, offline: () => CalculationMethod.Karachi() },
  { key: 'tehran', label: 'Institute of Geophysics, Tehran', region: 'Iran, parts of Asia', aladhan: 7, offline: () => CalculationMethod.Tehran() },
  { key: 'jafari', label: 'Shia Ithna-Ashari (Jafari)', region: 'Shia communities', aladhan: 0, offline: () => CalculationMethod.Tehran(), approximate: true },
  { key: 'gulf', label: 'Gulf Region', region: 'Gulf states', aladhan: 8, offline: custom(19.5, 0, 90), approximate: true },
  { key: 'kuwait', label: 'Kuwait', region: 'Kuwait', aladhan: 9, offline: () => CalculationMethod.Kuwait() },
  { key: 'qatar', label: 'Qatar', region: 'Qatar', aladhan: 10, offline: () => CalculationMethod.Qatar() },
  { key: 'singapore', label: 'MUIS – Singapore', region: 'Singapore, Malaysia, Indonesia', aladhan: 11, offline: () => CalculationMethod.Singapore() },
  { key: 'jakim', label: 'JAKIM – Malaysia', region: 'Malaysia', aladhan: 17, offline: custom(20, 18), approximate: true },
  { key: 'france', label: 'UOIF – France', region: 'France', aladhan: 12, offline: custom(12, 12), approximate: true },
  { key: 'turkey', label: 'Diyanet – Turkey', region: 'Turkey', aladhan: 13, offline: () => CalculationMethod.Turkey() },
  { key: 'dubai', label: 'Dubai', region: 'UAE', aladhan: 16, offline: () => CalculationMethod.Dubai() },
  { key: 'moonsighting', label: 'Moonsighting Committee', region: 'North America, UK', aladhan: 15, offline: () => CalculationMethod.MoonsightingCommittee() },
];

export function getMethod(key: string): MethodInfo {
  return METHODS.find((m) => m.key === key) ?? METHODS[0];
}

export function offlineParams(methodKey: string, madhab: 'shafi' | 'hanafi', rule: string, latitude: number): CalculationParameters {
  const p = getMethod(methodKey).offline();
  p.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (rule === 'auto') {
    // Adhan's own recommendation above ~48° latitude
    p.highLatitudeRule = HighLatitudeRule.recommended({ latitude, longitude: 0 } as any);
  } else {
    p.highLatitudeRule =
      rule === 'middleOfTheNight' ? HighLatitudeRule.MiddleOfTheNight : rule === 'seventhOfTheNight' ? HighLatitudeRule.SeventhOfTheNight : HighLatitudeRule.TwilightAngle;
  }
  return p;
}

/** Aladhan latitudeAdjustmentMethod: 1 middle of night, 2 one seventh, 3 angle based */
export function aladhanHighLatitude(rule: string): number | undefined {
  return rule === 'middleOfTheNight' ? 1 : rule === 'seventhOfTheNight' ? 2 : rule === 'twilightAngle' ? 3 : undefined;
}

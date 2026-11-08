/**
 * Curated athan downloads. Files are fetched by the server on demand (nothing is bundled).
 * Source: https://github.com/abodehq/Athan-MP3 (no license file is published there; for personal use).
 */
const BASE = 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/';

export interface CatalogEntry {
  id: string;
  name: string;
  muezzin: string;
  note?: string;
  url: string;
}

const entry = (id: string, file: string, name: string, muezzin: string, note?: string): CatalogEntry => ({
  id,
  name,
  muezzin,
  note,
  url: BASE + encodeURIComponent(file),
});

export const CATALOG: CatalogEntry[] = [
  entry('makkah', 'Athan Makkah.mp3', 'Makkah', 'Masjid al-Haram', 'Short and familiar'),
  entry('alafasi', 'Athan Mishary Alafasi.mp3', 'Mishary Alafasy', 'Mishary Alafasy'),
  entry('az-zahrani', 'Athan Mansoor Az-Zahrani.mp3', 'Mansoor Az-Zahrani', 'Mansoor Az-Zahrani'),
  entry('alqatami', 'Athan Nasser Alqatami.mp3', 'Nasser Alqatami', 'Nasser Alqatami'),
  entry('albase6', 'Athan Abed Albase6.mp3', 'Abed Albase6', 'Abed Albase6'),
  entry('ref3at', 'Athan Mohammad Ref3at.mp3', 'Mohammad Ref3at', 'Mohammad Ref3at'),
  entry('almenshawy', 'Athan Mohammad Almenshawy.mp3', 'Mohammad Almenshawy', 'Mohammad Almenshawy'),
  entry('almalki', 'Athan Hamdan Almalki.mp3', 'Hamdan Almalki', 'Hamdan Almalki'),
  entry('al-arkani', 'Athan Ibrahim Al-Arkani.mp3', 'Ibrahim Al-Arkani', 'Ibrahim Al-Arkani'),
  entry('al-hamathani', 'Athan Majed Al-hamathani.mp3', 'Majed Al-Hamathani', 'Majed Al-Hamathani'),
  entry('deghreri', 'Athan Hamad Deghreri.mp3', 'Hamad Deghreri', 'Hamad Deghreri'),
  entry('khatba', 'Athan Suhaib Khatba.mp3', 'Suhaib Khatba', 'Suhaib Khatba'),
  entry('nuyne3', 'Athan Ahmad Nuyne3.mp3', 'Ahmad Nuyne3', 'Ahmad Nuyne3'),
  entry('fajr-chebae', 'Athan Al-fajer - Malek chebae.mp3', 'Fajr athan', 'Malek Chebae', 'For Fajr: includes “as-salatu khayrun min an-nawm”'),
];

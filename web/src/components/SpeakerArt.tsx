import type { SpeakerType } from '@server/api-types';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Original vector illustrations of common speaker/TV shapes, picked from the
 * model and name that discovery reports. Not manufacturer artwork.
 */
import type { ArtKind } from '@server/schema';
export type { ArtKind };

/** Brand shown on the card badge, guessed from the name/model. */
const BRANDS: Array<[RegExp, string]> = [
  [/sonos|symfonisk/, 'Sonos'], [/homepod|appletv|apple tv|audioaccessory/, 'Apple'], [/nest|google|chromecast/, 'Google'],
  [/bose/, 'Bose'], [/\bjbl\b/, 'JBL'], [/marshall/, 'Marshall'], [/heos/, 'HEOS'], [/denon/, 'Denon'], [/marantz/, 'Marantz'],
  [/yamaha|musiccast/, 'Yamaha'], [/bang|olufsen|beosound|beoplay|\bb&o\b/, 'Bang & Olufsen'], [/\bkef\b|\blsx\b|\bls50\b/, 'KEF'],
  [/klipsch/, 'Klipsch'], [/polk/, 'Polk'], [/bluesound|powernode|\bnode\b/, 'Bluesound'], [/samsung/, 'Samsung'], [/\blg\b|webos/, 'LG'],
  [/sony|bravia/, 'Sony'], [/vizio/, 'Vizio'], [/roku/, 'Roku'], [/\btcl\b/, 'TCL'], [/philips/, 'Philips'], [/harman|citation|onyx/, 'Harman Kardon'],
  [/libratone/, 'Libratone'], [/naim|mu-so/, 'Naim'], [/cambridge/, 'Cambridge Audio'], [/onkyo/, 'Onkyo'], [/pioneer/, 'Pioneer'],
  [/hisense/, 'Hisense'], [/panasonic/, 'Panasonic'], [/ultimate ears|\bue\b|megaboom|wonderboom/, 'Ultimate Ears'], [/bowers|wilkins|zeppelin/, 'Bowers & Wilkins'],
  [/dali\b/, 'DALI'], [/elac/, 'ELAC'], [/arcam/, 'Arcam'], [/nad\b/, 'NAD'], [/technics/, 'Technics'], [/teufel/, 'Teufel'], [/devialet|phantom/, 'Devialet'],
];

export function brandOf(name: string, model: string | null): string | null {
  const s = `${name} ${model ?? ''}`.toLowerCase();
  return BRANDS.find(([re]) => re.test(s))?.[1] ?? null;
}

export function pickKind(type: SpeakerType, name: string, model: string | null): ArtKind {
  const s = `${name} ${model ?? ''}`.toLowerCase();
  if (type === 'local') return 'pi';
  // Specific product families first
  if (/soundbar|sound bar|\bbeam\b|\barc\b|\bray\b|playbar|playbase|\bhw-|\bhtb|\bbar\b|mu-so(?! qb)|zeppelin|smart soundbar/.test(s)) return 'soundbar';
  if (/\bsub\b|subwoofer/.test(s)) return 'sub';
  if (/group/.test(s)) return 'group';
  if (/lamp|symfonisk/.test(s)) return 'lamp';
  if (/appletv|apple tv/.test(s)) return 'apple-tv';
  if (/homepod mini|audioaccessory5|audioaccessory4/.test(s)) return 'homepod-mini';
  if (/homepod|audioaccessory/.test(s)) return 'homepod';
  if (/chromecast|google tv streamer|cast dongle|roku (stick|express|ultra)/.test(s)) return /\btv\b|television/.test(name.toLowerCase()) ? 'tv' : 'chromecast';
  if (/marshall|stanmore|acton|woburn|uxbridge|emberton/.test(s)) return 'amp';
  if (/beosound|beoplay|bang|olufsen|\bb&o\b|\ba1\b|\ba9\b|devialet|phantom/.test(s)) return 'disc';
  if (/soundlink|charge|flip|xtreme|boombox|clip|onyx|megaboom|wonderboom|go \d|portable|emberton/.test(s)) return 'portable';
  if (/avr|receiver|\brx-|denon|marantz|yamaha|onkyo|pioneer|integra|musiccast|powernode|\bnode\b|vault|arcam|\bnad\b|amplifier|streamer/.test(s)) return 'receiver';
  if (/\blsx\b|\bls50\b|\bkef\b|klipsch|polk|cambridge|dali\b|elac|bowers|bookshelf|teufel|\bmu-so qb|\bwiim\b/.test(s)) return 'bookshelf';
  if (/tower|floor|\blink\b|jbl link|citation 500|heos 7|heos 5|heos 3|heos 1/.test(s)) return /heos [135]/.test(s) ? 'sonos-one' : 'tower';
  if (/nest hub|home hub|smart display|\bshow\b/.test(s)) return 'nest-hub';
  if (/\btv\b|bravia|webos|roku|vizio|display|television|samsung|\blg\b|android tv|tcl|hisense|philips|panasonic|sony/.test(s)) return 'tv';
  if (/hub/.test(s)) return 'nest-hub';
  if (type === 'sonos') {
    if (/roam/.test(s)) return 'sonos-roam';
    if (/move|play:5|five|play:3/.test(s)) return 'sonos-move';
    if (/era 300|era/.test(s)) return 'sonos-era';
    return 'sonos-one';
  }
  if (type === 'cast') {
    if (/mini|home mini|nest mini|puck/.test(s)) return 'nest-mini';
    if (/nest audio|google home/.test(s)) return 'google-home';
    return brandOf(name, model) && brandOf(name, model) !== 'Google' ? 'sonos-era' : 'google-home';
  }
  if (type === 'airplay') return brandOf(name, model) && brandOf(name, model) !== 'Apple' ? 'sonos-era' : 'homepod-mini';
  return 'sonos-one';
}

export const ART_LABEL: Record<ArtKind, string> = {
  'sonos-one': 'Compact speaker', 'sonos-era': 'Wide speaker', 'sonos-roam': 'Pocket speaker', 'sonos-move': 'Carry speaker',
  soundbar: 'Soundbar', sub: 'Subwoofer', lamp: 'Lamp speaker', 'nest-mini': 'Smart puck', 'google-home': 'Smart cylinder',
  'nest-hub': 'Smart display', tv: 'TV', group: 'Speaker group', homepod: 'Tall mesh speaker', 'homepod-mini': 'Round mesh speaker',
  'apple-tv': 'Streaming box', pi: 'Raspberry Pi', tower: 'Tower speaker', bookshelf: 'Bookshelf speaker', portable: 'Portable speaker',
  receiver: 'Receiver / streamer', chromecast: 'Streaming stick', amp: 'Amp-style speaker', disc: 'Disc speaker',
};

interface Tone {
  top: string;
  bot: string;
  grille: string;
  rim: string;
}
const DARK: Tone = { top: '#56666c', bot: '#182226', grille: '#050b0d', rim: 'rgba(255,255,255,.14)' };
const LIGHT: Tone = { top: '#ffffff', bot: '#cfd8d9', grille: '#7e8d90', rim: 'rgba(0,0,0,.12)' };

const LIGHT_KINDS: ArtKind[] = ['nest-mini', 'google-home', 'homepod-mini', 'apple-tv'];

export function SpeakerArt({ kind, size = 120, className, active, dim }: { kind: ArtKind; size?: number; className?: string; active?: boolean; dim?: boolean }) {
  const id = useId().replace(/:/g, '');
  const t = LIGHT_KINDS.includes(kind) ? LIGHT : DARK;
  const body = `url(#${id}b)`;
  const shine = `url(#${id}s)`;
  const dots = `url(#${id}d)`;

  /** Rounded body with highlight, optional speaker-grille dots. */
  const Shell = ({ x, y, w, h, rx, grille = true, inset = 0 }: { x: number; y: number; w: number; h: number; rx: number; grille?: boolean; inset?: number }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={body} stroke={t.rim} strokeWidth="1" />
      {grille && <rect x={x + inset} y={y + inset} width={w - inset * 2} height={h - inset * 2} rx={Math.max(rx - inset, 2)} fill={dots} opacity=".55" />}
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={shine} />
    </g>
  );
  const Glow = ({ cx, cy, rx, ry = 2, color = '#2dd4bf' }: { cx: number; cy: number; rx: number; ry?: number; color?: string }) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} opacity={active ? 1 : 0.85}>
      {active && <animate attributeName="opacity" values="1;.4;1" dur="1.2s" repeatCount="indefinite" />}
    </ellipse>
  );

  let art: ReactNode;
  switch (kind) {
    case 'sonos-one':
      art = (<><Shell x={36} y={14} w={48} h={88} rx={14} inset={5} /><rect x={50} y={22} width={20} height={3} rx={1.5} fill="#fff" opacity=".5" /></>);
      break;
    case 'sonos-era':
      art = (<><Shell x={18} y={30} w={84} h={68} rx={26} inset={6} /><rect x={50} y={38} width={20} height={3} rx={1.5} fill="#fff" opacity=".5" /></>);
      break;
    case 'sonos-roam':
      art = (<><Shell x={38} y={22} w={44} h={80} rx={22} inset={5} /><rect x={52} y={14} width={16} height={9} rx={4.5} fill={t.bot} stroke={t.rim} /></>);
      break;
    case 'sonos-move':
      art = (<><path d="M44 22c0-14 32-14 32 0" fill="none" stroke={t.bot} strokeWidth="5" strokeLinecap="round" /><Shell x={28} y={20} w={64} h={82} rx={16} inset={6} /></>);
      break;
    case 'soundbar':
      art = (<><Shell x={6} y={46} w={108} h={28} rx={13} inset={4} /><rect x={50} y={52} width={20} height={2.5} rx={1.25} fill="#fff" opacity=".5" /></>);
      break;
    case 'sub':
      art = (<><Shell x={24} y={22} w={72} h={80} rx={14} grille={false} /><rect x={46} y={36} width={28} height={52} rx={14} fill={t.grille} opacity=".85" /><rect x={46} y={36} width={28} height={52} rx={14} fill="none" stroke={t.rim} /></>);
      break;
    case 'lamp':
      art = (<><path d="M38 20h44l10 46H28z" fill={body} stroke={t.rim} /><path d="M38 20h44l10 46H28z" fill="#ffe9a8" opacity=".35" /><rect x={57} y={66} width={6} height={22} fill={t.bot} /><Shell x={34} y={86} w={52} h={16} rx={8} inset={3} /></>);
      break;
    case 'nest-mini':
      art = (<><ellipse cx={60} cy={92} rx={46} ry={14} fill={t.bot} /><path d="M14 74v18c0 8 20.6 14 46 14s46-6 46-14V74z" fill={body} stroke={t.rim} /><ellipse cx={60} cy={74} rx={46} ry={16} fill={body} stroke={t.rim} /><ellipse cx={60} cy={74} rx={46} ry={16} fill={dots} opacity=".45" />{[[48, '#4285f4'], [56, '#ea4335'], [64, '#fbbc05'], [72, '#34a853']].map(([x, c]) => (<circle key={String(x)} cx={Number(x)} cy={76} r="2.2" fill={String(c)} />))}</>);
      break;
    case 'google-home':
      art = (<><path d="M34 40h52l-4 56c0 6-10 9-22 9s-22-3-22-9z" fill={body} stroke={t.rim} /><path d="M34 40h52l-4 56c0 6-10 9-22 9s-22-3-22-9z" fill={dots} opacity=".4" /><ellipse cx={60} cy={40} rx={26} ry={9} fill="#e9eef0" stroke={t.rim} transform="rotate(-6 60 40)" />{[[50, '#4285f4'], [57, '#ea4335'], [64, '#fbbc05'], [71, '#34a853']].map(([x, c]) => (<circle key={String(x)} cx={Number(x)} cy={39} r="2" fill={String(c)} />))}</>);
      break;
    case 'nest-hub':
      art = (<><rect x={30} y={78} width={60} height={22} rx={10} fill="#d9dfe0" stroke={t.rim} /><rect x={30} y={78} width={60} height={22} rx={10} fill={dots} opacity=".5" /><rect x={14} y={24} width={92} height={58} rx={9} fill="#0d1517" stroke={t.rim} /><rect x={19} y={29} width={82} height={48} rx={5} fill="#14343a" /><text x="60" y="60" textAnchor="middle" fontSize="20" fontWeight="600" fill="#9ff3e6" fontFamily="ui-sans-serif,system-ui">5:42</text></>);
      break;
    case 'tv':
      art = (<><rect x={8} y={24} width={104} height={62} rx={5} fill="#0b1214" stroke={t.rim} /><rect x={11} y={27} width={98} height={56} rx={3} fill="#1a3a42" /><path d="M11 27h60L40 83H11z" fill="#fff" opacity=".07" /><rect x={50} y={86} width={20} height={9} fill={t.bot} /><rect x={36} y={94} width={48} height={5} rx={2.5} fill={t.bot} stroke={t.rim} /></>);
      break;
    case 'apple-tv':
      art = (<><path d="M24 66l10-8h52l10 8v18a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8z" fill={body} stroke={t.rim} /><path d="M24 66l10-8h52l10 8z" fill="#fff" opacity=".6" /><circle cx={60} cy={82} r="1.8" fill="#2dd4bf" /></>);
      break;
    case 'homepod':
      art = (<><Shell x={32} y={14} w={56} h={90} rx={24} inset={6} /><ellipse cx={60} cy={26} rx={16} ry={5} fill={`url(#${id}h)`} opacity={active ? 1 : 0.9} /></>);
      break;
    case 'homepod-mini':
      art = (<><Shell x={28} y={30} w={64} h={72} rx={32} inset={6} /><ellipse cx={60} cy={42} rx={15} ry={5} fill={`url(#${id}h)`} opacity={active ? 1 : 0.9} /></>);
      break;
    case 'tower':
      art = (<><Shell x={38} y={8} w={44} h={98} rx={12} grille={false} /><circle cx={60} cy={30} r={6} fill={t.grille} stroke={t.rim} /><circle cx={60} cy={72} r={17} fill={t.grille} stroke={t.rim} strokeWidth="2" /><circle cx={60} cy={72} r={7} fill={t.bot} opacity=".7" /></>);
      break;
    case 'bookshelf':
      art = (<><Shell x={28} y={16} w={64} h={88} rx={8} grille={false} /><circle cx={60} cy={38} r={8} fill={t.grille} stroke={t.rim} strokeWidth="1.5" /><circle cx={60} cy={76} r={20} fill={t.grille} stroke={t.rim} strokeWidth="2" /><circle cx={60} cy={76} r={8} fill={t.bot} opacity=".7" /></>);
      break;
    case 'portable':
      art = (<><rect x={12} y={46} width={96} height={46} rx={23} fill={body} stroke={t.rim} /><rect x={22} y={46} width={76} height={46} fill={dots} opacity=".5" /><rect x={12} y={46} width={96} height={46} rx={23} fill={shine} /><circle cx={22} cy={69} r={9} fill={t.grille} opacity=".8" /><circle cx={98} cy={69} r={9} fill={t.grille} opacity=".8" /><path d="M96 52c8-14 14-14 14-4" fill="none" stroke={t.bot} strokeWidth="3" strokeLinecap="round" /></>);
      break;
    case 'receiver':
      art = (<><rect x={6} y={48} width={108} height={42} rx={4} fill={body} stroke={t.rim} /><rect x={6} y={48} width={108} height={42} rx={4} fill={shine} /><rect x={36} y={55} width={48} height={14} rx={2} fill="#0b1b1f" /><text x="60" y="66" textAnchor="middle" fontSize="9" fontWeight="600" fill="#7ef0dd" fontFamily="ui-monospace,monospace">STREAM</text><circle cx={20} cy={69} r={8} fill={t.bot} stroke={t.rim} /><circle cx={100} cy={69} r={8} fill={t.bot} stroke={t.rim} />{[40, 50, 60, 70, 80].map((x) => (<rect key={x} x={x - 3} y={76} width={6} height={5} rx={1} fill={t.grille} opacity=".8" />))}</>);
      break;
    case 'chromecast':
      art = (<><path d="M86 38c14-14 22 0 24 18" fill="none" stroke={t.bot} strokeWidth="5" strokeLinecap="round" /><circle cx={58} cy={64} r={36} fill={body} stroke={t.rim} /><circle cx={58} cy={64} r={36} fill={shine} /><circle cx={58} cy={64} r={13} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" /><circle cx={58} cy={64} r={4} fill="#fff" fillOpacity=".5" /></>);
      break;
    case 'amp':
      art = (<><rect x={12} y={22} width={96} height={76} rx={5} fill="#171717" stroke="#000" /><rect x={12} y={22} width={96} height={76} rx={5} fill={shine} /><rect x={17} y={27} width={86} height={66} rx={3} fill="none" stroke="#d9a441" strokeWidth="1.5" /><rect x={20} y={50} width={80} height={40} rx={2} fill="#c9b690" opacity=".9" /><rect x={20} y={50} width={80} height={40} rx={2} fill={dots} opacity=".55" /><rect x={40} y={32} width={40} height={9} rx={2} fill="#d9a441" opacity=".9" />{[30, 44, 58, 72, 86].map((x) => (<circle key={x} cx={x} cy={46} r={2} fill="#d9a441" />))}</>);
      break;
    case 'disc':
      art = (<><ellipse cx={60} cy={92} rx={46} ry={13} fill={t.bot} /><path d="M14 76v16c0 7 20.6 13 46 13s46-6 46-13V76z" fill={body} stroke={t.rim} /><ellipse cx={60} cy={76} rx={46} ry={20} fill={body} stroke={t.rim} /><ellipse cx={60} cy={76} rx={36} ry={14} fill={dots} opacity=".5" /><ellipse cx={60} cy={76} rx={46} ry={20} fill={shine} /></>);
      break;
    case 'group':
      art = (<>
        <g transform="translate(-20 14) scale(.7)"><Shell x={36} y={14} w={48} h={88} rx={14} inset={5} /></g>
        <g transform="translate(56 14) scale(.7)"><Shell x={36} y={14} w={48} h={88} rx={14} inset={5} /></g>
        <g transform="translate(18 -2) scale(.82)"><Shell x={36} y={14} w={48} h={88} rx={14} inset={5} /></g>
      </>);
      break;
    case 'pi':
      art = (<>
        <rect x={14} y={34} width={92} height={58} rx={6} fill="#1f7a4d" stroke="#0f4a2d" />
        <rect x={14} y={34} width={92} height={58} rx={6} fill={shine} />
        <rect x={20} y={38} width={80} height={6} rx={1} fill="#d9a441" opacity=".9" />
        {Array.from({ length: 20 }).map((_, i) => (<rect key={i} x={21 + i * 4} y={39} width="2" height="4" fill="#0f4a2d" />))}
        <rect x={40} y={52} width={22} height={22} rx={3} fill="#2b2f33" /><rect x={68} y={56} width={14} height={14} rx={2} fill="#383d42" />
        <rect x={96} y={50} width={14} height={16} rx={2} fill="#c9d1d3" /><rect x={96} y={70} width={14} height={16} rx={2} fill="#c9d1d3" />
        <circle cx={26} cy={84} r="2" fill="#4ade80" />
      </>);
      break;
  }

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={cn('shrink-0 transition', dim && 'opacity-50 grayscale', className)} role="img" aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.top} />
          <stop offset="1" stopColor={t.bot} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5f9e" />
          <stop offset=".5" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#35c8ff" />
        </linearGradient>
        <pattern id={`${id}d`} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
          <circle cx="2.25" cy="2.25" r=".85" fill={t.grille} />
        </pattern>
      </defs>
      <ellipse cx="60" cy="108" rx={kind === 'soundbar' || kind === 'tv' ? 50 : 34} ry="4" fill="#000" opacity=".22" />
      {art}
    </svg>
  );
}

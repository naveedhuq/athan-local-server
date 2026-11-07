import type { Location } from '@server/api-types';
import type { Config } from '@server/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Calculator, CalendarDays, Cpu, MapPin, Moon, Palette, Plug, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { LocationPicker } from '@/components/LocationPicker';
import { api, useConfig, useMethods, useSaveConfig, useSync, useSystem } from '@/lib/api';
import { LABEL, TIME_LIST } from '@/lib/format';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Chip, Field, Input, Notice, PageHeader, Row, Segmented, Select, Skeleton, Switch } from '@/ui';

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function Settings() {
  const { data: cfg } = useConfig();
  if (!cfg) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid max-w-3xl gap-5">
        <LocationSection cfg={cfg} />
        <CalculationSection cfg={cfg} />
        <CalendarSection cfg={cfg} />
        <SyncSection cfg={cfg} />
        <QuietSection cfg={cfg} />
        <IntegrationsSection cfg={cfg} />
        <AppearanceSection />
        <SystemSection cfg={cfg} />
      </div>
    </div>
  );
}

function LocationSection({ cfg }: { cfg: Config }) {
  const save = useSaveConfig();
  const toast = useToast();
  const [change, setChange] = useState(!cfg.location);
  const set = (location: Location) =>
    save.mutate({ location }, { onSuccess: () => { toast.success(`Location set to ${location.name}`); setChange(false); } });
  return (
    <Section icon={<MapPin className="size-5" />} title="Location" hint="Prayer times depend on where you are.">
      {cfg.location && !change ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">{cfg.location.name}</div>
            <div className="text-sm text-muted tabular">
              {cfg.location.latitude.toFixed(4)}°, {cfg.location.longitude.toFixed(4)}° · {cfg.location.timezone}
            </div>
          </div>
          <Button variant="outline" onClick={() => setChange(true)}>Change</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <LocationPicker onPick={set} busy={save.isPending} />
          {cfg.location && <Button variant="ghost" size="sm" onClick={() => setChange(false)}>Cancel</Button>}
        </div>
      )}
    </Section>
  );
}

function CalculationSection({ cfg }: { cfg: Config }) {
  const { data: methods = [] } = useMethods();
  const save = useSaveConfig();
  const c = cfg.calculation;
  const online = c.sources.includes('aladhan');
  const offline = c.sources.includes('offline');
  const method = methods.find((m) => m.key === c.method);
  const setSources = (on: boolean, off: boolean) => {
    const sources = [on && 'aladhan', off && 'offline'].filter(Boolean) as Array<'aladhan' | 'offline'>;
    if (sources.length) save.mutate({ calculation: { sources } });
  };
  const setFixed = (name: string, v: string) => save.mutate({ calculation: { fixedTimes: { [name]: v || null } } });
  return (
    <Section icon={<Calculator className="size-5" />} title="Prayer time calculation" hint="Choose the method your local mosque or community follows.">
      <div className="space-y-5">
        <Field label="Calculation method" hint={method ? `${method.region}${method.approximate ? ' · offline mode uses a close approximation' : ''}` : undefined}>
          <Select value={c.method} onChange={(e) => save.mutate({ calculation: { method: e.target.value } })}>
            {methods.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Asr calculation (madhab)">
          <Segmented
            value={c.madhab}
            onChange={(v) => save.mutate({ calculation: { madhab: v } })}
            options={[{ value: 'shafi', label: 'Standard (Shafi’i, Maliki, Hanbali)' }, { value: 'hanafi', label: 'Hanafi' }]}
            className="flex-wrap"
          />
        </Field>

        <Field label="High-latitude rule" hint="Only matters for far-north/south locations where twilight lasts all night in summer.">
          <Select value={c.highLatitudeRule} onChange={(e) => save.mutate({ calculation: { highLatitudeRule: e.target.value as Config['calculation']['highLatitudeRule'] } })}>
            <option value="auto">Automatic (recommended)</option>
            <option value="middleOfTheNight">Middle of the night</option>
            <option value="seventhOfTheNight">One-seventh of the night</option>
            <option value="twilightAngle">Twilight angle</option>
          </Select>
        </Field>

        <div className="divide-y divide-line rounded-2xl border border-line px-4">
          <Row title="Online times (Aladhan)" hint="Fetched from api.aladhan.com and cached. Recommended.">
            <Switch checked={online} onChange={(v) => setSources(v, offline || !v)} label="Use Aladhan" />
          </Row>
          <Row title="Offline calculation" hint="Built-in astronomical calculation. Used when online is off or unreachable.">
            <Switch checked={offline} onChange={(v) => setSources(online || !v, v)} label="Use offline calculation" />
          </Row>
        </div>

        <details className="group rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Fixed times (use your mosque’s timetable)
            <span className="text-xs text-muted group-open:hidden">Optional</span>
          </summary>
          <div className="space-y-3 border-t border-line p-4">
            <p className="text-sm text-muted">Overrides the calculated time for that prayer. Leave empty to use the calculation.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TIME_LIST.map((n) => (
                <Field key={n} label={LABEL[n]}>
                  <div className="flex gap-1.5">
                    <Input type="time" value={c.fixedTimes[n] ?? ''} onChange={(e) => setFixed(n, e.target.value)} />
                  </div>
                </Field>
              ))}
            </div>
          </div>
        </details>
      </div>
    </Section>
  );
}

function QuietSection({ cfg }: { cfg: Config }) {
  const save = useSaveConfig();
  const q = cfg.quietHours;
  return (
    <Section icon={<Moon className="size-5" />} title="Quiet hours" hint="Keep the house quiet overnight. Each prayer can opt in or out on the Prayers page.">
      <Row title="Enable quiet hours" hint="Athans that fall inside this window are skipped.">
        <Switch checked={q.enabled} onChange={(v) => save.mutate({ quietHours: { enabled: v } })} label="Enable quiet hours" />
      </Row>
      {q.enabled && (
        <div className="animate-fade mt-2 grid grid-cols-2 gap-3">
          <Field label="From"><Input type="time" value={q.start} onChange={(e) => e.target.value && save.mutate({ quietHours: { start: e.target.value } })} /></Field>
          <Field label="Until"><Input type="time" value={q.end} onChange={(e) => e.target.value && save.mutate({ quietHours: { end: e.target.value } })} /></Field>
          <p className="col-span-2 text-xs text-muted">Fajr usually falls inside an overnight window – switch “Respect quiet hours” off for Fajr if you still want it to play.</p>
        </div>
      )}
    </Section>
  );
}

function IntegrationsSection({ cfg }: { cfg: Config }) {
  const save = useSaveConfig();
  const toast = useToast();
  const m = cfg.integrations.mqtt;
  const w = cfg.integrations.webhook;
  const [mqtt, setMqtt] = useState(m);
  const [hook, setHook] = useState(w);
  useEffect(() => {
    setMqtt(m);
  }, [m]);
  useEffect(() => {
    setHook(w);
  }, [w]);

  const test = useMutation({
    mutationFn: () => api('/integrations/webhook/test', { method: 'POST' }),
    onSuccess: () => toast.success('Test notification sent'),
    onError: (e) => toast.error((e as Error).message),
  });
  const events = ['started', 'finished', 'skipped', 'error'] as const;

  return (
    <Section icon={<Plug className="size-5" />} title="Integrations" hint="Connect Home Assistant, ntfy and other tools.">
      <div className="space-y-6">
        <div>
          <Row title="MQTT / Home Assistant" hint="Publishes next prayer, playing state and events. Home Assistant finds it automatically.">
            <Switch checked={mqtt.enabled} onChange={(v) => { setMqtt({ ...mqtt, enabled: v }); save.mutate({ integrations: { mqtt: { ...mqtt, enabled: v } } }); }} label="Enable MQTT" />
          </Row>
          {mqtt.enabled && (
            <div className="animate-fade mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Broker URL" className="sm:col-span-2"><Input value={mqtt.url} onChange={(e) => setMqtt({ ...mqtt, url: e.target.value })} placeholder="mqtt://homeassistant.local:1883" /></Field>
              <Field label="Username"><Input value={mqtt.username} onChange={(e) => setMqtt({ ...mqtt, username: e.target.value })} autoComplete="off" /></Field>
              <Field label="Password"><Input type="password" value={mqtt.password} onChange={(e) => setMqtt({ ...mqtt, password: e.target.value })} autoComplete="new-password" /></Field>
              <Field label="Topic prefix"><Input value={mqtt.topicPrefix} onChange={(e) => setMqtt({ ...mqtt, topicPrefix: e.target.value })} /></Field>
              <Row title="Home Assistant discovery" className="sm:self-end"><Switch checked={mqtt.homeAssistantDiscovery} onChange={(v) => setMqtt({ ...mqtt, homeAssistantDiscovery: v })} label="Home Assistant discovery" /></Row>
              <Button className="sm:col-span-2" onClick={() => save.mutate({ integrations: { mqtt } }, { onSuccess: () => toast.success('MQTT settings saved') })}>Save MQTT settings</Button>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <Row title="Webhook notifications" hint="Get a message when an athan starts, is skipped or fails. Works with ntfy, Gotify, Home Assistant webhooks and more.">
            <Switch checked={hook.enabled} onChange={(v) => { setHook({ ...hook, enabled: v }); save.mutate({ integrations: { webhook: { ...hook, enabled: v } } }); }} label="Enable webhook" />
          </Row>
          {hook.enabled && (
            <div className="animate-fade mt-2 space-y-3">
              <Field label="URL"><Input value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} placeholder="https://ntfy.sh/my-athan-topic" inputMode="url" /></Field>
              <Field label="Format">
                <Segmented value={hook.format} onChange={(v) => setHook({ ...hook, format: v })} options={[{ value: 'json', label: 'JSON' }, { value: 'text', label: 'Plain text (ntfy)' }]} />
              </Field>
              <Field label="Notify when">
                <div className="flex flex-wrap gap-2">
                  {events.map((e) => (
                    <Chip key={e} active={hook.events.includes(e)} onClick={() => setHook({ ...hook, events: hook.events.includes(e) ? hook.events.filter((x) => x !== e) : [...hook.events, e] })}>
                      {{ started: 'Athan starts', finished: 'Athan ends', skipped: 'Skipped', error: 'Errors' }[e]}
                    </Chip>
                  ))}
                </div>
              </Field>
              <div className="flex gap-2">
                <Button onClick={() => save.mutate({ integrations: { webhook: hook } }, { onSuccess: () => toast.success('Webhook saved') })}>Save</Button>
                <Button variant="outline" icon={<Send className="size-4" />} onClick={() => save.mutate({ integrations: { webhook: hook } }, { onSuccess: () => test.mutate() })} loading={test.isPending} disabled={!hook.url}>Send test</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { theme, setTheme, clock, setClock } = usePrefs();
  return (
    <Section icon={<Palette className="size-5" />} title="Appearance" hint="Saved in this browser only.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Theme">
          <Segmented value={theme} onChange={setTheme} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Field>
        <Field label="Clock">
          <Segmented value={clock} onChange={setClock} options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} />
        </Field>
      </div>
    </Section>
  );
}

function SystemSection({ cfg }: { cfg: Config }) {
  const { data: sys } = useSystem();
  const save = useSaveConfig();
  const [url, setUrl] = useState(cfg.server.publicUrl ?? '');
  const toast = useToast();
  return (
    <Section icon={<Cpu className="size-5" />} title="System" hint="Information about this server.">
      {sys && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Version</dt><dd>{sys.version}{sys.mock && <Badge tone="gold" className="ml-2">Demo speakers</Badge>}</dd>
          <dt className="text-muted">Host</dt><dd>{sys.hostname} · {sys.platform}</dd>
          <dt className="text-muted">Node.js</dt><dd>{sys.node}</dd>
          <dt className="text-muted">Data folder</dt><dd className="break-all">{sys.dataDir}</dd>
          <dt className="text-muted">Speakers fetch audio from</dt><dd className="break-all tabular">{sys.baseUrl}</dd>
          <dt className="text-muted">Audio tools</dt>
          <dd className="flex flex-wrap gap-1.5">
            {Object.entries(sys.tools).map(([t, ok]) => (
              <Badge key={t} tone={ok ? 'ok' : 'neutral'}>{ok ? '✓' : '–'} {t}</Badge>
            ))}
          </dd>
        </dl>
      )}
      <div className="mt-5 space-y-2 border-t border-line pt-4">
        <Field label="Public address override" hint="Only needed if auto-detection picks the wrong network, e.g. http://192.168.1.20:8080. Speakers must be able to open this address.">
          <div className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={sys?.baseUrl} inputMode="url" />
            <Button variant="outline" onClick={() => save.mutate({ server: { publicUrl: url.trim() || null } }, { onSuccess: () => toast.success('Saved') })}>Save</Button>
          </div>
        </Field>
      </div>
      <Notice className="mt-4 flex items-start gap-2"><Bell className="mt-0.5 size-4 shrink-0" /> This UI has no login. Only expose it on your home network.</Notice>
    </Section>
  );
}

function CalendarSection({ cfg }: { cfg: Config }) {
  const save = useSaveConfig();
  const adj = cfg.calendar.hijriAdjust;
  return (
    <Section icon={<CalendarDays className="size-5" />} title="Islamic calendar" hint="Used for Hijri dates, Ramadan, Eid and the other events on the home screen and calendar.">
      <Field label="Hijri date adjustment" hint="Hijri dates follow the Umm al-Qura calendar. If your community sights the moon locally and starts Ramadan or Eid a day earlier or later, shift the dates here.">
        <Segmented
          value={String(adj) as '-2' | '-1' | '0' | '1' | '2'}
          onChange={(v) => save.mutate({ calendar: { hijriAdjust: Number(v) } })}
          options={[{ value: '-2', label: '−2' }, { value: '-1', label: '−1' }, { value: '0', label: 'None' }, { value: '1', label: '+1' }, { value: '2', label: '+2' }]}
        />
      </Field>
    </Section>
  );
}

function SyncSection({ cfg }: { cfg: Config }) {
  const save = useSaveConfig();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: sync } = useSync();
  const run = useMutation({
    mutationFn: () => api('/sync', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  // refresh other data once a sync finishes
  const [wasRunning, setWasRunning] = useState(false);
  useEffect(() => {
    if (sync?.running) setWasRunning(true);
    else if (wasRunning) {
      setWasRunning(false);
      for (const k of ['speakers', 'state', 'times-month', 'log']) qc.invalidateQueries({ queryKey: [k] });
    }
  }, [sync?.running, wasRunning, qc]);

  const tz = sync?.timezone;
  const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso));
  const s = cfg.sync;
  return (
    <Section icon={<RefreshCw className="size-5" />} title="Daily sync" hint="Refreshes prayer times, rescans for speakers and updates the Islamic calendar, so everything is ready even if the internet is down later.">
      <div className="space-y-4">
        <Row title="Sync every day" hint="Runs at the time below, in your location’s time zone. If the server was off then, it catches up when it starts.">
          <Switch checked={s.enabled} onChange={(v) => save.mutate({ sync: { enabled: v } })} label="Enable daily sync" />
        </Row>
        {s.enabled && (
          <div className="animate-fade grid gap-4 sm:grid-cols-2">
            <Field label="Time" hint={tz ? `Local time (${tz})` : undefined}>
              <Input type="time" value={s.time} onChange={(e) => e.target.value && save.mutate({ sync: { time: e.target.value } })} />
            </Field>
            <Field label="Prepare ahead" hint="Prayer times are fetched for the current month plus this many months.">
              <Select value={s.monthsAhead} onChange={(e) => save.mutate({ sync: { monthsAhead: Number(e.target.value) } })}>
                {Array.from({ length: 13 }, (_, n) => (
                  <option key={n} value={n}>{n === 0 ? 'Current month only' : n === 5 ? 'Current month + 5 months (default)' : `Current month + ${n} month${n === 1 ? '' : 's'}`}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="font-medium">
                {sync?.running ? 'Syncing…' : sync?.lastRun ? `Last sync ${when(sync.lastRun.at)}` : 'Not synced yet'}
                {sync?.lastRun && !sync.running && <Badge tone={sync.lastRun.ok ? 'ok' : 'gold'} className="ml-2">{sync.lastRun.ok ? 'OK' : 'Warnings'}</Badge>}
              </div>
              <div className="text-xs text-muted">{sync?.nextRun && s.enabled ? `Next sync ${when(sync.nextRun)}` : s.enabled ? 'Set a location to schedule syncs' : 'Daily sync is off'}</div>
            </div>
            <Button variant="outline" size="sm" icon={<RefreshCw className={sync?.running ? 'size-4 animate-spin' : 'size-4'} />} onClick={() => run.mutate()} disabled={!!sync?.running || run.isPending}>
              Sync now
            </Button>
          </div>
          {sync?.lastRun && (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
              {sync.lastRun.details.map((d, i) => <li key={i}>{d}</li>)}
              <li className="text-[11px]">Took {(sync.lastRun.durationMs / 1000).toFixed(1)} s · {sync.lastRun.trigger === 'manual' ? 'run manually' : sync.lastRun.trigger === 'catch-up' ? 'catch-up run' : 'scheduled'}</li>
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

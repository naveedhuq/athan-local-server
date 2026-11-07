import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Config } from '@server/schema';
import type { AppState, Athan, DayTimes, DriverStatus, LogEntry, Location, MethodView, SpeakerView, SystemInfo } from '@server/api-types';
import { useToast } from './toast';

export class ApiError extends Error {}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Recursively make every field optional – the shape accepted by PUT /api/config. */
export type DeepPartial<T> = T extends object ? (T extends unknown[] ? T : { [K in keyof T]?: DeepPartial<T[K]> }) : T;

export const useAppState = () => useQuery({ queryKey: ['state'], queryFn: () => api<AppState>('/state'), refetchInterval: 30_000 });
export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => api<Config>('/config') });
export const useSpeakers = () =>
  useQuery({ queryKey: ['speakers'], queryFn: () => api<{ speakers: SpeakerView[]; drivers: Record<string, DriverStatus> }>('/speakers'), refetchInterval: 20_000 });
export const useAthans = () => useQuery({ queryKey: ['athans'], queryFn: () => api<Athan[]>('/athans') });
export const useLog = () => useQuery({ queryKey: ['log'], queryFn: () => api<LogEntry[]>('/log') });
export const useSystem = () => useQuery({ queryKey: ['system'], queryFn: () => api<SystemInfo>('/system') });
export const useMethods = () => useQuery({ queryKey: ['methods'], queryFn: () => api<MethodView[]>('/methods'), staleTime: Infinity });
export const useTimes = (date?: string) => useQuery({ queryKey: ['times', date], queryFn: () => api<DayTimes | null>(`/times${date ? `?date=${date}` : ''}`) });

function merge<T>(base: T, patch: unknown): T {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(base) || !isObj(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out as T;
}

/** Save part of the config with optimistic updates so toggles and sliders feel instant. */
export function useSaveConfig() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: DeepPartial<Config>) => api<Config>('/config', { method: 'PUT', json: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['config'] });
      const prev = qc.getQueryData<Config>(['config']);
      if (prev) qc.setQueryData(['config'], merge(prev, patch));
      return { prev };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['config'], ctx.prev);
      toast.error((err as Error).message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['config'] });
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['times'] });
      qc.invalidateQueries({ queryKey: ['speakers'] });
    },
  });
}

export type { Location };

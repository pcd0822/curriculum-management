import { useState, useEffect, useCallback } from 'react';
import {
  type ConfigRow,
  type ResponseRow,
  type RegistryRow,
  type Settings,
  MOCK_CONFIG,
  MOCK_RESPONSES,
  MOCK_REGISTRY,
  MOCK_SETTINGS,
} from '../data/mockData';

interface DashboardData {
  config: ConfigRow[];
  responses: ResponseRow[];
  registry: RegistryRow[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function gasGet<T>(apiUrl: string, action: string): Promise<T> {
  const res = await fetch(`${apiUrl}?action=${action}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${action}`);
  return res.json();
}

export function useDashboardData(): DashboardData {
  const [config, setConfig] = useState<ConfigRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [registry, setRegistry] = useState<RegistryRow[]>([]);
  const [settings, setSettings] = useState<Settings>(MOCK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const apiUrl = localStorage.getItem('apiUrl');

    if (!apiUrl) {
      setConfig(MOCK_CONFIG);
      setResponses(MOCK_RESPONSES);
      setRegistry(MOCK_REGISTRY);
      setSettings(MOCK_SETTINGS);
      setLoading(false);
      setError('API URL이 설정되지 않았습니다. Mock 데이터를 표시합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [cfgData, resData, regData, setData] = await Promise.all([
        gasGet<ConfigRow[]>(apiUrl, 'getConfig'),
        gasGet<ResponseRow[]>(apiUrl, 'getResponses'),
        gasGet<RegistryRow[]>(apiUrl, 'getRegistry'),
        gasGet<Settings>(apiUrl, 'getSettings'),
      ]);
      setConfig(cfgData);
      setResponses(resData);
      setRegistry(regData);
      setSettings(setData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      setConfig(MOCK_CONFIG);
      setResponses(MOCK_RESPONSES);
      setRegistry(MOCK_REGISTRY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { config, responses, registry, settings, loading, error, refresh: fetchAll };
}

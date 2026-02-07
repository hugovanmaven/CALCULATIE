import type {
  CalculateRequest, CalculateResponse, SensitivityResponse, ValidateResponse,
  StoredTitel, TitelListItem,
} from './types';

const BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

// ── Calculatie ──

export async function calculate(req: CalculateRequest): Promise<CalculateResponse> {
  return post('/calculate', req);
}

export async function sensitivityCac(body: unknown): Promise<SensitivityResponse[]> {
  return post('/sensitivity/cac', body);
}

export async function sensitivityPrice(body: unknown): Promise<SensitivityResponse[]> {
  return post('/sensitivity/price', body);
}

export async function validate(): Promise<ValidateResponse> {
  return get('/validate');
}

export function exportCsvUrl(): string {
  return BASE + '/export/csv';
}

// ── Titels CRUD ──

export async function listTitels(): Promise<TitelListItem[]> {
  return get('/titels');
}

export async function getTitel(id: string): Promise<StoredTitel> {
  return get(`/titels/${id}`);
}

export async function saveTitel(data: {
  id?: string | null;
  titel_input: unknown;
  herdruk_oplages: number[];
  verdeling_webshop: number;
  verdeling_retail: number;
  verdeling_b2b: number;
}): Promise<StoredTitel> {
  return post('/titels', data);
}

export async function deleteTitel(id: string): Promise<void> {
  return del(`/titels/${id}`);
}

import type {
  CalculateRequest, CalculateResponse, SensitivityResponse, ValidateResponse,
  StoredTitel, TitelListItem, OplageSimResponse, Titelgroep,
} from './types';

const BASE = '/calculatie/api';

/** Error die de HTTP-status meedraagt, zodat callers bv. 409 (conflict) kunnen herkennen. */
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body?: any) {
    super(`API error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new ApiError(res.status, errBody);
  }
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

export async function simulateOplage(body: unknown): Promise<OplageSimResponse> {
  return post('/simulate/oplage', body);
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
  verdeling_webshop: number;
  verdeling_retail: number;
  verdeling_b2b: number;
  titelgroep_id?: string | null;
  version?: number | null;
}): Promise<StoredTitel> {
  return post('/titels', data);
}

export async function deleteTitel(id: string): Promise<void> {
  return del(`/titels/${id}`);
}

export async function archiveTitel(id: string): Promise<void> {
  const res = await fetch(BASE + `/titels/${id}/archive`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function unarchiveTitel(id: string): Promise<void> {
  const res = await fetch(BASE + `/titels/${id}/unarchive`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function listTitelsIncludeArchived(): Promise<TitelListItem[]> {
  return get('/titels?archived=true');
}

// ── Titelgroepen ──

export async function listTitelgroepen(): Promise<Titelgroep[]> {
  return get('/titelgroepen');
}

export async function createTitelgroep(naam: string, beschrijving?: string): Promise<Titelgroep> {
  return post('/titelgroepen', { naam, beschrijving });
}

export async function updateTitelgroep(id: string, naam: string, beschrijving?: string): Promise<Titelgroep> {
  const res = await fetch(BASE + `/titelgroepen/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naam, beschrijving }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteTitelgroep(id: string): Promise<void> {
  return del(`/titelgroepen/${id}`);
}

export async function importCsv(file: File): Promise<{ imported: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(BASE + '/import/csv', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Import error: ${res.status}`);
  return res.json();
}

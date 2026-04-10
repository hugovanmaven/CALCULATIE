import type {
  CalculateRequest, CalculateResponse, SensitivityResponse, ValidateResponse,
  StoredTitel, TitelListItem, OplageSimResponse,
  SalesTitelSearchResult,
} from './types';

const BASE = '/calculatie/api';

// Sales dashboard API lives on the parent maven-company.com domain.
// Cross-origin, auth via Cloudflare Access cookie (credentials: 'include').
const SALES_BASE = 'https://maven-company.com/sales/api';

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

// ── Sales dashboard: read-only titel lookup ──

interface SalesListResponse {
  items: Array<{
    id: number;
    titel_id: string;
    titel: string;
    auteur: string;
    imprint_naam?: string;
  }>;
  total: number;
}

export async function searchSalesTitels(query: string): Promise<SalesListResponse['items']> {
  if (!query || query.length < 2) return [];
  const url = `${SALES_BASE}/titels?search=${encodeURIComponent(query)}&page=1`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Sales API error: ${res.status}`);
  const data: SalesListResponse = await res.json();
  return data.items;
}

export async function getSalesTitelDetail(id: number): Promise<SalesTitelSearchResult> {
  const res = await fetch(`${SALES_BASE}/titels/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Sales API error: ${res.status}`);
  return res.json();
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

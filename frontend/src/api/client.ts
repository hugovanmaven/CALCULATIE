import type { CalculateRequest, CalculateResponse, SensitivityResponse, ValidateResponse } from './types';

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
  const res = await fetch(BASE + '/validate');
  return res.json();
}

export function exportCsvUrl(): string {
  return BASE + '/export/csv';
}

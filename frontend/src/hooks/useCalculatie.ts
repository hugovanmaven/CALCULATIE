import { useState, useEffect, useCallback } from 'react';
import type {
  TitelInput, CalculateRequest, CalculateResponse,
  SensitivityResponse,
} from '../api/types';
import { DEFAULT_TITEL_INPUT } from '../api/types';
import { calculate, sensitivityCac, sensitivityPrice } from '../api/client';
import { useDebounce } from './useDebounce';

export function useCalculatie() {
  const [titelInput, setTitelInput] = useState<TitelInput>(DEFAULT_TITEL_INPUT);
  const [herdrukOplages, setHerdrukOplages] = useState<number[]>([]);
  const [verdeling, setVerdeling] = useState({ webshop: 0.10, retail: 0.90, b2b: 0.00 });

  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [cacSens, setCacSens] = useState<SensitivityResponse[] | null>(null);
  const [priceSens, setPriceSens] = useState<SensitivityResponse[] | null>(null);
  const [loading, setLoading] = useState(false);

  const request: CalculateRequest = {
    titel_input: titelInput,
    herdruk_oplages: herdrukOplages,
    verdeling_webshop: verdeling.webshop,
    verdeling_retail: verdeling.retail,
    verdeling_b2b: verdeling.b2b,
  };

  const debouncedRequest = useDebounce(request, 400);

  useEffect(() => {
    runCalculation(debouncedRequest);
  }, [JSON.stringify(debouncedRequest)]);

  const runCalculation = useCallback(async (req: CalculateRequest) => {
    if (!req.titel_input.titel && req.titel_input.verkoopprijs_incl_btw === 0) return;
    setLoading(true);
    try {
      const [calcResult, cacResult, priceResult] = await Promise.all([
        calculate(req),
        sensitivityCac({
          titel_input: req.titel_input,
          herdruk_oplages: req.herdruk_oplages,
          verdeling_webshop: req.verdeling_webshop,
          verdeling_retail: req.verdeling_retail,
          verdeling_b2b: req.verdeling_b2b,
        }),
        sensitivityPrice({
          titel_input: req.titel_input,
          herdruk_oplages: req.herdruk_oplages,
          verdeling_webshop: req.verdeling_webshop,
          verdeling_retail: req.verdeling_retail,
          verdeling_b2b: req.verdeling_b2b,
        }),
      ]);
      setResults(calcResult);
      setCacSens(cacResult);
      setPriceSens(priceResult);
    } catch (e) {
      console.error('Calculation error:', e);
    }
    setLoading(false);
  }, []);

  const updateField = useCallback(<K extends keyof TitelInput>(field: K, value: TitelInput[K]) => {
    setTitelInput(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    titelInput, setTitelInput, updateField,
    herdrukOplages, setHerdrukOplages,
    verdeling, setVerdeling,
    results, cacSens, priceSens,
    loading,
  };
}

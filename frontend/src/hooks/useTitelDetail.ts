import { useState, useEffect, useCallback, useRef } from 'react';
import type { TitelInput, CalculateResponse, SensitivityResponse, OplageSimResponse, DrukConfig } from '../api/types';
import { DEFAULT_TITEL_INPUT, DEFAULT_KOSTENPOSTEN, DEFAULT_DRUK } from '../api/types';
import {
  getTitel, saveTitel, calculate, sensitivityCac, sensitivityPrice, simulateOplage,
} from '../api/client';
import { useDebounce } from './useDebounce';

export interface TitelDetailState {
  id: string | null;
  titelInput: TitelInput;
  herdrukOplages: number[];
  verdeling: { webshop: number; retail: number; b2b: number };
  dirty: boolean;
}

function migrateTitelInput(raw: any): TitelInput {
  const ti = { ...DEFAULT_TITEL_INPUT, ...raw } as TitelInput;

  // Migrate old single-druk format to multi-druk
  if (!ti.drukken || ti.drukken.length === 0) {
    ti.drukken = [{
      druknummer: ti.druknummer || 1,
      oplage: ti.oplage_1e_druk || 2000,
      drukkosten_per_ex: ti.drukkosten_1e_druk || 1.20,
      kostenposten: ti.kostenposten?.length ? [...ti.kostenposten] : [...DEFAULT_KOSTENPOSTEN],
    }];
  } else {
    // Ensure each druk has kostenposten
    ti.drukken = ti.drukken.map(d => ({
      ...d,
      kostenposten: d.kostenposten?.length ? d.kostenposten : [...DEFAULT_KOSTENPOSTEN],
    }));
  }

  // Ensure voorschot fields exist
  if (ti.auteur_voorschot === undefined) ti.auteur_voorschot = 0;
  if (ti.agent_voorschot === undefined) ti.agent_voorschot = 0;
  if (ti.vertaler_voorschot === undefined) ti.vertaler_voorschot = 0;
  if (ti.illustrator_voorschot === undefined) ti.illustrator_voorschot = 0;

  // Ensure extra_derden have voorschot
  if (ti.extra_derden) {
    ti.extra_derden = ti.extra_derden.map(d => ({
      ...d,
      voorschot: d.voorschot ?? 0,
    }));
  }

  // Sync legacy fields from first druk (for engine bridge)
  if (ti.drukken.length > 0) {
    const d1 = ti.drukken[0];
    ti.druknummer = d1.druknummer;
    ti.oplage_1e_druk = d1.oplage;
    ti.drukkosten_1e_druk = d1.drukkosten_per_ex;
  }

  return ti;
}

function newTitelState(): TitelDetailState {
  return {
    id: null,
    titelInput: { ...DEFAULT_TITEL_INPUT, drukken: [{ ...DEFAULT_DRUK }], kostenposten: [...DEFAULT_KOSTENPOSTEN] },
    herdrukOplages: [],
    verdeling: { webshop: 0.10, retail: 0.90, b2b: 0.00 },
    dirty: false,
  };
}

/**
 * Hook voor één titel: laadt, bewerkt, auto-save, auto-calc.
 */
export function useTitelDetail(titelId: string | null) {
  const [state, setState] = useState<TitelDetailState>(newTitelState());
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [cacSens, setCacSens] = useState<SensitivityResponse[] | null>(null);
  const [priceSens, setPriceSens] = useState<SensitivityResponse[] | null>(null);
  const [oplageSim, setOplageSim] = useState<OplageSimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveInProgress = useRef(false);

  // ── Load titel from backend ──
  useEffect(() => {
    if (!titelId) {
      setState(newTitelState());
      setResults(null);
      setCacSens(null);
      setPriceSens(null);
      setOplageSim(null);
      setLoaded(true);
      return;
    }
    loadTitel(titelId);
  }, [titelId]);

  const loadTitel = async (id: string) => {
    try {
      const st = await getTitel(id);
      setState({
        id: st.id,
        titelInput: migrateTitelInput(st.titel_input),
        herdrukOplages: st.herdruk_oplages ?? [],
        verdeling: {
          webshop: st.verdeling_webshop ?? 0.10,
          retail: st.verdeling_retail ?? 0.85,
          b2b: st.verdeling_b2b ?? 0.05,
        },
        dirty: false,
      });
    } catch (e) {
      console.error('Failed to load titel:', e);
      setState(newTitelState());
    }
    setLoaded(true);
  };

  // ── Auto-save (debounced 1500ms) ──
  const debouncedState = useDebounce(state, 1500);

  useEffect(() => {
    if (!loaded || !debouncedState.dirty || saveInProgress.current) return;
    autoSave(debouncedState);
  }, [debouncedState, loaded]);

  const autoSave = useCallback(async (s: TitelDetailState) => {
    if (!s.titelInput.titel && s.titelInput.verkoopprijs_incl_btw === 0) return;
    saveInProgress.current = true;
    try {
      const saved = await saveTitel({
        id: s.id,
        titel_input: s.titelInput,
        herdruk_oplages: s.herdrukOplages,
        verdeling_webshop: s.verdeling.webshop,
        verdeling_retail: s.verdeling.retail,
        verdeling_b2b: s.verdeling.b2b,
      });
      setState(prev => prev.id === s.id || (!prev.id && !s.id)
        ? { ...prev, id: saved.id, dirty: false }
        : prev
      );
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    saveInProgress.current = false;
  }, []);

  // ── Auto-calculate (debounced 400ms) ──
  const calcRequest = {
    titel_input: state.titelInput,
    herdruk_oplages: state.herdrukOplages,
    verdeling_webshop: state.verdeling.webshop,
    verdeling_retail: state.verdeling.retail,
    verdeling_b2b: state.verdeling.b2b,
  };
  const debouncedRequest = useDebounce(calcRequest, 400);

  useEffect(() => {
    runCalculation();
  }, [JSON.stringify(debouncedRequest)]);

  const runCalculation = useCallback(async () => {
    const req = debouncedRequest;
    if (!req.titel_input.titel && req.titel_input.verkoopprijs_incl_btw === 0) return;
    setLoading(true);
    try {
      const [calcResult, cacResult, priceResult, oplageResult] = await Promise.all([
        calculate(req),
        sensitivityCac(req),
        sensitivityPrice(req),
        simulateOplage(req),
      ]);
      setResults(calcResult);
      setCacSens(cacResult);
      setPriceSens(priceResult);
      setOplageSim(oplageResult);
    } catch (e) {
      console.error('Calculation error:', e);
    }
    setLoading(false);
  }, [debouncedRequest]);

  // ── Mutations ──
  const updateField = useCallback(<K extends keyof TitelInput>(field: K, value: TitelInput[K]) => {
    setState(prev => {
      const newInput = { ...prev.titelInput, [field]: value };

      // If drukken changed, sync legacy fields from first druk
      if (field === 'drukken' && Array.isArray(value) && (value as DrukConfig[]).length > 0) {
        const d1 = (value as DrukConfig[])[0];
        newInput.druknummer = d1.druknummer;
        newInput.oplage_1e_druk = d1.oplage;
        newInput.drukkosten_1e_druk = d1.drukkosten_per_ex;
      }

      return { ...prev, titelInput: newInput, dirty: true };
    });
  }, []);

  const setHerdrukOplages = useCallback((v: number[]) => {
    setState(prev => ({ ...prev, herdrukOplages: v, dirty: true }));
  }, []);

  const setVerdeling = useCallback((v: { webshop: number; retail: number; b2b: number }) => {
    setState(prev => ({ ...prev, verdeling: v, dirty: true }));
  }, []);

  return {
    titelInput: state.titelInput,
    updateField,
    herdrukOplages: state.herdrukOplages,
    setHerdrukOplages,
    verdeling: state.verdeling,
    setVerdeling,
    dirty: state.dirty,
    id: state.id,
    loaded,
    results, cacSens, priceSens, oplageSim, loading,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TitelInput, CalculateResponse, SensitivityResponse, OplageSimResponse } from '../api/types';
import { DEFAULT_TITEL_INPUT, DEFAULT_KOSTENPOSTEN, DEFAULT_DRUK } from '../api/types';
import {
  getTitel, saveTitel, calculate, sensitivityCac, sensitivityPrice, simulateOplage,
  ApiError,
} from '../api/client';
import { useDebounce } from './useDebounce';

export interface TitelDetailState {
  id: string | null;
  titelInput: TitelInput;
  verdeling: { webshop: number; retail: number; b2b: number };
  titelgroepId: string | null;
  version: number | null;
  dirty: boolean;
}

function migrateTitelInput(raw: any): TitelInput {
  const ti = { ...DEFAULT_TITEL_INPUT, ...raw } as TitelInput;

  // Ensure at least one druk exists with valid kostenposten
  if (!ti.drukken || ti.drukken.length === 0) {
    ti.drukken = [{ ...DEFAULT_DRUK }];
  } else {
    ti.drukken = ti.drukken.map(d => ({
      ...d,
      kostenposten: d.kostenposten?.length
        ? d.kostenposten.map(kp => ({ id: kp.id, naam: kp.naam, categorie: kp.categorie, bedrag: kp.bedrag }))
        : [...DEFAULT_KOSTENPOSTEN],
    }));
  }

  // Ensure voorschot fields exist
  if (ti.auteur_voorschot === undefined) ti.auteur_voorschot = 0;
  if (ti.agent_voorschot === undefined) ti.agent_voorschot = 0;
  if (ti.vertaler_voorschot === undefined) ti.vertaler_voorschot = 0;
  if (ti.illustrator_voorschot === undefined) ti.illustrator_voorschot = 0;

  if (ti.extra_derden) {
    ti.extra_derden = ti.extra_derden.map(d => ({
      ...d,
      voorschot: d.voorschot ?? 0,
    }));
  }

  return ti;
}

function newTitelState(): TitelDetailState {
  return {
    id: null,
    titelInput: { ...DEFAULT_TITEL_INPUT, drukken: [{ ...DEFAULT_DRUK }] },
    verdeling: { webshop: 0.10, retail: 0.90, b2b: 0.00 },
    titelgroepId: null,
    version: null,
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
  const [conflict, setConflict] = useState(false);
  const saveInProgress = useRef(false);

  // ── Load titel from backend ──
  useEffect(() => {
    if (!titelId) {
      setState(newTitelState());
      setResults(null);
      setCacSens(null);
      setPriceSens(null);
      setOplageSim(null);
      setConflict(false);
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
        verdeling: {
          webshop: st.verdeling_webshop ?? 0.10,
          retail: st.verdeling_retail ?? 0.85,
          b2b: st.verdeling_b2b ?? 0.05,
        },
        titelgroepId: st.titelgroep_id ?? null,
        version: st.version ?? null,
        dirty: false,
      });
      setConflict(false);
    } catch (e) {
      console.error('Failed to load titel:', e);
      setState(newTitelState());
    }
    setLoaded(true);
  };

  /** Herlaad de huidige titel vanuit de DB en hef de conflict-staat op. */
  const reloadTitel = useCallback(() => {
    if (state.id) loadTitel(state.id);
  }, [state.id]);

  // ── Auto-save (debounced 1500ms) ──
  const debouncedState = useDebounce(state, 1500);

  useEffect(() => {
    // Bij een open conflict pauzeren we autosave: anders zouden we de
    // wijziging van de ander tóch overschrijven zodra de versie weer klopt.
    if (!loaded || conflict || !debouncedState.dirty || saveInProgress.current) return;
    // Alleen de huidige, gesettelde state opslaan. useDebounce geeft ná de
    // wachttijd exact dezelfde object-referentie als `state` terug; zolang ze
    // verschillen is de snapshot verouderd. Dit voorkomt dat een achterlopende
    // snapshot (bv. vlak na "Nieuwste versie laden") een verouderde save afvuurt
    // en zo het conflict meteen weer oproept.
    if (debouncedState !== state) return;
    autoSave(debouncedState);
  }, [debouncedState, state, loaded, conflict]);

  const autoSave = useCallback(async (s: TitelDetailState) => {
    if (!s.titelInput.titel && s.titelInput.verkoopprijs_incl_btw === 0) return;
    saveInProgress.current = true;
    try {
      const saved = await saveTitel({
        id: s.id,
        titel_input: s.titelInput,
        verdeling_webshop: s.verdeling.webshop,
        verdeling_retail: s.verdeling.retail,
        verdeling_b2b: s.verdeling.b2b,
        titelgroep_id: s.titelgroepId,
        version: s.version,
      });
      setState(prev => prev.id === s.id || (!prev.id && !s.id)
        ? { ...prev, id: saved.id, version: saved.version ?? prev.version, dirty: false }
        : prev
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Iemand anders heeft deze titel intussen opgeslagen.
        setConflict(true);
      } else {
        console.error('Auto-save failed:', e);
      }
    }
    saveInProgress.current = false;
  }, []);

  // ── Auto-calculate (debounced 400ms) ──
  const calcRequest = {
    titel_input: state.titelInput,
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
    setState(prev => ({
      ...prev,
      titelInput: { ...prev.titelInput, [field]: value },
      dirty: true,
    }));
  }, []);

  const setVerdeling = useCallback((v: { webshop: number; retail: number; b2b: number }) => {
    setState(prev => ({ ...prev, verdeling: v, dirty: true }));
  }, []);

  const setTitelgroepId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, titelgroepId: id, dirty: true }));
  }, []);

  return {
    titelInput: state.titelInput,
    updateField,
    verdeling: state.verdeling,
    setVerdeling,
    titelgroepId: state.titelgroepId,
    setTitelgroepId,
    dirty: state.dirty,
    id: state.id,
    loaded,
    conflict,
    reloadTitel,
    results, cacSens, priceSens, oplageSim, loading,
  };
}

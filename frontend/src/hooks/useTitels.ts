import { useState, useEffect, useCallback, useRef } from 'react';
import type { TitelInput, TitelListItem, CalculateResponse, SensitivityResponse } from '../api/types';
import { DEFAULT_TITEL_INPUT, DEFAULT_KOSTENPOSTEN } from '../api/types';
import {
  listTitels, getTitel, saveTitel, deleteTitel as apiDeleteTitel,
  calculate, sensitivityCac, sensitivityPrice,
} from '../api/client';
import { useDebounce } from './useDebounce';

export interface TitelState {
  id: string | null;          // null = not yet saved
  titelInput: TitelInput;
  herdrukOplages: number[];
  verdeling: { webshop: number; retail: number; b2b: number };
  dirty: boolean;             // has unsaved changes
}

function newTitelState(): TitelState {
  return {
    id: null,
    titelInput: { ...DEFAULT_TITEL_INPUT, kostenposten: [...DEFAULT_KOSTENPOSTEN] },
    herdrukOplages: [],
    verdeling: { webshop: 0.10, retail: 0.90, b2b: 0.00 },
    dirty: false,
  };
}

export function useTitels() {
  // ── Multi-title state ──
  const [tabs, setTabs] = useState<TitelListItem[]>([]);
  const [titels, setTitels] = useState<TitelState[]>([newTitelState()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // ── Calculatie results (for active titel) ──
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [cacSens, setCacSens] = useState<SensitivityResponse[] | null>(null);
  const [priceSens, setPriceSens] = useState<SensitivityResponse[] | null>(null);
  const [loading, setLoading] = useState(false);

  const active = titels[activeIndex] ?? titels[0];

  // ── Load from backend on mount ──
  useEffect(() => {
    loadTitels();
  }, []);

  const loadTitels = async () => {
    try {
      const list = await listTitels();
      if (list.length === 0) {
        setTitels([newTitelState()]);
        setActiveIndex(0);
        setTabs([]);
        setLoaded(true);
        return;
      }
      setTabs(list);

      // Load all titels in parallel
      const loaded = await Promise.all(
        list.map(item => getTitel(item.id))
      );

      const states: TitelState[] = loaded.map(st => ({
        id: st.id,
        titelInput: st.titel_input as TitelInput,
        herdrukOplages: st.herdruk_oplages,
        verdeling: {
          webshop: st.verdeling_webshop,
          retail: st.verdeling_retail,
          b2b: st.verdeling_b2b,
        },
        dirty: false,
      }));

      setTitels(states);
      setActiveIndex(0);
    } catch (e) {
      console.error('Failed to load titels:', e);
      setTitels([newTitelState()]);
    }
    setLoaded(true);
  };

  // ── Auto-save (debounced) ──
  const debouncedActive = useDebounce(active, 1500);
  const saveInProgress = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    if (!debouncedActive.dirty) return;
    if (saveInProgress.current) return;
    autoSave(debouncedActive);
  }, [debouncedActive, loaded]);

  const autoSave = useCallback(async (state: TitelState) => {
    // Don't save empty titles
    if (!state.titelInput.titel && state.titelInput.verkoopprijs_incl_btw === 0) return;

    saveInProgress.current = true;
    try {
      const saved = await saveTitel({
        id: state.id,
        titel_input: state.titelInput,
        herdruk_oplages: state.herdrukOplages,
        verdeling_webshop: state.verdeling.webshop,
        verdeling_retail: state.verdeling.retail,
        verdeling_b2b: state.verdeling.b2b,
      });

      // Update the id if it was a new titel and mark clean
      setTitels(prev => prev.map((t, i) => {
        if (t === state || (state.id && t.id === state.id) || (!state.id && i === prev.indexOf(state))) {
          return { ...t, id: saved.id, dirty: false };
        }
        return t;
      }));

      // Update tabs
      refreshTabs();
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    saveInProgress.current = false;
  }, []);

  const refreshTabs = async () => {
    try {
      const list = await listTitels();
      setTabs(list);
    } catch { /* ignore */ }
  };

  // ── Calculatie (auto-run on change) ──
  const calcRequest = {
    titel_input: active.titelInput,
    herdruk_oplages: active.herdrukOplages,
    verdeling_webshop: active.verdeling.webshop,
    verdeling_retail: active.verdeling.retail,
    verdeling_b2b: active.verdeling.b2b,
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
      const [calcResult, cacResult, priceResult] = await Promise.all([
        calculate(req),
        sensitivityCac(req),
        sensitivityPrice(req),
      ]);
      setResults(calcResult);
      setCacSens(cacResult);
      setPriceSens(priceResult);
    } catch (e) {
      console.error('Calculation error:', e);
    }
    setLoading(false);
  }, [debouncedRequest]);

  // ── Mutations for active titel ──
  const updateField = useCallback(<K extends keyof TitelInput>(field: K, value: TitelInput[K]) => {
    setTitels(prev => prev.map((t, i) =>
      i === activeIndex ? { ...t, titelInput: { ...t.titelInput, [field]: value }, dirty: true } : t
    ));
  }, [activeIndex]);

  const setHerdrukOplages = useCallback((v: number[]) => {
    setTitels(prev => prev.map((t, i) =>
      i === activeIndex ? { ...t, herdrukOplages: v, dirty: true } : t
    ));
  }, [activeIndex]);

  const setVerdeling = useCallback((v: { webshop: number; retail: number; b2b: number }) => {
    setTitels(prev => prev.map((t, i) =>
      i === activeIndex ? { ...t, verdeling: v, dirty: true } : t
    ));
  }, [activeIndex]);

  // ── Tab operations ──
  const addTitel = useCallback(() => {
    const newState = newTitelState();
    setTitels(prev => [...prev, newState]);
    setActiveIndex(titels.length); // switch to new tab
  }, [titels.length]);

  const switchTitel = useCallback((index: number) => {
    if (index >= 0 && index < titels.length) {
      setActiveIndex(index);
      // Reset results — will recalculate via debounce
      setResults(null);
      setCacSens(null);
      setPriceSens(null);
    }
  }, [titels.length]);

  const removeTitel = useCallback(async (index: number) => {
    const titel = titels[index];
    if (titels.length <= 1) return; // keep at least one

    // Delete from backend if saved
    if (titel.id) {
      try {
        await apiDeleteTitel(titel.id);
      } catch (e) {
        console.error('Delete failed:', e);
      }
    }

    setTitels(prev => prev.filter((_, i) => i !== index));

    // Adjust active index
    if (activeIndex >= index && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }

    refreshTabs();
  }, [titels, activeIndex]);

  const duplicateTitel = useCallback(() => {
    const source = titels[activeIndex];
    const dup: TitelState = {
      id: null, // new
      titelInput: {
        ...source.titelInput,
        titel: source.titelInput.titel + ' (kopie)',
        kostenposten: source.titelInput.kostenposten.map(kp => ({ ...kp })),
      },
      herdrukOplages: [...source.herdrukOplages],
      verdeling: { ...source.verdeling },
      dirty: true,
    };
    setTitels(prev => [...prev, dup]);
    setActiveIndex(titels.length);
  }, [titels, activeIndex]);

  return {
    // Multi-title
    titels,
    tabs,
    activeIndex,
    active,
    addTitel,
    switchTitel,
    removeTitel,
    duplicateTitel,
    loaded,

    // Active titel fields (same API as before)
    titelInput: active.titelInput,
    updateField,
    herdrukOplages: active.herdrukOplages,
    setHerdrukOplages,
    verdeling: active.verdeling,
    setVerdeling,

    // Results
    results, cacSens, priceSens, loading,
  };
}

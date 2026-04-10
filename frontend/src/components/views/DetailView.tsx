import { useTitelDetail } from '../../hooks/useTitelDetail';
import { CalculatieForm } from '../form/CalculatieForm';
import { UnifiedDashboard } from '../results/UnifiedDashboard';
import { ExportButtons } from '../export/ExportButtons';
import { ArrowLeft, Loader2, Check, Circle } from 'lucide-react';

interface Props {
  titelId: string;
  onBack: () => void;
}

export default function DetailView({ titelId, onBack }: Props) {
  const {
    titelInput, updateField,
    herdrukOplages, setHerdrukOplages,
    verdeling, setVerdeling,
    dirty, loaded,
    results, cacSens, priceSens, oplageSim, loading,
  } = useTitelDetail(titelId);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
              title="Terug naar overzicht"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
                {titelInput.titel || 'Nieuwe titel'}
                {titelInput.druknummer > 1 && (
                  <span className="ml-1.5 text-sm font-normal text-[var(--text-tertiary)]">
                    ({titelInput.druknummer}e druk)
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                {titelInput.auteur && <span>{titelInput.auteur}</span>}
                {titelInput.isbn && <span className="font-mono">{titelInput.isbn}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
              {dirty ? (
                <>
                  <Circle size={8} className="fill-[var(--accent)] text-[var(--accent)]" />
                  Niet opgeslagen
                </>
              ) : (
                <>
                  <Check size={14} className="text-emerald-500" />
                  Opgeslagen
                </>
              )}
            </span>
            {loading && <Loader2 size={16} className="animate-spin text-[var(--accent)]" />}
            <ExportButtons
              titelInput={titelInput}
              herdrukOplages={herdrukOplages}
              verdeling={verdeling}
            />
          </div>
        </div>
      </header>

      {/* Content: on mobile results first, on desktop side-by-side */}
      <div className="flex flex-col lg:flex-row">
        {/* Left: Input Form (on mobile this comes SECOND) */}
        <div className="order-2 lg:order-1 w-full lg:w-[440px] lg:min-w-[440px] border-r border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto lg:h-[calc(100vh-52px)] lg:sticky lg:top-[52px]">
          <div className="p-3 sm:p-4">
            <CalculatieForm
              titelInput={titelInput}
              updateField={updateField}
              herdrukOplages={herdrukOplages}
              setHerdrukOplages={setHerdrukOplages}
              verdeling={verdeling}
              setVerdeling={setVerdeling}
            />
          </div>
        </div>

        {/* Right: Results Dashboard (on mobile this comes FIRST) */}
        <div className="order-1 lg:order-2 flex-1 overflow-y-auto lg:h-[calc(100vh-52px)] p-3 sm:p-4 lg:p-6">
          {!results ? (
            <div className="text-center text-[var(--text-tertiary)] py-16">
              <p className="text-base">Vul gegevens in om resultaten te zien</p>
              <p className="text-sm mt-1">Resultaten verschijnen automatisch</p>
            </div>
          ) : (
            <UnifiedDashboard
              results={results}
              titelInput={titelInput}
              verdeling={verdeling}
              cacSens={cacSens}
              priceSens={priceSens}
              oplageSim={oplageSim}
            />
          )}
        </div>
      </div>
    </div>
  );
}

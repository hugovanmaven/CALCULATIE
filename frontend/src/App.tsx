import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { TitelTabs } from './components/layout/TitelTabs';
import { CalculatieForm } from './components/form/CalculatieForm';
import { ResultsDashboard } from './components/results/ResultsDashboard';
import { SensitivityPanel } from './components/sensitivity/SensitivityPanel';
import { ExportButtons } from './components/export/ExportButtons';
import { useTitels } from './hooks/useTitels';
import { Loader2 } from 'lucide-react';

type ActivePanel = 'resultaten' | 'margeverbeteringen';

export default function App() {
  const {
    titels, activeIndex,
    addTitel, switchTitel, removeTitel, duplicateTitel,
    titelInput, updateField,
    herdrukOplages, setHerdrukOplages,
    verdeling, setVerdeling,
    results, cacSens, priceSens,
    loading, loaded,
  } = useTitels();

  const [activePanel, setActivePanel] = useState<ActivePanel>('resultaten');

  if (!loaded) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[calc(100vh-52px)]">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Titel tabs */}
      <TitelTabs
        titels={titels}
        activeIndex={activeIndex}
        onSwitch={switchTitel}
        onAdd={addTitel}
        onRemove={removeTitel}
        onDuplicate={duplicateTitel}
      />

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Left: Input Form */}
        <div className="w-full lg:w-[440px] lg:min-w-[440px] border-r border-gray-200 bg-white overflow-y-auto lg:h-[calc(100vh-92px)] lg:sticky lg:top-[92px]">
          <div className="p-4">
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

        {/* Right: Results */}
        <div className="flex-1 overflow-y-auto lg:h-[calc(100vh-92px)] p-4 lg:p-6">
          {/* Top bar with panel toggle + export */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActivePanel('resultaten')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activePanel === 'resultaten'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Resultaten
              </button>
              <button
                onClick={() => setActivePanel('margeverbeteringen')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activePanel === 'margeverbeteringen'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Margeverbeteringen
              </button>
            </div>
            <div className="flex items-center gap-3">
              {loading && (
                <Loader2 size={18} className="animate-spin text-blue-500" />
              )}
              <ExportButtons
                titelInput={titelInput}
                herdrukOplages={herdrukOplages}
                verdeling={verdeling}
              />
            </div>
          </div>

          {/* Title indicator */}
          {titelInput.titel && (
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {titelInput.titel}
              {titelInput.isbn && (
                <span className="ml-2 text-sm font-normal text-gray-400 font-mono">
                  {titelInput.isbn}
                </span>
              )}
              {titelInput.druknummer > 1 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({titelInput.druknummer}e druk)
                </span>
              )}
            </h2>
          )}

          {/* Panel content */}
          {!results ? (
            <div className="text-center text-gray-400 py-16">
              <p className="text-base">Vul gegevens in aan de linkerkant</p>
              <p className="text-sm mt-1">Resultaten verschijnen automatisch</p>
            </div>
          ) : activePanel === 'resultaten' ? (
            <ResultsDashboard results={results} titelInput={titelInput} />
          ) : activePanel === 'margeverbeteringen' ? (
            <SensitivityPanel cacSens={cacSens} priceSens={priceSens} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

import { useState, useCallback, useEffect } from 'react';
import DatabaseView from './components/views/DatabaseView';
import DetailView from './components/views/DetailView';
import { useTitelList } from './hooks/useTitelList';
import { saveTitel, deleteTitel, importCsv } from './api/client';
import { DEFAULT_TITEL_INPUT } from './api/types';
import ResultatenView from './resultaten/ResultatenView';
import { checkEnabled as resultatenEnabled } from './resultaten/api';

type View = { kind: 'database' } | { kind: 'detail'; titelId: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'database' });
  const list = useTitelList();

  // Resultaten-module (feature flag): alleen tonen als de backend de module
  // serveert (/resultaten/api/ping → 200). Met de flag uit ziet de
  // calculatie-app er exact hetzelfde uit als voorheen.
  const [section, setSection] = useState<'calculatie' | 'resultaten'>('calculatie');
  const [hasResultaten, setHasResultaten] = useState(false);
  useEffect(() => {
    resultatenEnabled().then(setHasResultaten);
  }, []);

  const handleOpenTitel = useCallback((id: string) => {
    setView({ kind: 'detail', titelId: id });
  }, []);

  const handleNewTitel = useCallback(async () => {
    const saved = await saveTitel({
      titel_input: { ...DEFAULT_TITEL_INPUT },
      verdeling_webshop: 0.10,
      verdeling_retail: 0.90,
      verdeling_b2b: 0.00,
    });
    setView({ kind: 'detail', titelId: saved.id });
  }, []);

  const handleBack = useCallback(() => {
    setView({ kind: 'database' });
    list.refresh();
  }, [list]);

  const handleDelete = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map(id => deleteTitel(id)));
    list.refresh();
  }, [list]);

  const handleImportCsv = useCallback(async (file: File) => {
    try {
      await importCsv(file);
      list.refresh();
    } catch (e) {
      console.error('CSV import failed:', e);
      alert('Import mislukt. Controleer het CSV-formaat.');
    }
  }, [list]);

  const tabBar = hasResultaten ? (
    <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)] sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 flex gap-1">
        <TabButton active={section === 'calculatie'} onClick={() => setSection('calculatie')}>Calculatie</TabButton>
        <TabButton active={section === 'resultaten'} onClick={() => setSection('resultaten')}>Resultaten</TabButton>
      </div>
    </div>
  ) : null;

  let content: React.ReactNode;
  if (section === 'resultaten') {
    content = <ResultatenView />;
  } else if (view.kind === 'detail') {
    content = <DetailView titelId={view.titelId} onBack={handleBack} />;
  } else {
    content = (
      <DatabaseView
        items={list.items}
        loading={list.loading}
        showArchived={list.showArchived}
        onToggleArchived={list.setShowArchived}
        onOpenTitel={handleOpenTitel}
        onNewTitel={handleNewTitel}
        onArchive={list.archive}
        onUnarchive={list.unarchive}
        onDelete={handleDelete}
        onImportCsv={handleImportCsv}
      />
    );
  }

  return (
    <>
      {tabBar}
      {content}
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-[var(--accent)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

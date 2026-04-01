import { useState, useCallback } from 'react';
import DatabaseView from './components/views/DatabaseView';
import DetailView from './components/views/DetailView';
import { useTitelList } from './hooks/useTitelList';
import { saveTitel, deleteTitel, importCsv } from './api/client';
import { DEFAULT_TITEL_INPUT, DEFAULT_KOSTENPOSTEN } from './api/types';

type View = { kind: 'database' } | { kind: 'detail'; titelId: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'database' });
  const list = useTitelList();

  const handleOpenTitel = useCallback((id: string) => {
    setView({ kind: 'detail', titelId: id });
  }, []);

  const handleNewTitel = useCallback(async () => {
    const saved = await saveTitel({
      titel_input: { ...DEFAULT_TITEL_INPUT, kostenposten: [...DEFAULT_KOSTENPOSTEN] },
      herdruk_oplages: [],
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

  if (view.kind === 'detail') {
    return (
      <DetailView
        titelId={view.titelId}
        onBack={handleBack}
      />
    );
  }

  return (
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

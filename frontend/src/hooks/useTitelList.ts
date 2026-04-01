import { useState, useEffect, useCallback } from 'react';
import type { TitelListItem } from '../api/types';
import { listTitels, listTitelsIncludeArchived, archiveTitel, unarchiveTitel } from '../api/client';

export function useTitelList() {
  const [items, setItems] = useState<TitelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = showArchived
        ? await listTitelsIncludeArchived()
        : await listTitels();
      setItems(list);
    } catch (e) {
      console.error('Failed to load titels:', e);
    }
    setLoading(false);
  }, [showArchived]);

  useEffect(() => { refresh(); }, [refresh]);

  const archive = useCallback(async (id: string) => {
    await archiveTitel(id);
    await refresh();
  }, [refresh]);

  const unarchive = useCallback(async (id: string) => {
    await unarchiveTitel(id);
    await refresh();
  }, [refresh]);

  return { items, loading, refresh, showArchived, setShowArchived, archive, unarchive };
}

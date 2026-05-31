import { useEffect, useState } from 'react';
import type { Titelgroep } from '../../api/types';
import { listTitelgroepen, createTitelgroep } from '../../api/client';
import { Plus, X } from 'lucide-react';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

/**
 * Kies een titelgroep om deze titel aan te koppelen, of maak er een nieuwe.
 * Een titelgroep bundelt meerdere ISBN's (paperback, hardcover, e-book, audio)
 * onder één 'merk' voor cross-format omzet- en voorschotrapportage.
 */
export function TitelgroepPicker({ value, onChange }: Props) {
  const [groepen, setGroepen] = useState<Titelgroep[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setGroepen(await listTitelgroepen());
    } catch {
      // stille fail — picker valt terug op lege lijst
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async () => {
    const naam = newName.trim();
    if (!naam) {
      setError('Geef een naam op');
      return;
    }
    try {
      const groep = await createTitelgroep(naam);
      await reload();
      onChange(groep.id);
      setNewName('');
      setCreating(false);
      setError(null);
    } catch {
      setError('Kon niet aanmaken');
    }
  };

  if (creating) {
    return (
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Nieuwe titelgroep
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); setError(null); }
            }}
            autoFocus
            placeholder="Bijv. DRIVE"
            className="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Maak
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(''); setError(null); }}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Annuleer"
          >
            <X size={16} />
          </button>
        </div>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
        Titelgroep <span className="text-[var(--text-tertiary)] normal-case font-normal">(optioneel)</span>
      </label>
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
        >
          <option value="">— Geen groep —</option>
          {groepen.map(g => (
            <option key={g.id} value={g.id}>{g.naam}</option>
          ))}
        </select>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Nieuwe titelgroep"
        >
          <Plus size={14} />
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
        Bundel verschijningsvormen (paperback, e-book, audio) van dezelfde titel.
      </p>
    </div>
  );
}

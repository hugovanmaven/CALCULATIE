import { Plus, Trash2 } from 'lucide-react';
import type { StaffelTrede } from '../../api/types';

interface Props {
  staffel: StaffelTrede[];
  onChange: (staffel: StaffelTrede[]) => void;
  label?: string;
}

export function StaffelEditor({ staffel, onChange, label }: Props) {
  const addTrede = () => {
    const lastGrens = staffel.length > 0 ? staffel[staffel.length - 1].tot_exemplaren : 0;
    onChange([...staffel, { tot_exemplaren: lastGrens + 5000, percentage: 0 }]);
  };

  const updateTrede = (index: number, field: keyof StaffelTrede, value: number) => {
    const updated = [...staffel];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeTrede = (index: number) => {
    onChange(staffel.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{label}</p>
      )}
      {staffel.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--text-tertiary)] uppercase">
              <th className="text-left py-1 font-medium">#</th>
              <th className="text-left py-1 font-medium">Tot exemplaren</th>
              <th className="text-left py-1 font-medium">Percentage</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {staffel.map((trede, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="py-1 text-[var(--text-tertiary)]">{i + 1}</td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    value={trede.tot_exemplaren || ''}
                    onChange={e => updateTrede(i, 'tot_exemplaren', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                    step={1000}
                  />
                </td>
                <td className="py-1 pr-2">
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={parseFloat((trede.percentage * 100).toFixed(8)) || ''}
                      onChange={e => updateTrede(i, 'percentage', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-l bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                      step={0.5}
                    />
                    <span className="inline-flex items-center px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r">
                      %
                    </span>
                  </div>
                </td>
                <td className="py-1">
                  <button
                    onClick={() => removeTrede(i)}
                    className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        onClick={addTrede}
        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Trede toevoegen
      </button>
    </div>
  );
}

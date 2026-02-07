import { Plus, Trash2 } from 'lucide-react';

interface Props {
  herdrukOplages: number[];
  setHerdrukOplages: (v: number[]) => void;
}

export function HerdrukkenSection({ herdrukOplages, setHerdrukOplages }: Props) {
  const addHerdruk = () => {
    setHerdrukOplages([...herdrukOplages, 2000]);
  };

  const updateHerdruk = (index: number, value: number) => {
    const updated = [...herdrukOplages];
    updated[index] = value;
    setHerdrukOplages(updated);
  };

  const removeHerdruk = (index: number) => {
    setHerdrukOplages(herdrukOplages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {herdrukOplages.length === 0 && (
        <p className="text-xs text-gray-400">Geen herdrukken toegevoegd</p>
      )}
      {herdrukOplages.map((oplage, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16">{i + 2}e druk</span>
          <input
            type="number"
            value={oplage || ''}
            onChange={e => updateHerdruk(i, parseInt(e.target.value) || 0)}
            step={500}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Oplage"
          />
          <span className="text-xs text-gray-400">ex</span>
          <button
            onClick={() => removeHerdruk(i)}
            className="p-1 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addHerdruk}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        <Plus className="w-3.5 h-3.5" />
        Herdruk toevoegen
      </button>
    </div>
  );
}

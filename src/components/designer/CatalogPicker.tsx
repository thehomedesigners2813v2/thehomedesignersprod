import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { CatalogItem, CustomEntry } from '../../lib/designerCatalog';

interface CatalogPickerProps {
  items: CatalogItem[];
  selectedIds: string[];
  custom: CustomEntry[];
  categories?: string[];
  onChange: (selectedIds: string[], custom: CustomEntry[]) => void;
  customLabel: string;
  onUploadImage?: (file: File) => Promise<string | null>;
}

export default function CatalogPicker({
  items,
  selectedIds,
  custom,
  categories,
  onChange,
  customLabel,
  onUploadImage
}: CatalogPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [customName, setCustomName] = useState('');
  const [customImage, setCustomImage] = useState('');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!term) return true;
      return item.name.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
    });
  }, [items, query, category]);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    onChange(next, custom);
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    onChange(selectedIds, [...custom, { name, imageUrl: customImage.trim() || undefined }]);
    setCustomName('');
    setCustomImage('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <p className="text-sm font-medium text-[#172B45]">{selectedIds.length + custom.length} selected</p>
      </div>

      {categories && (
        <div className="flex flex-wrap gap-2">
          {['All', ...categories].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-full px-3 py-1 text-sm ${category === value ? 'bg-[#172B45] text-white' : 'bg-white text-[#172B45]'}`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm ${selected ? 'border-[#D96C4D] ring-2 ring-[#D96C4D]' : 'border-stone-200'}`}
            >
              <img src={item.image} alt={item.name} loading="lazy" className="h-36 w-full object-cover" />
              <div className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${selected ? 'border-[#D96C4D] bg-[#D96C4D] text-white' : 'border-gray-300'}`}>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="block font-semibold text-[#172B45]">{item.name}</span>
                  <span className="mt-1 block text-sm text-gray-600">{item.description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {custom.length > 0 && (
        <div className="space-y-2">
          {custom.map((entry, index) => (
            <div key={`${entry.name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
              <span className="font-medium text-[#172B45]">{entry.name}</span>
              <button
                type="button"
                onClick={() => onChange(selectedIds, custom.filter((_, itemIndex) => itemIndex !== index))}
                className="text-[#D96C4D]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4">
        <p className="text-sm font-semibold text-[#172B45]">{customLabel}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">
            Optional image
            <input
              type="file"
              accept="image/*"
              className="ml-2 block w-full text-xs"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || !onUploadImage) return;
                const url = await onUploadImage(file);
                if (url) setCustomImage(url);
              }}
            />
          </label>
          <button type="button" onClick={addCustom} className="rounded-lg bg-[#172B45] px-4 py-2 text-sm font-medium text-white">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

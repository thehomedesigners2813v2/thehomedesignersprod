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
  variant?: 'service' | 'material';
  onUploadImage?: (file: File) => Promise<string | null>;
}

export default function CatalogPicker({
  items,
  selectedIds,
  custom,
  categories,
  onChange,
  customLabel,
  variant = 'service',
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

      <div className={variant === 'material' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-3 sm:grid-cols-2'}>
        {visible.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`flex items-center gap-3 rounded-2xl border bg-white text-left ${variant === 'material' ? 'p-2.5' : 'p-3'} ${selected ? 'border-[#D96C4D] ring-2 ring-[#D96C4D]' : 'border-stone-200'}`}
            >
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className={variant === 'material' ? 'h-12 w-12 shrink-0 rounded-lg object-cover' : 'h-14 w-14 shrink-0 rounded-xl object-cover'}
              />
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold text-[#172B45] ${variant === 'material' ? 'text-sm' : ''}`}>{item.name}</span>
                {variant === 'service' && <span className="mt-1 block text-sm text-gray-600">{item.description}</span>}
              </span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#D96C4D] bg-[#D96C4D] text-white' : 'border-gray-300'}`}>
                {selected && <Check className="h-3.5 w-3.5" />}
              </span>
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

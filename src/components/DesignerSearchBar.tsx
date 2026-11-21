import { Search, MapPin, Palette } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { sublocationsFor } from '../lib/designerLocations';

type DesignerSearchBarProps = {
  locations: string[];
  specializations: string[];
  initialLocation?: string;
  initialSublocation?: string;
  initialSpecialization?: string;
  initialSearch?: string;
  onSearch: (values: { location: string; sublocation: string; specialization: string; search: string }) => void;
};

export default function DesignerSearchBar({
  locations,
  specializations,
  initialLocation = '',
  initialSublocation = '',
  initialSpecialization = '',
  initialSearch = '',
  onSearch,
}: DesignerSearchBarProps) {
  const [location, setLocation] = useState(initialLocation);
  const [sublocation, setSublocation] = useState(initialSublocation);
  const [specialization, setSpecialization] = useState(initialSpecialization);
  const [search, setSearch] = useState(initialSearch);
  const uniqueLocations = useMemo(() => [...new Set(locations)].sort(), [locations]);
  const uniqueSpecializations = useMemo(() => [...new Set(specializations)].sort(), [specializations]);
  const areas = sublocationsFor(location);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch({ location, sublocation, specialization, search });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/10 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.15fr_auto] md:items-center md:p-4"
      aria-label="Search interior designers"
    >
      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 px-4 py-3">
        <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="sr-only">City</span>
        <select
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
            setSublocation('');
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-secondary-800 outline-none"
        >
          <option value="">Any city</option>
          {uniqueLocations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 px-4 py-3">
        <MapPin className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="sr-only">Area within the city</span>
        <select
          value={sublocation}
          onChange={(event) => setSublocation(event.target.value)}
          disabled={!location}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-secondary-800 outline-none disabled:text-stone-400"
        >
          <option value="">{location ? 'Any area' : 'Select a city first'}</option>
          {areas.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 px-4 py-3">
        <Palette className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="sr-only">Design style</span>
        <select
          value={specialization}
          onChange={(event) => setSpecialization(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-secondary-800 outline-none"
        >
          <option value="">Any design style</option>
          {uniqueSpecializations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 px-4 py-3">
        <Search className="h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="sr-only">Designer name, style or location</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Designer name, style or area"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-secondary-800 outline-none placeholder:text-stone-400"
        />
      </label>

      <button type="submit" className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap px-6">
        <Search className="h-4 w-4" aria-hidden="true" />
        Search Designers
      </button>
    </form>
  );
}

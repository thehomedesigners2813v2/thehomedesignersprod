import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Tag } from 'lucide-react';
import DealCard from '../components/DealCard';
import { supabase } from '../lib/supabase';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { usePlanAccess } from '../hooks/usePlanAccess';

type Deal = {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  original_price: number;
  deal_price: number;
  deal_type: string;
  valid_until: string;
  image_url?: string | null;
  designers?: { id?: string; name: string; profile_image?: string | null } | null;
};

export default function Deals() {
  const { isDesigner } = useDesignerProfile();
  const { isProfessional, loading: planLoading } = usePlanAccess();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      setError(false);
      const { data, error: queryError } = await supabase
        .from('designer_deals')
        .select('id, title, description, discount_percentage, original_price, deal_price, deal_type, valid_until, image_url, designers(id, name, profile_image)')
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .gte('valid_until', new Date().toISOString())
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (queryError) {
        console.error('Could not load public deals', queryError);
        setError(true);
      } else {
        setDeals((data || []) as Deal[]);
      }
      setLoading(false);
    };
    void fetchDeals();
  }, []);

  const filteredDeals = useMemo(() => deals.filter((deal) => {
    const matchesType = !type || deal.deal_type === type;
    const term = search.trim().toLowerCase();
    return matchesType && (!term || deal.title.toLowerCase().includes(term) || deal.description.toLowerCase().includes(term) || deal.designers?.name.toLowerCase().includes(term));
  }), [deals, search, type]);
  const types = [...new Set(deals.map((deal) => deal.deal_type))].sort();

  if (isDesigner && !planLoading && !isProfessional) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold text-secondary-800">Offers & Deals</h1><p className="mt-2 text-stone-600">Offers and deals are available on the Professional plan.</p><Link to="/designer-subscription" className="btn-primary mt-5 inline-flex">View plans</Link></div></div>;
  }

  return <div className="min-h-screen bg-[#fcfaf7]">
    <section className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back home</Link>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Curated marketplace offers</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold leading-tight text-secondary-800 sm:text-5xl">Offers that make beautiful spaces easier to begin.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">Explore current promotions from interior designers on TheHomeDesigners marketplace.</p>
      </div>
    </section>
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <label className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3"><Search className="h-5 w-5 text-stone-400" aria-hidden="true" /><span className="sr-only">Search offers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search offers or designers" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400" /></label>
        <label className="sr-only" htmlFor="deal-type">Filter offers by category</label><select id="deal-type" value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-secondary-800 outline-none"><option value="">All offer categories</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      {loading ? <div className="grid gap-6 md:grid-cols-2"><div className="h-96 animate-pulse rounded-2xl bg-stone-200" /><div className="h-96 animate-pulse rounded-2xl bg-stone-200" /></div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center"><h2 className="text-xl font-semibold text-red-900">Offers are temporarily unavailable</h2><p className="mt-2 text-red-800">Please try again shortly.</p></div> : filteredDeals.length > 0 ? <div className="grid gap-6 md:grid-cols-2">{filteredDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)}</div> : <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-14 text-center"><Tag className="mx-auto h-12 w-12 text-primary-400" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold text-secondary-800">No current offers match your search</h2><p className="mt-2 text-stone-600">Check back soon for new promotions from our designer marketplace.</p></div>}
    </main>
  </div>;
}

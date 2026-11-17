import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Gift, MapPin, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { usePlanAccess } from '../hooks/usePlanAccess';

type Deal = { id: string; title: string; description: string; discount_percentage: number; original_price: number; deal_price: number; deal_type: string; services_included: string[]; terms_conditions: string | null; valid_from: string; valid_until: string; image_url?: string | null; designers?: { id: string; name: string; specialization?: string; location?: string; profile_image?: string | null } | null };

export default function DealDetail() {
  const { id } = useParams();
  const { isDesigner } = useDesignerProfile();
  const { isProfessional, loading: planLoading } = usePlanAccess();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDeal = async () => {
      const { data, error } = await supabase.from('designer_deals').select('id, title, description, discount_percentage, original_price, deal_price, deal_type, services_included, terms_conditions, valid_from, valid_until, image_url, designers(id, name, specialization, location, profile_image)').eq('id', id).eq('is_active', true).lte('valid_from', new Date().toISOString()).gte('valid_until', new Date().toISOString()).maybeSingle();
      if (error) console.error('Could not load public deal', error);
      setDeal((data as Deal | null) || null);
      setNotFound(!data);
      setLoading(false);
    };
    void fetchDeal();
  }, [id]);

  if (isDesigner && !planLoading && !isProfessional) return <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold text-secondary-800">Offers & Deals</h1><p className="mt-2 text-stone-600">Offers and deals are available on the Professional plan.</p><Link to="/designer-subscription" className="btn-primary mt-5 inline-flex">View plans</Link></div></div>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7]"><div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" /></div>;
  if (notFound || !deal) return <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-4"><div className="text-center"><Gift className="mx-auto h-14 w-14 text-primary-400" aria-hidden="true" /><h1 className="mt-5 text-2xl font-semibold text-secondary-800">This offer is no longer available</h1><p className="mt-2 text-stone-600">Browse the latest offers from our marketplace.</p><Link to="/deals" className="btn-primary mt-6 inline-flex">View Offers</Link></div></div>;

  return <div className="min-h-screen bg-[#fcfaf7] py-10 sm:py-14"><main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><Link to="/deals" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Offers</Link><div className="mt-8 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl"><div className="grid lg:grid-cols-[0.95fr_1.05fr]"><div className="relative min-h-72 bg-stone-100 lg:min-h-[560px]">{deal.image_url ? <img src={deal.image_url} alt={deal.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-50 to-stone-100 text-primary-600"><Gift className="h-20 w-20" aria-hidden="true" /></div>}<span className="absolute left-6 top-6 rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white">{deal.discount_percentage}% OFF</span></div><div className="p-7 sm:p-10"><span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-800">{deal.deal_type}</span><h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-secondary-800">{deal.title}</h1><p className="mt-5 text-lg leading-8 text-stone-600">{deal.description}</p><div className="mt-7 flex flex-wrap gap-4 text-sm text-stone-600"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary-600" aria-hidden="true" />Valid until {new Date(deal.valid_until).toLocaleDateString()}</span>{deal.designers?.location && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-primary-600" aria-hidden="true" />{deal.designers.location}</span>}</div><div className="mt-8 rounded-2xl bg-stone-50 p-5"><p className="text-sm text-stone-500">Offer price</p><p className="mt-1 text-3xl font-bold text-secondary-800">₹{Number(deal.deal_price).toLocaleString('en-IN')} <span className="text-base font-normal text-stone-400 line-through">₹{Number(deal.original_price).toLocaleString('en-IN')}</span></p></div>{deal.services_included?.length > 0 && <div className="mt-8"><h2 className="font-semibold text-secondary-800">Included in this offer</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">{deal.services_included.map((service) => <li key={service} className="flex items-start gap-2 text-sm text-stone-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{service}</li>)}</ul></div>}{deal.designers && <div className="mt-8 flex items-center justify-between gap-4 border-t border-stone-200 pt-6"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-stone-100">{deal.designers.profile_image ? <img src={deal.designers.profile_image} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" aria-hidden="true" />}</div><div><p className="font-semibold text-secondary-800">{deal.designers.name}</p><p className="text-sm text-stone-500">{deal.designers.specialization}</p></div></div><Link to={`/designers/${deal.designers.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">View profile <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>}{deal.terms_conditions && <div className="mt-8 border-t border-stone-200 pt-6"><h2 className="font-semibold text-secondary-800">Terms and conditions</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600">{deal.terms_conditions}</p></div>}</div></div></div></main></div>;
}

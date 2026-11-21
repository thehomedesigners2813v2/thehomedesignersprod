import { Link } from 'react-router-dom';
import { MapPin, Star, UserRound, CheckCircle2, ArrowUpRight } from 'lucide-react';
import type { Designer } from '../lib/supabase';
import { formatDesignerArea } from '../lib/designerLocations';

type FeaturedDesignerCardProps = {
  designer: Designer;
};

export default function FeaturedDesignerCard({ designer }: FeaturedDesignerCardProps) {
  const image = designer.portfolio_images?.[0] || designer.profile_image;

  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[1.35] overflow-hidden bg-stone-100">
        {image ? (
          <img src={image} alt={`${designer.name} interior design portfolio`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-stone-100 to-primary-50 text-primary-600">
            <UserRound className="h-14 w-14" aria-hidden="true" />
          </div>
        )}
        {designer.is_verified && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Verified
          </span>
        )}
        <Link to={`/designers/${designer.id}`} aria-label={`View ${designer.name}'s profile`} className="absolute bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-secondary-800 opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100">
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          {designer.profile_image ? <img src={designer.profile_image} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-primary-700"><UserRound className="h-5 w-5" aria-hidden="true" /></div>}
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-secondary-800">{designer.name}</h3>
            <p className="truncate text-sm text-primary-700">{designer.specialization || 'Interior design studio'}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-600">
          <span className="flex min-w-0 items-center gap-1.5 truncate"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{formatDesignerArea(designer.location, designer.sublocation) || 'Service area available'}</span>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-secondary-800"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{Number(designer.rating || 0).toFixed(1)} <span className="font-normal text-stone-500">({designer.total_reviews || 0})</span></span>
        </div>
        <Link to={`/designers/${designer.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 transition hover:text-primary-900">View Profile <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

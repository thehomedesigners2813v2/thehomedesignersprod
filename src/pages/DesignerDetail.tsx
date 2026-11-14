import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, BadgeCheck, ExternalLink, Mail, MapPin, Navigation, Phone, Star, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/AuthModal';
import { MATERIAL_CATALOG, SERVICE_CATALOG, resolveSelection } from '../lib/designerCatalog';

type PublicDesigner = {
  id: string;
  name: string;
  specialization: string;
  experience: number;
  location: string;
  bio?: string;
  website?: string;
  profile_image?: string;
  services: string[];
  materials_expertise: string[];
  awards: string[];
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  google_location_url?: string;
};

type Review = {
  id: string;
  rating: number;
  title: string;
  comment: string;
  would_recommend: boolean;
  created_at: string;
  customer_name: string;
  project_name: string;
};

type PortfolioProject = {
  id: string;
  project_name: string | null;
  property_type: string | null;
  location: string | null;
  completion_date: string | null;
  image_url: string | null;
  photos: string[];
};

type PaidContact = {
  phone: string | null;
  email: string | null;
  starting_price: string | null;
};

const publicColumns = 'id, name, specialization, experience, location, bio, website, profile_image, services, materials_expertise, awards, rating, total_reviews, is_verified, google_location_url';

export default function DesignerDetail() {
  const { id } = useParams();
  const { user, isDesigner } = useAuth();
  const navigate = useNavigate();
  const [designer, setDesigner] = useState<PublicDesigner | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [contact, setContact] = useState<PaidContact | null>(null);
  const [activeProject, setActiveProject] = useState<PortfolioProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: designerError } = await supabase
        .from('designers')
        .select(publicColumns)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (!active) return;
      if (designerError || !data) {
        setError(designerError?.message || 'Designer not found');
        setLoading(false);
        return;
      }
      setDesigner(data as PublicDesigner);

      const [{ data: reviewRows }, { data: portfolio }] = await Promise.all([
        supabase.from('reviews').select('id, rating, title, comment, would_recommend, created_at, project_id').eq('designer_id', id).order('created_at', { ascending: false }),
        supabase.rpc('get_designer_portfolio', { p_designer_id: id })
      ]);
      if (!active) return;
      const portfolioBody = portfolio as { total?: number; projects?: PortfolioProject[] } | null;
      setCompletedCount(portfolioBody?.total || 0);
      setProjects(portfolioBody?.projects || []);

      const mapped = await Promise.all((reviewRows || []).map(async (review) => {
        const { data: project } = await supabase.from('customers').select('name, project_name').eq('id', review.project_id).maybeSingle();
        return {
          id: review.id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          would_recommend: review.would_recommend,
          created_at: review.created_at,
          customer_name: project?.name || 'Homeowner',
          project_name: project?.project_name || 'Project'
        };
      }));
      if (active) {
        setReviews(mapped);
        setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!id || !user) {
      setContact(null);
      return;
    }
    let active = true;
    supabase.rpc('get_paid_designer_contact', { p_designer_id: id }).then(({ data }) => {
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      setContact(row && (row.phone || row.email || row.starting_price) ? row : null);
    });
    return () => { active = false; };
  }, [id, user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] text-[#172B45]">Loading designer profile...</div>;
  }

  if (error || !designer) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] text-[#172B45]">{error || 'Designer not found'}</div>;
  }

  const services = resolveSelection(designer.services, SERVICE_CATALOG);
  const materials = resolveSelection(designer.materials_expertise, MATERIAL_CATALOG);
  const materialGroups = [...services.selected, ...services.custom].length >= 0
    ? [...materials.selected, ...materials.custom].reduce<Record<string, typeof materials.selected>>((groups, item) => {
      const key = item.category || 'Other';
      groups[key] = [...(groups[key] || []), item];
      return groups;
    }, {})
    : {};
  const serviceCards = [...services.selected, ...services.custom];

  const requestQuote = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    navigate('/register-customer');
  };

  const openExternal = (value: string) => {
    const url = value.startsWith('http') ? value : `https://${value}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#172B45]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {designer.profile_image ? (
              <img src={designer.profile_image} alt="" className="h-28 w-28 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-stone-100 text-3xl font-semibold">{designer.name.slice(0, 1)}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold">{designer.name}</h1>
                {designer.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F7F4] px-2 py-1 text-xs font-medium"><BadgeCheck className="h-4 w-4 text-[#D96C4D]" /> Verified</span>}
              </div>
              <p className="mt-2 text-lg">{designer.specialization}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600"><MapPin className="h-4 w-4" /> {designer.location}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [designer.experience || 0, 'Years of experience'],
              [completedCount, 'Completed projects'],
              [designer.rating || 0, 'Customer rating'],
              [designer.total_reviews || reviews.length, 'Customer reviews']
            ].map(([value, label]) => (
              <div key={String(label)} className="rounded-2xl bg-[#F8F7F4] p-4">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-sm text-gray-600">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">About the designer</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-gray-700">{designer.bio || 'This designer has not added a description yet.'}</p>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Services offered</h2>
              {serviceCards.length === 0 ? <p className="mt-3 text-gray-600">No services listed yet.</p> : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {serviceCards.map((item) => (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-stone-200">
                      {item.image && <img src={item.image} alt={item.name} loading="lazy" className="h-36 w-full object-cover" />}
                      <div className="p-4">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Materials expertise</h2>
              {Object.keys(materialGroups).length === 0 ? <p className="mt-3 text-gray-600">No materials listed yet.</p> : Object.entries(materialGroups).map(([category, items]) => (
                <div key={category} className="mt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#D96C4D]">{category}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {items.map((item) => (
                      <article key={item.id} className="overflow-hidden rounded-2xl border border-stone-200">
                        {item.image && <img src={item.image} alt={item.name} loading="lazy" className="h-24 w-full object-cover" />}
                        <p className="p-3 text-sm font-medium">{item.name}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Recent completed projects</h2>
              {projects.length === 0 ? (
                <p className="mt-3 text-gray-600">Your completed projects will appear here once you complete your first project.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {projects.map((project) => (
                    <button key={project.id} type="button" onClick={() => setActiveProject(project)} className="overflow-hidden rounded-2xl border border-stone-200 text-left">
                      {(project.image_url || project.photos?.[0]) && <img src={project.image_url || project.photos[0]} alt="" loading="lazy" className="h-40 w-full object-cover" />}
                      <div className="p-4">
                        <h3 className="font-semibold">{project.project_name || 'Completed project'}</h3>
                        <p className="mt-1 text-sm text-gray-600">{[project.property_type, project.location].filter(Boolean).join(' · ')}</p>
                        {project.completion_date && <p className="mt-1 text-sm text-gray-500">{new Date(project.completion_date).toLocaleDateString('en-IN')}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Customer reviews</h2>
              {reviews.length === 0 ? <p className="mt-3 text-gray-600">No reviews yet.</p> : (
                <div className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <article key={review.id} className="rounded-2xl bg-[#F8F7F4] p-4">
                      <div className="flex items-center gap-1 text-[#D96C4D]">{Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
                      <h3 className="mt-2 font-semibold">{review.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-700">{review.comment}</p>
                      <p className="mt-2 text-sm text-gray-500">{review.customer_name} · {review.project_name}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {contact && (
              <div className="sticky top-24 rounded-xl bg-white p-6 shadow-lg">
                <div className="border-b border-gray-100 pb-5">
                  <h3 className="text-xl font-bold leading-tight">Contact Designer</h3>
                  <span className="mt-2.5 block h-[2px] w-10 rounded-full bg-[#D96C4D]" />
                </div>
                {contact.starting_price && (
                  <div className="border-b border-gray-100 py-5">
                    <p className="mb-1 text-sm font-medium text-gray-500">Starting From</p>
                    <p className="text-2xl font-bold leading-none text-[#D96C4D]">{contact.starting_price}</p>
                  </div>
                )}
                <div className="space-y-1 pt-4">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-gray-600 hover:bg-gray-50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50"><Phone className="h-4 w-4" /></span>
                      <span className="truncate text-sm font-medium">{contact.phone}</span>
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-gray-600 hover:bg-gray-50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50"><Mail className="h-4 w-4" /></span>
                      <span className="truncate text-sm font-medium">{contact.email}</span>
                    </a>
                  )}
                  {designer.website && (
                    <button type="button" onClick={() => openExternal(designer.website!)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-gray-600 hover:bg-gray-50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50"><ExternalLink className="h-4 w-4" /></span>
                      <span className="truncate text-sm font-medium">{designer.website}</span>
                    </button>
                  )}
                </div>
                {designer.google_location_url && (
                  <button type="button" onClick={() => openExternal(designer.google_location_url!.startsWith('http') ? designer.google_location_url! : `https://maps.google.com/?q=${encodeURIComponent(designer.google_location_url!)}`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white">
                    <Navigation className="h-4 w-4" /> Get Directions
                  </button>
                )}
                {user && !isDesigner && (
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <button type="button" onClick={requestQuote} className="btn-primary w-full">Get Quote</button>
                  </div>
                )}
              </div>
            )}

            {user && !isDesigner && !contact && (
              <button type="button" onClick={requestQuote} className="btn-primary w-full">Get Quote</button>
            )}

            {designer.awards?.length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xl font-bold">Awards & Recognition</h3>
                <div className="space-y-3">
                  {designer.awards.map((award) => (
                    <div key={award} className="flex items-start gap-3 text-sm text-gray-600"><Award className="mt-0.5 h-5 w-5 flex-shrink-0" />{award}</div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{activeProject.project_name || 'Completed project'}</h2>
                <p className="mt-1 text-sm text-gray-600">{[activeProject.property_type, activeProject.location].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setActiveProject(null)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[...(activeProject.image_url ? [activeProject.image_url] : []), ...(Array.isArray(activeProject.photos) ? activeProject.photos : [])].filter((photo) => photo).map((photo) => (
                <img key={photo} src={photo!} alt="" className="h-48 w-full rounded-2xl object-cover" />
              ))}
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} mode={authMode} onModeChange={setAuthMode} onAuthSuccess={() => setShowAuthModal(false)} />
    </div>
  );
}

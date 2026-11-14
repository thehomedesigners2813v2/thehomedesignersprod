import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, CheckCircle2, ClipboardList, Home as HomeIcon, MessageSquareQuote, Search, Star, Users, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase, type Designer } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import DealCard from '../components/DealCard';
import DesignerSearchBar from '../components/DesignerSearchBar';
import FeaturedDesignerCard from '../components/FeaturedDesignerCard';

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

type Review = { id: string; rating: number; title: string | null; comment: string | null; created_at: string };

type Stat = { label: string; value: string; icon: typeof Users; note: string };

const fallbackHeroImage = 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600';

const formatCount = (count: number) => count >= 1000 ? `${(count / 1000).toFixed(1)}k+` : count >= 100 ? `${Math.floor(count / 100) * 100}+` : `${count}+`;

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  useEffect(() => {
    const loadHomepage = async () => {
      setLoading(true);
      setError(false);
      const [designersResult, dealsResult, reviewsResult, designerCount, projectCount, reviewCount] = await Promise.all([
        supabase.from('designers').select('id, name, specialization, location, profile_image, portfolio_images, rating, total_reviews, total_projects, is_verified, is_active').eq('is_active', true).order('rating', { ascending: false }).order('total_reviews', { ascending: false }).limit(4),
        supabase.from('designer_deals').select('id, title, description, discount_percentage, original_price, deal_price, deal_type, valid_until, image_url, designers(id, name, profile_image)').eq('is_active', true).lte('valid_from', new Date().toISOString()).gte('valid_until', new Date().toISOString()).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(3),
        supabase.from('reviews').select('id, rating, title, comment, created_at').eq('verified_purchase', true).order('created_at', { ascending: false }).limit(3),
        supabase.from('designers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('assignment_status', 'completed'),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('verified_purchase', true),
      ]);

      if (designersResult.error || dealsResult.error) {
        console.error('Could not load marketplace homepage data', designersResult.error || dealsResult.error);
        setError(true);
      }
      setDesigners((designersResult.data || []) as Designer[]);
      setDeals((dealsResult.data || []) as Deal[]);
      setReviews((reviewsResult.data || []) as Review[]);
      setStats([
        { label: 'Verified designers', value: formatCount(designerCount.count || 0), icon: Users, note: 'Ready to bring your ideas to life' },
        { label: 'Projects completed', value: formatCount(projectCount.count || 0), icon: Award, note: 'Across homes and spaces' },
        { label: 'Homeowner reviews', value: formatCount(reviewCount.count || 0), icon: Star, note: 'From real marketplace experiences' },
      ]);
      setLoading(false);
    };
    void loadHomepage();
  }, []);

  const locations = designers.map((designer) => designer.location).filter(Boolean);
  const specializations = designers.map((designer) => designer.specialization).filter(Boolean);

  const handleSearch = (values: { location: string; specialization: string; search: string }) => {
    const params = new URLSearchParams();
    if (values.location) params.set('city', values.location);
    if (values.specialization) params.set('specialization', values.specialization);
    if (values.search) params.set('search', values.search);
    navigate(`/designers${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleProjectRegistration = () => {
    if (user) navigate('/register-customer');
    else {
      setAuthMode('signup');
      setShowAuthModal(true);
    }
  };

  return <div className="bg-[#fcfaf7] text-secondary-800">
    <section className="relative overflow-hidden bg-[#f7eee7] pb-12 sm:pb-14">
      <div className="absolute inset-0 bg-gradient-to-r from-[#f7eee7] via-[#f7eee7]/95 to-transparent lg:w-3/4" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary-700">One platform. Multiple interior designers.</p>
          <h1 className="mt-5 max-w-2xl font-serif text-4xl font-bold leading-[1.08] text-secondary-800 sm:text-5xl lg:text-6xl">Find the Right Interior Designer for Your Dream Home</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-stone-700">Compare portfolios, explore offers and connect with interior designers—all in one place.</p>
          <div className="mt-8 max-w-md">
            <button onClick={handleProjectRegistration} className="group flex min-h-20 w-full items-center justify-between rounded-xl bg-primary-600 px-5 py-4 text-left text-white shadow-lg shadow-primary-600/20 transition hover:-translate-y-0.5 hover:bg-primary-700"><span><span className="block font-semibold">Register Your Project</span><span className="mt-1 block text-sm text-white/80">Get quotes from verified designers</span></span><ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] shadow-2xl lg:min-h-[500px]">
          <img src={fallbackHeroImage} alt="Warm modern living room interior" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/50 via-transparent to-white/10" />
          <p className="absolute bottom-6 right-6 max-w-48 text-right font-serif text-2xl italic leading-tight text-white">Beautiful homes. Happier lives.</p>
        </div>
      </div>
      <div className="relative z-20 mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8"><DesignerSearchBar locations={locations} specializations={specializations} onSearch={handleSearch} /></div>
    </section>

    <main>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Meet the marketplace</p><h2 className="mt-2 font-serif text-3xl font-bold text-secondary-800 sm:text-4xl">Featured Interior Designers</h2><p className="mt-3 text-stone-600">Explore top-rated professionals with verified portfolios and client feedback.</p></div><Link to="/designers" className="hidden items-center gap-2 text-sm font-semibold text-primary-700 sm:inline-flex">View All Designers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        {loading ? <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-96 animate-pulse rounded-2xl bg-stone-200" />)}</div> : error ? <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-900">Designers are temporarily unavailable. Please try again shortly.</div> : designers.length > 0 ? <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{designers.map((designer) => <FeaturedDesignerCard key={designer.id} designer={designer} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-600">No verified designers are available yet. Check back soon.</div>}
        <Link to="/designers" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 sm:hidden">View All Designers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>

      <section className="bg-white py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-end justify-between gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Save on your next project</p><h2 className="mt-2 font-serif text-3xl font-bold text-secondary-800 sm:text-4xl">Latest Offers & Deals</h2><p className="mt-3 text-stone-600">Current promotions published by designers in our marketplace.</p></div><Link to="/deals" className="hidden items-center gap-2 text-sm font-semibold text-primary-700 sm:inline-flex">View All Offers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>{deals.length > 0 ? <div className="mt-8 grid gap-6 lg:grid-cols-3">{deals.map((deal) => <DealCard key={deal.id} deal={deal} compact />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-[#fcfaf7] p-12 text-center"><p className="font-semibold text-secondary-800">New designer offers are coming soon.</p><p className="mt-2 text-sm text-stone-600">Published promotions will appear here as soon as they are available.</p></div>}<Link to="/deals" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 sm:hidden">View All Offers <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div></section>

      <section className="border-y border-stone-200 bg-[#f7eee7] py-12"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">{stats.map(({ label, value, icon: Icon, note }) => <div key={label} className="flex items-center gap-4 border-stone-300 md:border-r md:last:border-r-0 md:px-6 first:md:pl-0"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm"><Icon className="h-7 w-7" aria-hidden="true" /></div><div><p className="text-3xl font-bold text-secondary-800">{value}</p><p className="font-semibold text-secondary-800">{label}</p><p className="mt-1 text-sm text-stone-600">{note}</p></div></div>)}</div></section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">A simpler way to begin</p><h2 className="mt-2 font-serif text-3xl font-bold text-secondary-800 sm:text-4xl">How It Works</h2><p className="mt-3 text-stone-600">From your first idea to the right designer, everything stays in one place.</p></div><div className="mt-10 grid gap-5 md:grid-cols-4">{[{ number: '01', icon: ClipboardList, title: 'Register Your Project', text: 'Tell us about your home, budget and requirements.' }, { number: '02', icon: MessageSquareQuote, title: 'Receive Quotations', text: 'Request and receive proposals from designers.' }, { number: '03', icon: Search, title: 'Compare Designers', text: 'Review portfolios, services, offers and ratings.' }, { number: '04', icon: HomeIcon, title: 'Choose Your Designer', text: 'Connect with the professional who fits your vision.' }].map(({ number, icon: Icon, title, text }) => <div key={number} className="relative rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><span className="text-sm font-bold text-primary-600">{number}</span><div className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-6 w-6" aria-hidden="true" /></div><h3 className="mt-5 font-semibold text-secondary-800">{title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{text}</p></div>)}</div></section>

      {reviews.length > 0 && <section className="bg-white py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-end justify-between gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Real experiences</p><h2 className="mt-2 font-serif text-3xl font-bold text-secondary-800 sm:text-4xl">What Homeowners Say</h2></div><div className="hidden items-center gap-2 text-sm font-semibold text-amber-600 sm:flex"><Star className="h-5 w-5 fill-current" aria-hidden="true" /> Verified marketplace reviews</div></div><div className="mt-8 grid gap-6 md:grid-cols-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-stone-200 bg-[#fcfaf7] p-6"><div className="flex gap-1 text-amber-500">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-current' : ''}`} aria-hidden="true" />)}</div><p className="mt-5 text-sm leading-7 text-stone-700">“{review.comment || review.title || 'A positive experience with a marketplace designer.'}”</p><div className="mt-6 flex items-center gap-3 border-t border-stone-200 pt-4"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><UserRound className="h-4 w-4" aria-hidden="true" /></div><div><p className="text-sm font-semibold text-secondary-800">Verified homeowner</p><p className="text-xs text-stone-500">{new Date(review.created_at).toLocaleDateString()}</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="Verified review" /></div></article>)}</div></div></section>}

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-3xl bg-secondary-800 px-6 py-10 text-white sm:px-12"><div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-300">For interior designers</p><h2 className="mt-3 max-w-2xl font-serif text-3xl font-bold sm:text-4xl">Grow your design business with the right homeowners.</h2><p className="mt-3 max-w-2xl text-white/75">Showcase your portfolio, share your offers and connect with homeowners who are ready to create.</p></div><Link to="/register-designer" className="group inline-flex shrink-0 items-center gap-3 rounded-xl bg-primary-600 px-6 py-4 font-semibold text-white transition hover:bg-primary-500">Join as a Designer <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" /></Link></div><div className="absolute -right-8 -top-16 h-64 w-64 rounded-full border border-white/10" /><div className="absolute -bottom-24 right-24 h-64 w-64 rounded-full border border-white/10" /></div></section>
    </main>
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} mode={authMode} onModeChange={setAuthMode} onAuthSuccess={() => navigate('/register-customer')} userType="customer" />
  </div>;
}

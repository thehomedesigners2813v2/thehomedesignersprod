import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Users, Ruler, Wallet, Building2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/AuthModal';
import CommunityJoinModal from '../components/community/CommunityJoinModal';
import CommunityActivityPanel from '../components/community/CommunityActivityPanel';
import { fetchCommunityListings } from '../lib/communityApi';
import type { CommunityListing } from '../lib/communityApi';

const formatCurrency = (value: number | null) =>
  value == null
    ? 'Value on request'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const statusBadge = (status: string | null) => {
  switch (status) {
    case 'owner':
      return { label: 'Your project', className: 'bg-secondary-100 text-secondary-800' };
    case 'pending':
      return { label: 'Request pending', className: 'bg-amber-50 text-amber-800' };
    case 'approved':
      return { label: 'Approved - review quote', className: 'bg-sky-50 text-sky-800' };
    case 'accepted':
      return { label: 'You have joined', className: 'bg-green-50 text-green-800' };
    default:
      return null;
  }
};

const Projects = () => {
  const { user, isDesigner } = useAuth();
  const [listings, setListings] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openSpotsOnly, setOpenSpotsOnly] = useState(false);
  const [joinTarget, setJoinTarget] = useState<CommunityListing | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchCommunityListings()
      .then((rows) => active && setListings(rows))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey, user?.id]);

  const visibleListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return listings.filter((listing) => {
      const open = listing.max_participants - listing.participant_count;
      if (openSpotsOnly && open <= 0) return false;
      if (!query) return true;
      return [listing.project_name, listing.township, listing.designer_name, listing.property_type]
        .some((field) => field?.toLowerCase().includes(query));
    });
  }, [listings, searchQuery, openSpotsOnly]);

  const handleJoinClick = (listing: CommunityListing) => {
    if (!user) {
      setAuthMode('login');
      setShowAuth(true);
      return;
    }
    setJoinTarget(listing);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">Community Projects</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-secondary-900 sm:text-5xl">
            Join an ongoing project in your township
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Designers are already delivering these projects. Join one with your own requirements, and receive your own quotation with a 3% community discount.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by project, township, or designer"
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400">
              <input
                type="checkbox"
                checked={openSpotsOnly}
                onChange={(e) => setOpenSpotsOnly(e.target.checked)}
                className="h-4 w-4 rounded text-primary-600"
              />
              Open spots only
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <h2 className="mt-4 text-lg font-semibold text-secondary-900">We could not load community projects</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
            >
              Try again
            </button>
          </div>
        ) : visibleListings.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-4 text-lg font-semibold text-secondary-900">
              {listings.length === 0 ? 'No community projects are open right now' : 'No projects match your search'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {listings.length === 0
                ? 'Projects appear here once a designer opens an ongoing project to new homeowners.'
                : 'Try a different search term or clear the open spots filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleListings.map((listing) => {
              const spotsOpen = Math.max(listing.max_participants - listing.participant_count, 0);
              const fillPercent = Math.min((listing.participant_count / listing.max_participants) * 100, 100);
              const badge = statusBadge(listing.my_status);
              const canJoin = Boolean(user) && !isDesigner && listing.my_status == null && spotsOpen > 0;

              return (
                <article
                  key={listing.community_project_id}
                  className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-secondary-900">
                        {listing.project_name || 'Community project'}
                      </h2>
                      <Link
                        to={`/designers/${listing.designer_id}`}
                        className="mt-1 inline-block text-sm font-medium text-primary-700 hover:text-primary-800"
                      >
                        {listing.designer_name || 'Designer'}
                      </Link>
                    </div>
                    {badge && (
                      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{listing.township || 'Township not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{listing.property_type || 'Property'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Ruler className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{listing.project_area || 'Area not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Wallet className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{formatCurrency(listing.project_value)}</span>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-700">
                        <Users className="h-4 w-4 text-gray-400" />
                        {listing.participant_count} of {listing.max_participants} homeowners
                      </span>
                      <span className={spotsOpen > 0 ? 'font-medium text-green-700' : 'font-medium text-gray-500'}>
                        {spotsOpen > 0 ? `${spotsOpen} spot${spotsOpen > 1 ? 's' : ''} open` : 'Full'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all duration-500"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>

                  {canJoin && (
                    <div className="mt-auto pt-6">
                      <button
                        type="button"
                        onClick={() => handleJoinClick(listing)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-700"
                      >
                        Join project
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {user && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="border-t border-stone-200 pt-12">
            <h2 className="text-2xl font-bold text-secondary-900">My community activity</h2>
            <p className="mt-2 text-sm text-gray-600">Track your join requests and referral rewards here.</p>
            <div className="mt-8">
              <CommunityActivityPanel />
            </div>
          </div>
        </section>
      )}

      {joinTarget && user && (
        <CommunityJoinModal
          listing={joinTarget}
          userId={user.id}
          onClose={() => setJoinTarget(null)}
          onRequested={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={() => setShowAuth(false)}
        userType="customer"
      />
    </div>
  );
};

export default Projects;

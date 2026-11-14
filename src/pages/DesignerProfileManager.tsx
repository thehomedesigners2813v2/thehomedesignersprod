import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import CatalogPicker from '../components/designer/CatalogPicker';
import {
  MATERIAL_CATALOG,
  MATERIAL_CATEGORIES,
  SERVICE_CATALOG,
  decodeSelection,
  encodeSelection
} from '../lib/designerCatalog';

type Section = 'overview' | 'basic' | 'about' | 'services' | 'materials' | 'portfolio' | 'reviews' | 'preview';

type PortfolioProject = {
  id: string;
  project_name: string | null;
  property_type: string | null;
  location: string | null;
  updated_at: string;
  work_end_date: string | null;
  layout_image_url: string | null;
};

const sections: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Profile Overview' },
  { id: 'basic', label: 'Basic Information' },
  { id: 'about', label: 'About & Experience' },
  { id: 'services', label: 'Services Offered' },
  { id: 'materials', label: 'Materials Expertise' },
  { id: 'portfolio', label: 'Portfolio / Projects' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'preview', label: 'Preview Profile' }
];

export default function DesignerProfileManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { designer, loading, updateDesignerProfile } = useDesignerProfile();
  const [section, setSection] = useState<Section>('overview');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [basic, setBasic] = useState({ name: '', specialization: '', location: '', profile_image: '' });
  const [about, setAbout] = useState({ experience: '', bio: '' });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<{ name: string; imageUrl?: string }[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [customMaterials, setCustomMaterials] = useState<{ name: string; imageUrl?: string }[]>([]);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!designer) return;
    setBasic({
      name: designer.name || '',
      specialization: designer.specialization || '',
      location: designer.location || '',
      profile_image: designer.profile_image || ''
    });
    setAbout({ experience: String(designer.experience ?? ''), bio: designer.bio || '' });
    const services = decodeSelection(designer.services, SERVICE_CATALOG);
    const materials = decodeSelection(designer.materials_expertise, MATERIAL_CATALOG);
    setServiceIds(services.ids);
    setCustomServices(services.custom);
    setMaterialIds(materials.ids);
    setCustomMaterials(materials.custom);
  }, [designer]);

  useEffect(() => {
    if (!designer) return;
    supabase
      .from('customers')
      .select('id, project_name, property_type, location, updated_at, work_end_date, layout_image_url')
      .eq('assigned_designer_id', designer.id)
      .eq('assignment_status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setProjects(data || []));
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('designer_id', designer.id)
      .then(({ count }) => setReviewCount(count || 0));
  }, [designer]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(basic.name && basic.specialization && basic.location && basic.profile_image),
      Boolean(about.bio.trim() && Number(about.experience) >= 0 && about.experience !== ''),
      serviceIds.length + customServices.length > 0,
      materialIds.length + customMaterials.length > 0,
      projects.length > 0,
      reviewCount > 0 || Number(designer?.total_reviews || 0) > 0
    ];
    return { checks, percent: Math.round((checks.filter(Boolean).length / checks.length) * 100) };
  }, [basic, about, serviceIds, customServices, materialIds, customMaterials, projects.length, reviewCount, designer?.total_reviews]);

  const save = async (updates: Record<string, unknown>, success: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await updateDesignerProfile(updates as never);
    setSaving(false);
    if (result.error) setError(result.error);
    else setMessage(success);
  };

  const uploadCatalogImage = async (file: File) => {
    if (!user) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
    const path = `${user.id}/catalog/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('designer-profiles').upload(path, file, { cacheControl: '3600' });
    if (uploadError) {
      setError(uploadError.message);
      return null;
    }
    return supabase.storage.from('designer-profiles').getPublicUrl(path).data.publicUrl;
  };

  const uploadProfile = async (file: File) => {
    if (!user) return;
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/profile.${extension}`;
    const { error: uploadError } = await supabase.storage.from('designer-profiles').upload(path, file, { upsert: true, cacheControl: '3600' });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from('designer-profiles').getPublicUrl(path);
    setBasic((current) => ({ ...current, profile_image: `${data.publicUrl}?v=${Date.now()}` }));
  };

  if (loading || !designer) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4]"><Loader2 className="h-6 w-6 animate-spin text-[#172B45]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#172B45]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
        <nav className="h-fit rounded-2xl bg-white p-3 shadow-sm">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSection(item.id); setMessage(null); setError(null); }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${section === item.id ? 'bg-[#172B45] text-white' : 'hover:bg-stone-100'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="rounded-2xl bg-white p-6 shadow-sm">
          {message && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {section === 'overview' && (
            <div>
              <h1 className="text-2xl font-semibold">Profile completion {completion.percent}%</h1>
              <div className="mt-3 h-2 rounded-full bg-stone-200"><div className="h-full rounded-full bg-[#D96C4D]" style={{ width: `${completion.percent}%` }} /></div>
              <ul className="mt-6 space-y-2 text-sm">
                {['Basic Information', 'About & Experience', 'Services Offered', 'Materials Expertise', 'Portfolio / Completed Projects', 'Reviews'].map((label, index) => (
                  <li key={label}>{completion.checks[index] ? 'Done' : 'Open'} — {label}</li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-gray-600">Completed projects and reviews are counted from your work. They are not required to save the profile.</p>
            </div>
          )}

          {section === 'basic' && (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save(basic, 'Basic information saved.'); }}>
              <h1 className="text-2xl font-semibold">Basic Information</h1>
              <input className="w-full rounded-lg border px-3 py-2" value={basic.name} onChange={(event) => setBasic({ ...basic, name: event.target.value })} placeholder="Business or designer name" required />
              <input className="w-full rounded-lg border px-3 py-2" value={basic.specialization} onChange={(event) => setBasic({ ...basic, specialization: event.target.value })} placeholder="Design style or specialization" required />
              <input className="w-full rounded-lg border px-3 py-2" value={basic.location} onChange={(event) => setBasic({ ...basic, location: event.target.value })} placeholder="City and location" required />
              <label className="block text-sm">Profile photograph or logo
                <input type="file" accept="image/*" className="mt-2 block" onChange={(event) => event.target.files?.[0] && uploadProfile(event.target.files[0])} />
              </label>
              {basic.profile_image && <img src={basic.profile_image} alt="" className="h-24 w-24 rounded-full object-cover" />}
              <button disabled={saving} className="rounded-lg bg-[#D96C4D] px-4 py-2 text-white">{saving ? 'Saving...' : 'Save'}</button>
            </form>
          )}

          {section === 'about' && (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save({ experience: Number(about.experience) || 0, bio: about.bio }, 'About and experience saved.'); }}>
              <h1 className="text-2xl font-semibold">About & Experience</h1>
              <input type="number" min="0" className="w-full rounded-lg border px-3 py-2" value={about.experience} onChange={(event) => setAbout({ ...about, experience: event.target.value })} placeholder="Years of experience" />
              <textarea className="min-h-40 w-full rounded-lg border px-3 py-2" value={about.bio} onChange={(event) => setAbout({ ...about, bio: event.target.value })} placeholder="About the designer or business" />
              <button disabled={saving} className="rounded-lg bg-[#D96C4D] px-4 py-2 text-white">{saving ? 'Saving...' : 'Save'}</button>
            </form>
          )}

          {section === 'services' && (
            <div>
              <h1 className="mb-4 text-2xl font-semibold">Services Offered</h1>
              <CatalogPicker
                items={SERVICE_CATALOG}
                selectedIds={serviceIds}
                custom={customServices}
                customLabel="Add custom service"
                onUploadImage={uploadCatalogImage}
                onChange={(ids, custom) => { setServiceIds(ids); setCustomServices(custom); }}
              />
              <button disabled={saving} onClick={() => save({ services: encodeSelection(serviceIds, customServices) }, 'Services saved.')} className="mt-4 rounded-lg bg-[#D96C4D] px-4 py-2 text-white">{saving ? 'Saving...' : 'Save services'}</button>
            </div>
          )}

          {section === 'materials' && (
            <div>
              <h1 className="mb-4 text-2xl font-semibold">Materials Expertise</h1>
              <CatalogPicker
                items={MATERIAL_CATALOG}
                categories={MATERIAL_CATEGORIES}
                selectedIds={materialIds}
                custom={customMaterials}
                customLabel="Add custom material"
                onUploadImage={uploadCatalogImage}
                onChange={(ids, custom) => { setMaterialIds(ids); setCustomMaterials(custom); }}
              />
              <button disabled={saving} onClick={() => save({ materials_expertise: encodeSelection(materialIds, customMaterials) }, 'Materials saved.')} className="mt-4 rounded-lg bg-[#D96C4D] px-4 py-2 text-white">{saving ? 'Saving...' : 'Save materials'}</button>
            </div>
          )}

          {section === 'portfolio' && (
            <div>
              <h1 className="text-2xl font-semibold">Portfolio / Projects</h1>
              {projects.length === 0 ? (
                <p className="mt-4 text-gray-600">Your completed projects will appear here once you complete your first project.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {projects.map((project) => (
                    <article key={project.id} className="overflow-hidden rounded-2xl border">
                      {project.layout_image_url && <img src={project.layout_image_url} alt="" className="h-36 w-full object-cover" />}
                      <div className="p-4 text-sm">
                        <p className="font-semibold">{project.project_name}</p>
                        <p>{project.property_type} · {project.location}</p>
                        <p>{new Date(project.work_end_date || project.updated_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'reviews' && (
            <div>
              <h1 className="text-2xl font-semibold">Reviews</h1>
              <p className="mt-3 flex items-center gap-2 text-sm"><BadgeCheck className="h-4 w-4" /> {designer.rating || 0} from {reviewCount || designer.total_reviews || 0} reviews</p>
              <p className="mt-2 text-sm text-gray-600">Reviews are added by homeowners after a project. You do not need reviews to save your profile.</p>
            </div>
          )}

          {section === 'preview' && (
            <div>
              <h1 className="text-2xl font-semibold">Preview Profile</h1>
              <p className="mt-2 text-sm text-gray-600">Open the public page to see what homeowners see. Your contact card is visible to you because this is your profile.</p>
              <Link to={`/designers/${designer.id}`} className="mt-4 inline-block rounded-lg bg-[#172B45] px-4 py-2 text-white">Open public profile</Link>
              <button type="button" onClick={() => navigate(`/designers/${designer.id}`)} className="ml-3 text-sm text-[#D96C4D]">Preview now</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isValidUrl = (url: string) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const hasValidCredentials =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_supabase_project_url_here' &&
  supabaseAnonKey !== 'your_supabase_anon_key_here' &&
  isValidUrl(supabaseUrl);

export const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: {
          getItem: (key: string) => {
            // Custom storage getter to prevent auto-login issues
            if (typeof window !== 'undefined') {
              return window.localStorage.getItem(key);
            }
            return null;
          },
          setItem: (key: string, value: string) => {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(key, value);
            }
          },
          removeItem: (key: string) => {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(key);
            }
          }
        }
      }
    })
  : createMockClient();

function createMockClient(): any {
  console.warn('Supabase credentials not configured. Please click "Connect to Supabase" to set up your project.');

  const notConfiguredError = { message: 'Supabase not configured' };
  const connectError = { message: 'Please connect to Supabase to enable database operations. Click "Connect to Supabase" in the top right.' };

  // A chainable query builder that supports any combination of filter/order/limit
  // methods and ultimately resolves to empty data with a "not configured" error.
  const createChainableQuery = (): any => {
    const query: any = {
      // Terminal methods that return a Promise
      then: (resolve: any, reject: any) => Promise.resolve({ data: null, error: notConfiguredError }).then(resolve, reject),
      catch: (reject: any) => Promise.resolve({ data: null, error: notConfiguredError }).catch(reject),
      finally: (cb: any) => Promise.resolve({ data: null, error: notConfiguredError }).finally(cb),
      single: () => Promise.resolve({ data: null, error: notConfiguredError }),
      maybeSingle: () => Promise.resolve({ data: null, error: notConfiguredError }),
      // Chainable filter/order methods that return self
      eq: () => query,
      neq: () => query,
      gt: () => query,
      gte: () => query,
      lt: () => query,
      lte: () => query,
      like: () => query,
      ilike: () => query,
      in: () => query,
      not: () => query,
      or: () => query,
      filter: () => query,
      order: () => query,
      range: () => query,
      limit: () => query,
      offset: () => query,
      // Select after insert/update/upsert
      select: () => query,
    };
    return query;
  };

  return {
    auth: {
      signUp: () => Promise.resolve({
        data: { user: null, session: null },
        error: { message: 'Please connect to Supabase to enable authentication. Click "Connect to Supabase" in the top right.' }
      }),
      signInWithPassword: () => Promise.resolve({
        data: { user: null, session: null },
        error: { message: 'Please connect to Supabase to enable authentication. Click "Connect to Supabase" in the top right.' }
      }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: (_table: string) => ({
      select: () => createChainableQuery(),
      insert: () => createChainableQuery(),
      update: () => createChainableQuery(),
      upsert: () => createChainableQuery(),
      delete: () => createChainableQuery(),
    }),
    channel: (_name: string) => ({
      on: () => ({ subscribe: () => ({}) }),
      unsubscribe: () => {},
      subscribe: () => ({})
    }),
    removeChannel: () => {},
    removeAllChannels: () => {}
  };
}

export type Designer = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string;
  experience: number;
  location: string;
  bio?: string;
  website?: string;
  starting_price?: string;
  profile_image?: string;
  portfolio_images: string[];
  services: string[];
  materials_expertise: string[];
  awards: string[];
  rating: number;
  total_reviews: number;
  total_projects: number;
  is_verified: boolean;
  is_active: boolean;
  business_type?: 'google_location' | 'virtual';
  google_location_url?: string;
  intro_youtube_id?: string | null;
  intro_video_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  project_name: string;
  property_type: string;
  project_area?: string;
  budget_range: string;
  timeline: string;
  requirements: string;
  preferred_designer?: string;
  layout_image_url?: string;
  inspiration_links: string[];
  room_types: string[];
  special_requirements?: string;
  status: string;
  assignment_status?: string;
  assigned_designer_id?: string;
  work_begin_date?: string;
  work_end_date?: string;
  per_day_discount?: number;
  created_at: string;
  updated_at: string;
};

export type ProjectShare = {
  id: string;
  project_id: string;
  customer_id: string;
  designer_email: string;
  designer_phone?: string;
  message?: string;
  status: string;
  created_at: string;
  updated_at: string;
};
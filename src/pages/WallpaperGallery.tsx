import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Palette, X, Ruler } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/AuthModal';
import { supabase } from '../lib/supabase';

interface Wallpaper {
  id: string;
  image_url: string;
  second_image_url: string | null;
  category: string;
  product_line?: string | null;
}

type PaperId = 'normal' | 'luxury' | 'golden_foil';


const STYLE_NOTES: Record<string, string> = {
  Geometric: 'Repeating lines and shapes for a feature wall in a living room or study.',
  Nature: 'Leaves, stone and landscape tones that soften a bedroom or lounge.',
  Luxury: 'A richer pattern meant for a formal wall, headboard wall or reception.',
  Modern: 'Clean shapes and a calm palette for contemporary apartments.',
  Floral: 'Botanical detail for a bedroom, dining wall or dressing area.',
  Industrial: 'Concrete, brick and metal textures for an urban feature wall.',
  Texture: 'A close surface pattern that adds depth without a busy motif.',
  Abstract: 'Painterly colour and movement for one accent wall.',
  Wood: 'Timber grain for a warm panel behind a sofa, bed or console.',
  Zen: 'Quiet pattern and open space for a calm bedroom or prayer corner.',
  Space: 'A wide scenic design best used on one uninterrupted wall.',
  Urban: 'City lines and graphic contrast for a study or media wall.',
};

const PAPERS: { id: PaperId; name: string; rate: number; detail: string }[] = [
  { id: 'normal', name: 'Standard paper', rate: 160, detail: 'Smooth printable paper for most rooms, supplied and installed.' },
  { id: 'luxury', name: 'Luxury paper', rate: 190, detail: 'Thicker textured paper with a softer finish and stronger colour.' },
  { id: 'golden_foil', name: 'Premium paper', rate: 220, detail: 'Golden or silver foil highlights for a formal feature wall.' },
];

const STEPS = [
  { title: 'Choose a design', text: 'Open any image to see the design, the on-wall view and the paper choices.' },
  { title: 'Measure the wall', text: 'Width times height, in feet. A 10 ft by 8 ft wall is 80 sq ft.' },
  { title: 'Choose the paper', text: 'Standard, Luxury or Premium. The rate is per square foot and includes installation.' },
  { title: 'Place the order', text: 'Sign in, enter the wall size, and pay a 10% advance. A preview is sent before installation.' },
];

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f3f4f6"/><text x="150" y="200" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9ca3af">Image unavailable</text></svg>'
);

const WallpaperCard: React.FC<{ wallpaper: Wallpaper; onOpen: (wallpaper: Wallpaper) => void }> = ({ wallpaper, onOpen }) => {
  const images = [wallpaper.image_url, wallpaper.second_image_url].filter((url): url is string => !!url && url.trim() !== '');
  const hasMultiple = images.length > 1;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearTimeout(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!hasMultiple || currentIndex !== 0 || countdownTimer.current) return;
    countdownTimer.current = setTimeout(() => {
      countdownTimer.current = null;
      setCurrentIndex(1);
    }, 2000);
  }, [hasMultiple, currentIndex]);

  useEffect(() => () => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
  }, []);

  const visibleImages = images.map((url, idx) => (imgErrors.has(idx) ? PLACEHOLDER_SVG : url));
  const goToSlide = useCallback((index: number) => {
    if (!hasMultiple) return;
    clearCountdown();
    setCurrentIndex((index + images.length) % images.length);
  }, [hasMultiple, images.length, clearCountdown]);

  return (
    <button
      type="button"
      onClick={() => onOpen(wallpaper)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={clearCountdown}
      className="group overflow-hidden rounded-2xl bg-white text-left shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
    >
      <div
        className="relative aspect-[3/4] overflow-hidden"
        onTouchStart={hasMultiple ? (event) => { touchStartX.current = event.touches[0].clientX; } : undefined}
        onTouchEnd={hasMultiple ? (event) => {
          if (touchStartX.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 40) goToSlide(currentIndex + (delta > 0 ? -1 : 1));
          touchStartX.current = null;
        } : undefined}
      >
        <img
          src={visibleImages[currentIndex] || PLACEHOLDER_SVG}
          alt={`${wallpaper.category} wallpaper`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgErrors((prev) => new Set(prev).add(currentIndex))}
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800">{wallpaper.category}</span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-4 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">View design</span>
      </div>
    </button>
  );
};

const WallpaperDetail: React.FC<{
  wallpaper: Wallpaper;
  onClose: () => void;
  onOrder: (wallpaper: Wallpaper, paper: PaperId) => void;
}> = ({ wallpaper, onClose, onOrder }) => {
  const images = [wallpaper.image_url, wallpaper.second_image_url].filter((url): url is string => !!url && url.trim() !== '');
  const [paper, setPaper] = useState<PaperId>('normal');
  const selected = PAPERS.find((item) => item.id === paper) || PAPERS[0];
  const note = STYLE_NOTES[wallpaper.category] || 'A feature-wall design. Compare the flat artwork with the on-wall view, then choose the paper.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="mx-auto my-6 max-w-5xl rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">{wallpaper.category}</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{wallpaper.category} wallpaper</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label="Close design"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-8 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <img src={images[0]} alt={`${wallpaper.category} wallpaper design`} className="max-h-80 w-full rounded-2xl object-contain" />
            {images[1] && (
              <img src={images[1]} alt="Wallpaper on a wall" className="mt-3 max-h-80 w-full rounded-2xl object-contain" />
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-bold text-primary-700">0{index + 1}</p>
                  <h3 className="mt-1 font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-700">{note}</p>
            <h3 className="mt-6 text-lg font-bold text-gray-900">Paper</h3>
            <div className="mt-3 space-y-2">
              {PAPERS.map((item) => (
                <label key={item.id} className={`block cursor-pointer rounded-2xl border p-4 ${paper === item.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                  <input type="radio" name="paper" className="sr-only" checked={paper === item.id} onChange={() => setPaper(item.id)} />
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-gray-900">{item.name}</span>
                    <span className="text-sm font-bold text-primary-700">₹{item.rate}/sq ft</span>
                  </span>
                  <span className="mt-1 block text-sm text-gray-600">{item.detail}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-gray-900"><Ruler className="h-4 w-4" /> How to measure</div>
              <p className="mt-2 text-sm text-gray-600">Measure the wall width and the wall height in feet. Multiply them. A wall 12 ft wide and 9 ft high is 108 sq ft. At {selected.name.toLowerCase()}, that is about ₹{(108 * selected.rate).toLocaleString('en-IN')} before the advance.</p>
              <p className="mt-2 text-sm text-gray-600">Installation is included. A 10% advance confirms the order, then you approve a preview before the team installs it.</p>
            </div>
            <button type="button" onClick={() => onOrder(wallpaper, paper)} className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white hover:bg-primary-700">Place order</button>
            <p className="mt-2 text-center text-xs text-gray-500">Sign in only when you are ready to order.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function WallpaperGallery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [productLine, setProductLine] = useState<'customized' | 'rolls'>('customized');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingWallpaper, setPendingWallpaper] = useState<Wallpaper | null>(null);
  const [pendingPaper, setPendingPaper] = useState<PaperId>('normal');
  const [pendingCustomOrder, setPendingCustomOrder] = useState(false);
  const [openWallpaper, setOpenWallpaper] = useState<Wallpaper | null>(null);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('wallpapers_3d').select('*').eq('is_active', true).order('created_at', { ascending: false });
        if (error) throw error;
        setWallpapers(data || []);
      } catch (error) {
        console.error('Error fetching wallpapers:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const categoriesFor = (line: 'customized' | 'rolls') => Array.from(new Set(
    wallpapers.filter((wallpaper) => (wallpaper.product_line === 'rolls' ? 'rolls' : 'customized') === line).map((wallpaper) => wallpaper.category),
  )).sort((a, b) => a.localeCompare(b));
  const customizedCategories = categoriesFor('customized');
  const rollCategories = categoriesFor('rolls');
  const filteredWallpapers = wallpapers.filter((wallpaper) => {
    const line = wallpaper.product_line === 'rolls' ? 'rolls' : 'customized';
    return line === productLine && (selectedCategory === 'All' || wallpaper.category === selectedCategory);
  });

  const goToOrder = (wallpaper: Wallpaper, paper: PaperId) => {
    navigate('/wallpaper-order', {
      state: {
        selectedWallpaper: {
          id: wallpaper.id,
          title: `${wallpaper.category} wallpaper`,
          description: STYLE_NOTES[wallpaper.category] || null,
          image_url: wallpaper.image_url,
          category: wallpaper.category,
        },
        paperGrade: paper,
      },
    });
  };

  const handleOrder = (wallpaper: Wallpaper, paper: PaperId) => {
    if (!user) {
      setPendingWallpaper(wallpaper);
      setPendingPaper(paper);
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    goToOrder(wallpaper, paper);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (pendingCustomOrder) {
      navigate('/wallpaper-order', { state: { isCustomOrder: true } });
      setPendingCustomOrder(false);
      return;
    }
    if (pendingWallpaper) {
      goToOrder(pendingWallpaper, pendingPaper);
      setPendingWallpaper(null);
    }
  };

  const handleCustomOrderClick = () => {
    if (!user) {
      setPendingCustomOrder(true);
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    navigate('/wallpaper-order', { state: { isCustomOrder: true } });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary-600" />
          <p className="text-gray-600">Loading wallpapers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-700">3D wallpaper</p>
          <h1 className="mt-2 text-4xl font-bold text-gray-900 sm:text-5xl">Choose a wall, then the paper</h1>
          <p className="mt-3 text-lg text-gray-600">Open any design to see how it looks, which paper it can be printed on, and how to measure the wall before you order.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-gray-800">
            Customized
            <select
              value={productLine === 'customized' ? selectedCategory : ''}
              onChange={(event) => {
                setProductLine('customized');
                setSelectedCategory(event.target.value || 'All');
              }}
              className={`rounded-xl border bg-white px-4 py-3 text-sm font-medium text-gray-800 ${productLine === 'customized' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'}`}
            >
              <option value="" disabled>Choose a customized design</option>
              <option value="All">All customized</option>
              {customizedCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-gray-800">
            Rolls
            <select
              value={productLine === 'rolls' ? selectedCategory : ''}
              onChange={(event) => {
                setProductLine('rolls');
                setSelectedCategory(event.target.value || 'All');
              }}
              className={`rounded-xl border bg-white px-4 py-3 text-sm font-medium text-gray-800 ${productLine === 'rolls' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'}`}
            >
              <option value="" disabled>{rollCategories.length === 0 ? 'No rolls yet' : 'Choose a roll'}</option>
              <option value="All">All rolls</option>
              {rollCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-sm text-gray-500">{filteredWallpapers.length} designs</p>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Want a design that is not in this collection?</h2>
            <p className="mt-1 text-sm text-slate-300">Describe the style, colour and wall, and the studio can prepare a custom artwork.</p>
          </div>
          <button type="button" onClick={handleCustomOrderClick} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-900">
            <Palette className="h-5 w-5" /> Request custom design
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredWallpapers.map((wallpaper) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} onOpen={setOpenWallpaper} />
          ))}
        </div>

        {filteredWallpapers.length === 0 && (
          <div className="py-20 text-center">
            <Search className="mx-auto h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-2xl font-semibold text-gray-900">No wallpapers found</h3>
            <p className="text-gray-600">{productLine === 'rolls' ? 'Roll designs will be added soon.' : 'Choose another style.'}</p>
          </div>
        )}
      </div>

      {openWallpaper && <WallpaperDetail wallpaper={openWallpaper} onClose={() => setOpenWallpaper(null)} onOrder={handleOrder} />}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingWallpaper(null);
          setPendingCustomOrder(false);
        }}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

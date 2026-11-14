import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';

const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;

export default function IntroVideo({ videoId, videoUrl, name }: { videoId?: string | null; videoUrl?: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  const youtubeId = videoId && videoIdPattern.test(videoId) ? videoId : null;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!youtubeId && !videoUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#172B45] px-4 py-2 text-sm font-semibold text-[#172B45] hover:bg-[#172B45] hover:text-white"
      >
        <Play className="h-4 w-4" /> Introduction
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} introduction`}
            className="relative w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 text-sm font-semibold text-white"
            >
              <X className="h-4 w-4" /> Close
            </button>
            {youtubeId ? (
              <iframe
                className="aspect-video w-full rounded-2xl bg-black"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                title={`${name} introduction`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video className="aspect-video w-full rounded-2xl bg-black" src={videoUrl || undefined} controls autoPlay playsInline />
            )}
          </div>
        </div>
      )}
    </>
  );
}

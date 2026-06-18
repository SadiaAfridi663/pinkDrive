import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

function ImagePreviewModal({ images, currentIndex, onClose, onPrev, onNext }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
    if (e.key === 'ArrowRight' && onNext) onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (!images || images.length === 0) return null;

  const current = images[currentIndex || 0];

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition z-10 bg-black/20 rounded-full p-2 cursor-pointer border-none"
        onClick={onClose}
      >
        <X size={24} />
      </button>

      {images.length > 1 && onPrev && (
        <button
          className="absolute left-4 text-white/70 hover:text-white transition z-10 bg-black/20 rounded-full p-2 cursor-pointer border-none"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {images.length > 1 && onNext && (
        <button
          className="absolute right-4 text-white/70 hover:text-white transition z-10 bg-black/20 rounded-full p-2 cursor-pointer border-none"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.url}
          alt={current.label || 'Document'}
          className="max-w-full max-h-[85vh] object-contain rounded-sm shadow-lg"
        />
        {current.label && (
          <p className="text-white/70 text-sm mt-3 m-0">{current.label}</p>
        )}
      </div>
    </div>
  );
}

export default ImagePreviewModal;

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, size = 'md', children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizeClass =
    size === '2xl'
      ? 'max-w-4xl'
      : size === 'lg'
        ? 'max-w-xl'
        : size === 'sm'
          ? 'max-w-sm'
          : 'max-w-md';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`w-full mx-2 sm:mx-0 ${sizeClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

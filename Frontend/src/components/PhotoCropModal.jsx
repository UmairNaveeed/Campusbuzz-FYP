import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import Modal from './Modal';
import { getCroppedImgBlob } from '../lib/cropImage';

/** Matches typical profile banner framing (e.g. Twitter-style header). */
export const COVER_CROP_ASPECT = 3 / 1;

export default function PhotoCropModal({
  open,
  kind,
  imageSrc,
  onClose,
  onApply,
  applying = false,
  onCropFail,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels || applying) return;
    try {
      const blob = await getCroppedImgBlob(imageSrc, croppedAreaPixels, kind === 'profile');
      await onApply(blob);
    } catch (err) {
      onCropFail?.(err?.message || 'Could not crop image.');
    }
  };

  const title = kind === 'profile' ? 'Adjust profile photo' : 'Adjust cover photo';
  const subtitle =
    kind === 'profile'
      ? 'Drag to reposition and zoom so your face fits the circle.'
      : 'Drag and zoom to frame your banner (wide crop).';

  return (
    <Modal open={open} onClose={onClose} title={title} size="2xl">
      <p className="text-sm text-[#6B7280] mb-4">{subtitle}</p>

      <div className="relative w-full h-[min(55vh,380px)] rounded-xl bg-[#111827] overflow-hidden mb-4">
        {imageSrc ? (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={kind === 'profile' ? 1 : COVER_CROP_ASPECT}
            cropShape={kind === 'profile' ? 'round' : 'rect'}
            showGrid={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        ) : null}
      </div>

      <div className="space-y-2 mb-6">
        <label className="flex items-center justify-between text-sm font-medium text-[#374151]">
          <span>Zoom</span>
          <span className="tabular-nums text-[#6B7280]">{zoom.toFixed(2)}×</span>
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.02}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-[#7C3AED]"
        />
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={applying}
          className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleApply()}
          disabled={applying || !croppedAreaPixels}
          className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </Modal>
  );
}

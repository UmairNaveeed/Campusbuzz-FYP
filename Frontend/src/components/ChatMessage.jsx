import { useState } from 'react';
import { Download, X } from 'lucide-react';
import SharedPostPreview from './SharedPostPreview';
import SharedPostViewerModal from './SharedPostViewerModal';

export default function ChatMessage({ message, isOwn, onDelete, onReact, quickEmojis = [], showDeliveryStatus = false }) {
  const statusLabel = message.status === 'read' ? 'Seen' : message.status === 'delivered' ? 'Delivered' : 'Sent';
  const mediaUrl = message.media?.url ?? message.media;
  const mediaType = message.media?.type || (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:video/') ? 'video' : 'image');
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [viewPostId, setViewPostId] = useState(null);

  const hasSharedPost = Boolean(message.postId && message.post);
  const hasText = Boolean(message.text?.trim());
  const hasMedia = Boolean(mediaUrl);
  const hasReactions = Boolean(message.reactions?.length);

  const handleSaveMedia = (e) => {
    e.stopPropagation();
    if (!mediaUrl) return;
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const filename = `media-${Date.now()}.${ext}`;
    if (mediaUrl.startsWith('data:')) {
      fetch(mediaUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        })
        .catch(() => {
          const link = document.createElement('a');
          link.href = mediaUrl;
          link.download = filename;
          link.target = '_blank';
          link.click();
        });
    } else {
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const metaRow = (
    <div
      className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] shrink-0 flex-wrap ${
        hasSharedPost && !hasText && !hasMedia
          ? isOwn
            ? 'text-[#9CA3AF]'
            : 'text-[#9CA3AF]'
          : isOwn
            ? 'text-white/80'
            : 'text-[#9CA3AF]'
      }`}
    >
      <span>{message.timestamp}</span>
      {isOwn && showDeliveryStatus && (
        <span className={message.status === 'read' ? 'font-medium text-[#7C3AED]' : 'text-[#9CA3AF]'}>
          {statusLabel}
        </span>
      )}
    </div>
  );

  const reactionPill = hasReactions ? (
    <div
      className={`absolute z-[1] flex max-w-[min(100%,12rem)] flex-wrap items-center gap-0.5 rounded-full border border-[#E5E7EB] bg-white px-1.5 py-0.5 shadow-md ${
        isOwn ? '-bottom-2.5 right-2' : '-bottom-2.5 left-2'
      }`}
      title={message.reactions.map((r) => r.user?.name).filter(Boolean).join(', ')}
    >
      {message.reactions.map((r) => (
        <span key={r._id} className="text-[15px] leading-none" title={r.user?.name}>
          {r.emoji}
        </span>
      ))}
    </div>
  ) : null;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'} relative max-w-[85%]`}>
        {(hasText || hasMedia) && (
          <div className={`relative ${hasReactions ? 'mb-2' : ''}`}>
            <div
              className={`max-w-full rounded-2xl px-4 py-2.5 text-sm min-h-[2.5rem] flex flex-col ${
                isOwn
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white rounded-br-md'
                  : 'bg-[#F3F4F6] text-[#111827] rounded-bl-md'
              }`}
            >
            {hasMedia && (
              <div className="mb-2 rounded-xl overflow-hidden relative group/media">
                {mediaType === 'video' ? (
                  <video
                    src={mediaUrl}
                    className="max-w-full max-h-64 object-cover cursor-pointer"
                    muted
                    playsInline
                    onClick={() => setShowMediaViewer(true)}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt=""
                    className="max-w-full max-h-64 object-cover cursor-pointer"
                    onClick={() => setShowMediaViewer(true)}
                  />
                )}
                <button
                  type="button"
                  onClick={handleSaveMedia}
                  className="absolute bottom-2 right-2 rounded-full bg-black/50 text-white p-1.5 opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
                  title="Save"
                >
                  <Download size={14} />
                </button>
              </div>
            )}
            {hasText && <p>{message.text}</p>}
            </div>
            {reactionPill}
          </div>
        )}

        {hasSharedPost && (
          <div className={`relative w-full max-w-full ${hasReactions && !(hasText || hasMedia) ? 'mb-2' : ''}`}>
            <SharedPostPreview post={message.post} onOpenPost={setViewPostId} />
            {!(hasText || hasMedia) && reactionPill}
          </div>
        )}

        {(hasText || hasMedia || hasSharedPost) && metaRow}

        {isOwn && onDelete && (
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="text-[10px] text-[#6B7280] hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
        {!isOwn && onReact && quickEmojis.length > 0 && (
          <div className="absolute bottom-full left-0 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10 flex flex-nowrap gap-0.5 rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-lg">
            {quickEmojis.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => onReact(message.id, em)}
                className="shrink-0 text-base hover:bg-[#F5F3FF] rounded p-1 transition-colors"
                title="React with emoji"
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>

      {showMediaViewer && mediaUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowMediaViewer(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/10 text-white p-2 hover:bg-white/20 z-10"
            onClick={() => setShowMediaViewer(false)}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <button
            type="button"
            className="absolute top-4 right-14 rounded-full bg-white/10 text-white p-2 hover:bg-white/20 z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveMedia(e);
            }}
            aria-label="Save"
          >
            <Download size={24} />
          </button>
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {mediaType === 'video' ? (
              <video src={mediaUrl} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg" />
            ) : (
              <img src={mediaUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            )}
          </div>
        </div>
      )}

      {viewPostId && (
        <SharedPostViewerModal postId={viewPostId} onClose={() => setViewPostId(null)} />
      )}
    </div>
  );
}

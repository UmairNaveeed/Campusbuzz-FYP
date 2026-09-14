import { useCreatePost } from '../context/CreatePostContext';
import CreatePost from './CreatePost';
import { X } from 'lucide-react';

export default function CreatePostModal() {
  const { isOpen, closeCreatePost } = useCreatePost();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeCreatePost();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-[#111827]">Create Post</h2>
          <button
            onClick={closeCreatePost}
            className="p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#6B7280]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <CreatePost isModal={true} />
        </div>
      </div>
    </div>
  );
}

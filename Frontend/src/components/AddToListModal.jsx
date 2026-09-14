import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { getMyLists, createCustomList, addListMembers, removeListMembers } from '../services/api';
import { Check, Plus } from 'lucide-react';

export default function AddToListModal({ open, onClose, targetUser }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [addedListIds, setAddedListIds] = useState(new Set());
  const [removeConfirmId, setRemoveConfirmId] = useState(null);
  const [pendingRemoveList, setPendingRemoveList] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getMyLists();
        if (!cancelled) setLists(data?.lists || []);
      } catch (err) {
        if (!cancelled) setLists([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleCreateAndAdd = async () => {
    const name = String(newName || '').trim();
    if (!name) return setError('List name is required');
    setActionLoading(true);
    setError('');
    try {
      const created = await createCustomList(name);
      const list = created?.list;
      if (list) {
        // add member by username when possible
        await addListMembers(list.id, { usernames: [targetUser.username] });
        setLists((prev) => [list, ...prev]);
        setNewName('');
        setAddedListIds((s) => new Set([...Array.from(s), list.id]));
        setSuccessMessage(`Added ${targetUser?.name || targetUser?.username} to "${list.name}"`);
        // keep modal open so user can add to more lists
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create list');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToList = async (list) => {
    if (!list || !targetUser) return;
    setActionLoading(true);
    setError('');
    try {
      const payload = targetUser.username ? { usernames: [targetUser.username] } : { userIds: [targetUser.id] };
      const data = await addListMembers(list.id, payload);
      // update UI to reflect addition and show success message
      setAddedListIds((s) => new Set([...Array.from(s), list.id]));
      setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, memberCount: (l.memberCount || l.members || 0) + 1 } : l)));
      setSuccessMessage(`Added ${targetUser?.name || targetUser?.username} to "${list.name}"`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add user to list');
    } finally {
      setActionLoading(false);
    }
  };

  const requestRemoveFromList = (listId) => {
    const list = lists.find((l) => l.id === listId) || null;
    setPendingRemoveList(list);
    setRemoveConfirmId(null);
    setError('');
    setSuccessMessage('');
  };

  const handleRemoveFromList = async (list) => {
    if (!list) return;
    setActionLoading(true);
    setError('');
    try {
      const payload = targetUser.username ? { usernames: [targetUser.username] } : { userIds: [targetUser.id] };
      const data = await removeListMembers(list.id, payload);
      // update UI
      setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, memberCount: Math.max(0, (l.memberCount || l.members || 0) - 1) } : l)));
      setAddedListIds((s) => {
        const copy = new Set(Array.from(s));
        copy.delete(list.id);
        return copy;
      });
      setSuccessMessage(`Removed ${targetUser?.name || targetUser?.username} from "${list.name}"`);
      setPendingRemoveList(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove user from list');
    } finally {
      setActionLoading(false);
    }
  };

  const isMember = (list) => {
    if (!list || !targetUser) return false;
    const ids = list.memberIds || [];
    const uid = targetUser.id || targetUser._id;
    if (uid && ids.some((i) => String(i) === String(uid))) return true;
    if (targetUser.username && list.memberIds?.length === 0) return false;
    // best-effort: the list objects returned from getMyLists may not include member details — ignore username check
    // also check addedListIds cache
    if (addedListIds && addedListIds.has && addedListIds.has(list.id)) return true;
    return false;
  };

  return (
    <>
    <Modal open={open} onClose={() => !actionLoading && onClose()} title={`Add ${targetUser?.name || 'user'} to a list`}>
      <div className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Create new list</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Study buddies"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
            />
            <button
              type="button"
              disabled={actionLoading || !newName.trim()}
              onClick={handleCreateAndAdd}
              className="rounded-xl bg-[#7C3AED] px-3 py-2 text-white"
            >
              {actionLoading ? '...' : <Plus size={16} />}
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm text-[#6B7280] mb-2">Add to an existing list</p>
          {loading ? (
            <p className="text-sm text-[#6B7280]">Loading lists...</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-[#6B7280]">You don't have any lists yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{l.name}</p>
                    <p className="text-xs text-[#6B7280]">{l.memberCount ?? l.members ?? 0} members</p>
                  </div>
                  <div>
                    {isMember(l) ? (
                      (
                        <button
                          type="button"
                          onClick={() => requestRemoveFromList(l.id)}
                          className="flex items-center gap-1 rounded-full bg-[#10B981] px-2 py-1 text-white text-xs"
                        >
                          <Check size={14} /> Added
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleAddToList(l)}
                        className="rounded-xl bg-[#7C3AED] px-3 py-1.5 text-white text-sm"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
    {pendingRemoveList && (
      <Modal
        open={Boolean(pendingRemoveList)}
        onClose={() => !actionLoading && setPendingRemoveList(null)}
        title="Remove from list"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#374151]">Do you want to remove {targetUser?.name || targetUser?.username} from "{pendingRemoveList.name}"?</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingRemoveList(null)}
              className="px-3 py-1.5 rounded-xl border border-[#E5E7EB]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleRemoveFromList(pendingRemoveList)}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white"
            >
              {actionLoading ? '...' : 'Remove'}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}

import React, { useEffect, useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { getAlumniSignups, getAlumniSignup, approveAlumniSignup, rejectAlumniSignup, downloadAlumniTranscript } from '../../services/api';

const AdminAlumniSignups = () => {
  const [loading, setLoading] = useState(true);
  const [pendingSignups, setPendingSignups] = useState([]);
  const [reviewedSignups, setReviewedSignups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [previewFilename, setPreviewFilename] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        getAlumniSignups('pending'),
        getAlumniSignups('approved'),
        getAlumniSignups('rejected'),
      ]);

      if (pendingRes.success && approvedRes.success && rejectedRes.success) {
        setPendingSignups(pendingRes.signups || []);
        setReviewedSignups([...(approvedRes.signups || []), ...(rejectedRes.signups || [])]);
      } else {
        setError(pendingRes.error || approvedRes.error || rejectedRes.error || 'Failed to load');
      }
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const viewDetail = async (id) => {
    try {
      const res = await getAlumniSignup(id);
      if (res.success) {
        const signup = res.signup;
        setSelected(signup);

        // if transcript exists, fetch blob for preview
        if (signup.hasTranscript) {
          try {
            const resp = await downloadAlumniTranscript(id);
            const blob = resp.data;
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPreviewType(blob.type || 'application/octet-stream');
            // attempt to read filename from headers
            const cd = resp.headers && (resp.headers['content-disposition'] || resp.headers['Content-Disposition']);
            if (cd) {
              const m = cd.match(/filename="?([^";]+)"?/);
              if (m) setPreviewFilename(m[1]);
            }
          } catch (err) {
            console.warn('preview fetch failed', err.message || err);
          }
        }
      } else setError(res.error || 'Failed to load');
    } catch (e) {
      setError(e.message || 'Failed to load');
    }
  };

  const doDownload = async (id) => {
    try {
      const resp = await downloadAlumniTranscript(id);
      const blob = resp.data;
      const url = window.URL.createObjectURL(new Blob([blob], { type: blob.type }));
      const a = document.createElement('a');
      a.href = url;
      // try to extract filename from headers
      const cd = resp.headers && (resp.headers['content-disposition'] || resp.headers['Content-Disposition']);
      let filename = `transcript-${id}`;
      if (cd) {
        const m = cd.match(/filename="?([^";]+)"?/);
        if (m) filename = m[1];
      } else if (previewFilename) filename = previewFilename;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed');
    }
  };

  const cleanupPreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewType(null);
      setPreviewFilename(null);
    }
  };

  // toast helper
  function showToast(type, message, ms = 3500) {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type: '', message: '' }), ms);
  }

  // confirmation handler
  const handleConfirm = async (confirm) => {
    // no-op: approval/rejection removed from the view modal
  };

  useEffect(() => {
    return () => cleanupPreview();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8 lg:px-10 lg:py-10">
          <div className="rounded-[2rem] bg-white px-6 py-6 shadow ring-1 ring-slate-200/70 lg:px-8 lg:py-8">
            <h1 className="text-2xl font-semibold">Alumni Signup Requests</h1>
            <p className="mt-2 text-sm text-slate-600">Review pending requests and track approved or rejected signups.</p>
          </div>

          <div className="mt-6">
            {error && <div className="rounded p-4 bg-red-50 text-red-700">{error}</div>}
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin h-10 w-10 border-2 border-[#193965] border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Pending requests</h2>
                      <p className="text-sm text-slate-500">Awaiting admin review.</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                      {pendingSignups.length}
                    </span>
                  </div>

                  {pendingSignups.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">No pending signups.</div>
                  ) : (
                    <ul className="space-y-2">
                      {pendingSignups.map((s) => {
                        const id = s.id || s._id || s._id?.toString();
                        return (
                          <li key={id || Math.random()} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                            <div>
                              <div className="font-semibold text-slate-900">{s.name}</div>
                              <div className="text-sm text-slate-500">{s.alumniEmail} · {new Date(s.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                pending
                              </span>
                              <button onClick={() => viewDetail(id)} className="px-3 py-2 bg-slate-50 rounded text-sm text-slate-700">View</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Reviewed requests</h2>
                      <p className="text-sm text-slate-500">Approved and rejected signups remain visible here.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      {reviewedSignups.length}
                    </span>
                  </div>

                  {reviewedSignups.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">No reviewed signups yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {reviewedSignups.map((s) => {
                        const id = s.id || s._id || s._id?.toString();
                        const badgeClass = s.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700';
                        return (
                          <li key={id || Math.random()} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                            <div>
                              <div className="font-semibold text-slate-900">{s.name}</div>
                              <div className="text-sm text-slate-500">{s.alumniEmail} · {new Date(s.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>
                                {s.status}
                              </span>
                              <button onClick={() => viewDetail(id)} className="px-3 py-2 bg-slate-50 rounded text-sm text-slate-700">View</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>

          {selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-w-2xl w-full max-h-[90vh] overflow-auto rounded-2xl bg-white p-6 relative">
                <button
                  onClick={() => { cleanupPreview(); setSelected(null); }}
                  aria-label="Close"
                  className="absolute right-3 top-3 rounded-full bg-white/90 hover:bg-white px-2 py-1 text-slate-600 shadow"
                >
                  ✕
                </button>
                <div className="mb-2">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm text-slate-500">{selected.alumniEmail}</p>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-slate-700">Status: <span className="font-semibold">{selected.status}</span></p>
                  <p className="mt-3 text-sm text-slate-600">Submitted: {new Date(selected.createdAt).toLocaleString()}</p>
                  <div className="mt-4">
                    {selected.hasTranscript ? (
                      <div className="rounded border p-3 relative">
                        {previewUrl ? (
                          <>
                            {previewType && previewType.includes('pdf') ? (
                              <div className="w-full h-[36rem] border overflow-hidden">
                                <embed src={previewUrl} type="application/pdf" className="w-full h-full" />
                              </div>
                            ) : previewType && previewType.startsWith('image/') ? (
                              <img src={previewUrl} alt="transcript" className="max-h-96 mx-auto" />
                            ) : (
                              <p className="text-sm text-slate-500">Preview not available for this file type. Use Download to inspect the transcript.</p>
                            )}
                            <button
                              onClick={() => { if (previewUrl) window.open(previewUrl, '_blank'); }}
                              className="absolute right-3 top-3 bg-white/90 px-2 py-1 rounded shadow text-sm"
                            >
                              Open
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">Transcript available — downloading preview...</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded border p-3 text-sm text-slate-500">No transcript uploaded.</div>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button onClick={() => { doDownload(selected.id || selected._id); }} className="px-4 py-2 border rounded">Download</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {toast.visible && (
            <div className={`fixed right-6 top-6 z-50 rounded-lg px-4 py-2 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminAlumniSignups;

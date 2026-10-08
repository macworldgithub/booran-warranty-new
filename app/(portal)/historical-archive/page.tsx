'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/header';
import { historicalArchive, ArchivePage, ArchivedDetail, ArchivedFile, ArchivedJob } from '@/lib/historical-archive';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 1)} ${sizes[i]}`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'Undated';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Undated';
  }
}

function getFileCategory(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) {
    return {
      type: 'ZIP Photos',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
      iconBg: 'bg-purple-50 text-purple-600',
      label: 'Photo Archive',
    };
  }
  if (lower.endsWith('.pdf')) {
    return {
      type: 'PDF Document',
      badgeClass: 'bg-red-100 text-red-800 border-red-200',
      iconBg: 'bg-red-50 text-red-600',
      label: 'Inspection PDF',
    };
  }
  if (lower.endsWith('.json')) {
    return {
      type: 'JSON',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      label: 'Structured Data',
    };
  }
  return {
    type: 'Text',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    iconBg: 'bg-slate-50 text-slate-600',
    label: 'Plain Document',
  };
}

const QUICK_SUGGESTIONS = [
  'RO 73680',
  '2FQ3RS',
  'Camera',
  'Spare Wheel',
  'Mirror Switch',
  'Torque',
];

export default function HistoricalArchivePage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ISSUES' | 'CLEAN'>('ALL');
  const [data, setData] = useState<ArchivePage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchivedDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Fetch list
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    historicalArchive
      .list(search, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
          // Automatically select first record on page load if none selected
          if (!selected && result.items.length > 0) {
            setSelected(result.items[0].id);
          }
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page, retry]);

  // Fetch selected detail
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError('');
    historicalArchive
      .detail(selected, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setDetailError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected]);

  function selectJob(id: string | null) {
    if (selected === id) return;
    setDetail(null);
    setDetailError('');
    setSelected(id);
  }

  function reload() {
    setLoading(true);
    setError('');
    setData(null);
    setRetry((v) => v + 1);
  }

  function changePage(value: number) {
    setPage(value);
    reload();
    window.scrollTo({ top: 200, behavior: 'smooth' });
  }

  function searchJobs(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(input.trim());
    reload();
  }

  function triggerQuickSearch(term: string) {
    setInput(term);
    setPage(1);
    setSearch(term);
    reload();
  }

  function clearSearch() {
    setInput('');
    setSearch('');
    setPage(1);
    reload();
  }

  async function handleCopyReport() {
    if (!detail?.reportText) return;
    try {
      await navigator.clipboard.writeText(detail.reportText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore clipboard error
    }
  }

  async function download(file: ArchivedFile) {
    if (!detail) return;
    setDownloading(file.id);
    setDetailError('');
    try {
      await historicalArchive.download(detail.id, file);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  // Filter items in current view if issues/clean tab chosen
  const displayedItems = useMemo(() => {
    if (!data?.items) return [];
    if (filterMode === 'ISSUES') {
      return data.items.filter((item) => item.issues && item.issues.length > 0);
    }
    if (filterMode === 'CLEAN') {
      return data.items.filter((item) => !item.issues || item.issues.length === 0);
    }
    return data.items;
  }, [data?.items, filterMode]);

  return (
    <>
      <Header
        title="Historical Archive"
        subtitle="WorkPhotos past jobs & media repository"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
          <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#E11F26]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase bg-red-950/80 text-red-300 border border-red-800/60 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11F26] animate-pulse" />
                  WorkPhotos Archive
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-300 bg-slate-800/80 border border-slate-700/60">
                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Read-Only Vault
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Booran Motors Historical Repository
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Query indexed WorkPhotos claims, inspect original technician report transcripts, and download verified high-res image packages and inspection documents.
              </p>
            </div>

            {/* Quick Banner Stats */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3.5 backdrop-blur-xs min-w-[130px]">
                <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Vault</p>
                <p className="text-2xl font-black text-white mt-0.5">
                  {data ? data.archiveTotal.toLocaleString() : '865'}
                </p>
                <p className="text-[10px] text-slate-400">Archived jobs</p>
              </div>
              <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-3.5 backdrop-blur-xs min-w-[130px]">
                <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Current Match</p>
                <p className="text-2xl font-black text-[#E11F26] mt-0.5">
                  {data ? data.total.toLocaleString() : '...'}
                </p>
                <p className="text-[10px] text-slate-400">Available records</p>
              </div>
            </div>
          </div>
        </section>

        {/* SEARCH AND FILTER BAR */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <form onSubmit={searchJobs} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={200}
                placeholder="Search job title, repair order, registration, VIN, or report text..."
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 focus:border-[#E11F26] focus:bg-white focus:ring-2 focus:ring-red-500/20 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 transition-all outline-hidden"
              />
              {input && (
                <button
                  type="button"
                  onClick={clearSearch}
                  title="Clear search text"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-[#E11F26] hover:bg-[#c81a20] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </form>

          {/* Quick chips & Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">Quick:</span>
              {QUICK_SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => triggerQuickSearch(term)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-[#E11F26] text-slate-600 font-medium transition-colors cursor-pointer border border-slate-200/60"
                >
                  {term}
                </button>
              ))}
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Reset &times;</span>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All on Page
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ISSUES')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterMode === 'ISSUES'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-500 hover:text-amber-700'
                }`}
              >
                Review Flagged
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('CLEAN')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterMode === 'CLEAN'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Clean Export
              </button>
            </div>
          </div>
        </section>

        {/* ERROR STATE */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between text-red-800">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={reload}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* MAIN MASTER-DETAIL GRID */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: LIST */}
          <section aria-label="Archived jobs list" className="lg:col-span-5 space-y-3">
            {/* List Header Count */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                  Archived Jobs
                </h2>
                {data && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                    {data.total.toLocaleString()}
                  </span>
                )}
              </div>
              {search && (
                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                  Filtered for: <span className="font-bold text-slate-700">&ldquo;{search}&rdquo;</span>
                </p>
              )}
            </div>

            {/* Skeleton Loading State */}
            {loading && !data && (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-3.5 bg-slate-200 rounded-md w-24" />
                      <div className="h-3 bg-slate-200 rounded-md w-16" />
                    </div>
                    <div className="h-5 bg-slate-300 rounded-md w-3/4" />
                    <div className="flex gap-2">
                      <div className="h-4 bg-slate-200 rounded-md w-20" />
                      <div className="h-4 bg-slate-200 rounded-md w-28" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && displayedItems.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-800 text-base">No Matching Records Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting your search keywords, clear filter tags, or search by a registration or RO number.
                </p>
                {search && (
                  <button
                    onClick={clearSearch}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}

            {/* Job Cards */}
            <div className="space-y-2.5">
              {displayedItems.map((job) => {
                const isSelected = selected === job.id;
                const hasIssues = job.issues && job.issues.length > 0;

                return (
                  <button
                    key={job.id}
                    onClick={() => selectJob(job.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left bg-white rounded-2xl p-4 transition-all duration-150 cursor-pointer border group relative ${
                      isSelected
                        ? 'border-[#E11F26] bg-red-50/25 ring-2 ring-red-500/20 shadow-md border-l-4 border-l-[#E11F26]'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          {job.organisation || 'Booran Motors'}
                        </span>
                        {job.sourceFolder && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                            {job.sourceFolder}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatDate(job.capturedAt)}
                      </span>
                    </div>

                    <h3 className={`font-bold text-sm tracking-tight break-words transition-colors ${
                      isSelected ? 'text-[#E11F26]' : 'text-slate-900 group-hover:text-[#E11F26]'
                    }`}>
                      {job.title}
                    </h3>

                    {/* Metadata & Tag Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {job.fileCount} saved {job.fileCount === 1 ? 'file' : 'files'}
                      </span>

                      {hasIssues ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Needs Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Clean
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PAGINATION TOOLBAR */}
            {data && data.pages > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex items-center justify-between text-xs mt-3">
                <button
                  disabled={data.page <= 1 || loading}
                  onClick={() => changePage(data.page - 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>

                <div className="text-center font-semibold text-slate-600">
                  Page <span className="font-black text-slate-900">{data.page}</span> of {data.pages}
                </div>

                <button
                  disabled={data.page >= data.pages || loading}
                  onClick={() => changePage(data.page + 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                >
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </section>

          {/* RIGHT COLUMN: DETAIL VIEW (STICKY) */}
          <section
            aria-label="Job details and files"
            className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6 lg:sticky lg:top-24"
          >
            {/* If no job selected */}
            {!selected && (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#E11F26] mx-auto flex items-center justify-center border border-red-100 shadow-xs">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Select an Archived Job</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Click any repair order from the list on the left to inspect its diagnostic report text and download original photos and PDF documents.
                </p>
              </div>
            )}

            {/* Detail Loading State */}
            {selected && detailLoading && !detail && (
              <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-red-200 border-t-[#E11F26] rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-600">Retrieving job record from vault…</p>
              </div>
            )}

            {/* Detail Error State */}
            {detailError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p>{detailError}</p>
              </div>
            )}

            {/* Loaded Detail Content */}
            {detail && (
              <>
                {/* Detail Header Banner */}
                <div className="space-y-2 border-b border-slate-100 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {detail.organisation || 'Booran Motors'}
                      </span>
                      {detail.sourceFolder && (
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          Source: {detail.sourceFolder}
                        </span>
                      )}
                    </div>
                    {detail.sourceUrl && (
                      <a
                        href={detail.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#E11F26] hover:underline inline-flex items-center gap-1"
                      >
                        View WorkPhotos URL
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 tracking-tight break-words">
                    {detail.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Captured on <span className="font-bold text-slate-700">{formatDate(detail.capturedAt)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span className="font-bold text-slate-700">{detail.files.length}</span> Verified Files
                    </span>
                  </div>
                </div>

                {/* Review Notes / Issues Banner */}
                {detail.issues && detail.issues.length > 0 && (
                  <div className="rounded-xl bg-amber-50/80 border border-amber-200/90 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                      <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Export Review Warnings ({detail.issues.length})
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800">
                      {detail.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* REPORT TEXT SECTION */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Captured Report Transcript
                    </h3>
                    {detail.reportText && (
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {copiedText ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Text
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto border border-slate-800 shadow-inner">
                    {detail.reportText ? (
                      detail.reportText
                    ) : (
                      <span className="text-slate-400 italic">No report text recorded in archive.</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Extracted from WorkPhotos job export. Text formatting reflects original system output.
                  </p>
                </div>

                {/* ORIGINAL FILES SECTION */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-[#E11F26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Archive Media &amp; Files ({detail.files.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Click any package below to download original camera photos and documents.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {detail.files.map((file) => {
                      const category = getFileCategory(file.name);
                      const isDownloadingThis = downloading === file.id;

                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-3 p-3.5 bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl transition-all duration-150"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${category.iconBg} border-slate-200/60`}>
                              {file.name.toLowerCase().endsWith('.zip') ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : file.name.toLowerCase().endsWith('.pdf') ? (
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-mono text-slate-500">
                                  {formatBytes(file.bytes)}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${category.badgeClass}`}>
                                  {category.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={downloading !== null}
                            onClick={() => void download(file)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-slate-800 hover:text-[#E11F26] border border-slate-300 hover:border-red-300 font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            {isDownloadingThis ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-[#E11F26] rounded-full animate-spin" />
                                <span>Saving…</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

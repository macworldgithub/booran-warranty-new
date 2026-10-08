'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { historicalArchive, ArchivePage, ArchivedDetail, ArchivedFile } from '@/lib/historical-archive';

export default function HistoricalArchivePage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArchivePage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchivedDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    historicalArchive.list(search, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, retry]);
  useEffect(() => {
    const controller = new AbortController();
    if (selected) historicalArchive.detail(selected, controller.signal).then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(err => { if (!controller.signal.aborted) setDetailError(err.message); });
    return () => controller.abort();
  }, [selected]);

  function selectJob(id: string | null) { setDetail(null); setDetailError(''); setSelected(id); }
  function reload() { setLoading(true); setError(''); setData(null); setRetry(value => value + 1); }
  function changePage(value: number) { setPage(value); selectJob(null); reload(); }
  function searchJobs(event: FormEvent) { event.preventDefault(); setPage(1); selectJob(null); setSearch(input); reload(); }
  async function download(file: ArchivedFile) {
    if (!detail) return;
    setDownloading(file.id); setDetailError('');
    try { await historicalArchive.download(detail.id, file); }
    catch (err) { setDetailError(err instanceof Error ? err.message : 'Download failed.'); }
    finally { setDownloading(null); }
  }
  return <>
    <Header title="Booran Motors" subtitle="WorkPhotos historical archive" />
    <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
      <section className="rounded-2xl bg-slate-900 text-white p-6">
        <p className="text-xs uppercase tracking-widest text-slate-300">Historical reference</p>
        <h2 className="text-2xl font-semibold mt-2">Booran Motors</h2>
        <p className="text-slate-300 mt-2">Search previous WorkPhotos jobs and download the original reports and photo archives.</p>
        {data && <p className="mt-4 text-sm">{data.archiveTotal.toLocaleString()} archived jobs · Read-only collection</p>}
      </section>
      <form onSubmit={searchJobs} className="flex gap-3">
        <label className="flex-1"><span className="sr-only">Search historical jobs</span><input value={input} onChange={event => setInput(event.target.value)} maxLength={200} placeholder="Search job title, repair order, registration or report text" className="w-full border border-slate-300 bg-white rounded-xl p-3" /></label>
        <button className="bg-red-600 text-white px-5 rounded-xl" type="submit">Search</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error} <button className="underline" onClick={reload}>Retry</button></p>}
      {loading && <p role="status">Loading historical jobs…</p>}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <section aria-label="Archived jobs" className="space-y-3">
          {data && <p className="text-sm text-slate-600">{data.total.toLocaleString()} results</p>}
          {data?.items.length === 0 && <p>No jobs match your search.</p>}
          {data?.items.map(job => <button key={job.id} onClick={() => { if (selected !== job.id) selectJob(job.id); }} aria-pressed={selected === job.id} className={`w-full text-left bg-white border rounded-xl p-4 hover:border-slate-500 ${selected === job.id ? 'border-red-600 ring-1 ring-red-600' : 'border-slate-200'}`}>
            <p className="text-xs text-slate-500">Booran Motors</p><h3 className="font-semibold mt-1 break-words">{job.title}</h3>
            <p className="text-sm text-slate-600 mt-2">{job.fileCount} saved files{job.capturedAt && ` · Captured ${new Date(job.capturedAt).toLocaleDateString()}`}</p>
            {!!job.issues.length && <p className="text-sm text-amber-700 mt-2">Export needs review</p>}
          </button>)}
          {data && data.pages > 1 && <div className="flex items-center justify-between pt-3">
            <button disabled={data.page <= 1 || loading} onClick={() => changePage(data.page - 1)} className="border rounded-lg px-4 py-2 disabled:opacity-40">Previous</button>
            <span className="text-sm">Page {data.page} of {data.pages}</span>
            <button disabled={data.page >= data.pages || loading} onClick={() => changePage(data.page + 1)} className="border rounded-lg px-4 py-2 disabled:opacity-40">Next</button>
          </div>}
        </section>
        <section aria-label="Job details" className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
          {!selected && <p className="text-slate-500">Select a job to view its report and files.</p>}
          {selected && !detail && !detailError && <p role="status">Loading job…</p>}
          {detailError && <p role="alert" className="text-red-700">{detailError}</p>}
          {detail && <>
            <h3 className="text-xl font-semibold break-words">{detail.title}</h3>
            <p className="text-sm text-slate-500">Booran Motors · WorkPhotos</p>
            {!!detail.issues.length && <div className="rounded-lg bg-amber-50 text-amber-900 p-3"><p className="font-semibold">Export needs review</p><ul className="list-disc pl-5 text-sm">{detail.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
            <p className="text-xs text-slate-500">Saved report text may omit content that was not loaded in WorkPhotos. Original page captures can include the jobs list.</p>
            <h4 className="font-semibold">Report text</h4>
            <div className="whitespace-pre-wrap break-words text-sm bg-slate-50 rounded-lg p-4 max-h-72 overflow-y-auto">{detail.reportText || 'No report text available.'}</div>
            <h4 className="font-semibold">Original files</h4>
            <ul className="space-y-3">{detail.files.map(file => <li key={file.id} className="flex gap-3 items-center justify-between text-sm">
              <div className="min-w-0"><p className="break-words">{file.originalPath}</p><p className="text-xs text-slate-500">{(file.bytes / 1024 / 1024).toFixed(2)} MB</p></div>
              <button disabled={downloading !== null} onClick={() => void download(file)} className="text-blue-700 underline shrink-0 disabled:opacity-50">{downloading === file.id ? 'Downloading…' : 'Download'}</button>
            </li>)}</ul>
          </>}
        </section>
      </div>
    </div>
  </>;
}

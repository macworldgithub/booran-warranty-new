'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../../components/header';
import { StatusBadge } from '../../../components/status-badge';
import { api } from '../../../lib/api';
import { WarrantyCase, CaseStatus } from '../../../lib/types';

export default function CasesPage() {
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [ruleFilter, setRuleFilter] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  // Read URL params on mount (deep-link from dashboard or brand packs)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setUserRole(user.role || '');
          setUserId(user.id || '');
          setUserName(user.name || '');
        } catch {
          // ignore
        }
      }
    }

    // Initialize filters from URL search params
    const urlSiteId = searchParams.get('siteId');
    const urlStatus = searchParams.get('status');
    const urlFlagged = searchParams.get('flaggedOnly');
    const urlRuleKey = searchParams.get('ruleKey') || searchParams.get('flagRule');
    if (urlSiteId) setSiteFilter(urlSiteId);
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlFlagged === 'true') setFlaggedOnly(true);
    if (urlRuleKey) setRuleFilter(urlRuleKey);
    setInitializedFromUrl(true);
  }, []);

  useEffect(() => {
    if (initializedFromUrl) loadCases();
  }, [statusFilter, brandFilter, siteFilter, flaggedOnly, userRole, userName, ruleFilter, initializedFromUrl]);

  async function loadCases() {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (brandFilter !== 'ALL') params.brandId = brandFilter;
      if (siteFilter !== 'ALL') params.siteId = siteFilter;
      if (flaggedOnly) params.flaggedOnly = true;

      if (userRole === 'TECHNICIAN') {
        if (userId) params.technicianId = userId;
        if (userName) params.technicianName = userName;
      }

      const data = await api.getWarrantyCases(params);
      setCases(data);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCases = cases.filter((c) => {
    // If technician, enforce that they only see their own claims
    if (userRole === 'TECHNICIAN' && userName) {
      const isMyCase =
        (c.technicianName && c.technicianName.toLowerCase() === userName.toLowerCase()) ||
        (c.technicianId && (
          c.technicianId === userId ||
          c.technicianId === 'tech_' + userName.toLowerCase().replace(/[^a-z0-9]/g, '_') ||
          (userName.toLowerCase().includes('jake') && c.technicianId.includes('jake'))
        ));
      if (!isMyCase) return false;
    }

    if (ruleFilter) {
      const flags = c.flagHistory || c.flags || [];
      const matchesFlag = flags.some((f: any) => !f.resolvedAt && f.evidenceRuleKey === ruleFilter);
      const evidence = c.evidenceItems || c.evidence || [];
      const matchesEv = evidence.some((e: any) => e.ruleKey === ruleFilter);
      if (!matchesFlag && !matchesEv) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const vin = (c.vin || c.vehicle?.vin || '').toLowerCase();
    const model = (c.model || c.vehicle?.model || '').toLowerCase();
    const make = (c.make || c.vehicle?.make || '').toLowerCase();
    const concernTitle = (c.concernTitle || c.concern?.title || '').toLowerCase();
    const faultCategory = (c.faultCategory || '').toLowerCase();
    const technicianName = (c.technicianName || '').toLowerCase();
    const roNumber = (c.roNumber || '').toLowerCase();
    const claimNumber = (c.claimNumber || '').toLowerCase();
    const siteName = (c.siteName || '').toLowerCase();
    const brandName = (c.brandName || '').toLowerCase();

    return (
      roNumber.includes(q) ||
      vin.includes(q) ||
      model.includes(q) ||
      make.includes(q) ||
      technicianName.includes(q) ||
      concernTitle.includes(q) ||
      faultCategory.includes(q) ||
      claimNumber.includes(q) ||
      siteName.includes(q) ||
      brandName.includes(q)
    );
  });

  const flaggedCases = filteredCases.filter((c) => c.status === 'Flagged');

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title={userRole === 'TECHNICIAN' ? 'My Workshop Cases & Claims' : 'Warranty Cases CRM & Review Queue'}
        subtitle={
          userRole === 'TECHNICIAN'
            ? 'Track your active Repair Orders, capture mandatory Attachment A evidence, and resolve flagged items'
            : 'Manage workshop tickets, verify OEM checklist gates, flag discrepancies, and submit claims'
        }
        action={
          userRole === 'TECHNICIAN' ? (
            <Link
              href="/cases/new"
              className="btn-primary text-xs py-2 px-4 shadow-[0_0_20px_rgba(26,86,219,0.4)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Warranty Ticket</span>
            </Link>
          ) : undefined
        }
      />

      <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Urgent Retake Action Banner for Technicians (Spec §6, §8.3) */}
        {flaggedCases.length > 0 && userRole === 'TECHNICIAN' && (
          <div className="p-5 rounded-2xl bg-red-50 border-2 border-[#E11F26] shadow-sm flex flex-wrap items-center justify-between gap-4 animate-slideInLeft">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center text-[#E11F26] flex-shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Action Required: {flaggedCases.length} Ticket{flaggedCases.length > 1 ? 's' : ''} Returned For Evidence Retake</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E11F26] text-white font-mono text-[10px] uppercase font-bold">
                    Spec §6
                  </span>
                </p>
                <p className="text-xs text-slate-700 mt-0.5">
                  The warranty clerk identified blurry, wrong angle, or missing evidence. Please retake the required photos to return the ticket to review.
                </p>
              </div>
            </div>
            <Link
              href={`/cases/${flaggedCases[0].id}?retake=true`}
              className="px-4 py-2.5 rounded-xl bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span>Retake RO {flaggedCases[0].roNumber} →</span>
            </Link>
          </div>
        )}

        {/* Category Tabs (Booran Website Style) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-3">
            {[
              { key: 'ALL', label: 'All Cases' },
              { key: 'Awaiting Review', label: 'Awaiting Review' },
              { key: 'Flagged', label: 'Flagged Queue' },
              { key: 'Submitted', label: 'Submitted to OEM' },
              { key: 'Draft', label: 'Drafts' },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setStatusFilter(tab.key);
                    if (tab.key === 'Flagged') setFlaggedOnly(true);
                    else setFlaggedOnly(false);
                  }}
                  className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all relative whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-[#E11F26] border-b-2 border-[#E11F26] -mb-[1px]'
                      : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Filters Sub-Toolbar */}
          <div className="p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search RO, VIN, Model, Tech, Claim #, Concern, Category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-9 pr-8 text-xs w-full"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 text-xs"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="input-field text-xs w-36"
              >
                <option value="ALL">All Brands</option>
                <option value="brand_byd">BYD</option>
                <option value="brand_hyundai">Hyundai</option>
                <option value="brand_kia">Kia</option>
                <option value="brand_mg">MG</option>
                <option value="brand_toyota">Toyota</option>
              </select>

              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="input-field text-xs w-52"
              >
                <option value="ALL">All Rooftops</option>
                <option value="site_cranbourne_byd">Cranbourne BYD</option>
                <option value="site_dandenong_multi">Dandenong Multi-Franchise</option>
                <option value="site_cheltenham_mg">Cheltenham MG & Chery</option>
                <option value="site_berwick_toyota_ford">Berwick Commercials</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFlaggedOnly(!flaggedOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                  flaggedOnly
                    ? 'bg-red-50 border-[#E11F26] text-[#E11F26] font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#E11F26]" />
                <span>Flagged Only</span>
              </button>
              <button
                onClick={loadCases}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs cursor-pointer"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Active Rule Filter Banner */}
        {ruleFilter && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-900 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E11F26] animate-ping" />
              <span>
                Filtering cases relevant to Evidence Rule: <strong>{ruleFilter}</strong> ({filteredCases.length} case{filteredCases.length === 1 ? '' : 's'} found)
              </span>
            </div>
            <button
              onClick={() => setRuleFilter('')}
              className="px-2.5 py-1 rounded-lg bg-white border border-red-200 hover:bg-[#E11F26] hover:text-white text-[#E11F26] font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>✕</span>
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* Cases Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-900 font-bold">{filteredCases.length}</strong> of{' '}
            <strong className="text-slate-900 font-bold">{cases.length}</strong> cases
          </span>
          {(searchQuery || statusFilter !== 'ALL' || brandFilter !== 'ALL' || siteFilter !== 'ALL' || flaggedOnly || ruleFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setBrandFilter('ALL');
                setSiteFilter('ALL');
                setFlaggedOnly(false);
                setRuleFilter('');
              }}
              className="text-[#E11F26] hover:underline font-bold cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {/* Cases Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-[#E11F26] rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Loading warranty cases...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">No warranty cases found</p>
              <p className="text-xs text-slate-500">Try clearing your search filters or start a new repair ticket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">RO & Claim #</th>
                    <th className="py-3.5 px-4">Vehicle & VIN</th>
                    <th className="py-3.5 px-4">Fault Concern</th>
                    <th className="py-3.5 px-4">Site / Brand</th>
                    <th className="py-3.5 px-4">Technician</th>
                    <th className="py-3.5 px-4 text-center">Gates Progress</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.map((c) => {
                    const completed = c.checklistSummary?.completedMandatory ?? 0;
                    const total = c.checklistSummary?.totalMandatory ?? 1;
                    const gatePercent = Math.round((completed / (total || 1)) * 100);
                    const year = c.year ?? c.vehicle?.year ?? '';
                    const make = c.make ?? c.vehicle?.make ?? '';
                    const model = c.model ?? c.vehicle?.model ?? '';
                    const vin = c.vin ?? c.vehicle?.vin ?? '';
                    const concern = c.concernTitle ?? c.concern?.title ?? '';
                    const faultCat = c.faultCategory ?? c.concern?.faultCategory ?? '';

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <span className="font-mono font-bold text-slate-900 group-hover:text-[#E11F26] transition-colors">
                              {c.roNumber}
                            </span>
                            {c.claimNumber ? (
                              <p className="text-[10px] text-emerald-600 font-mono font-semibold mt-0.5">OEM: {c.claimNumber}</p>
                            ) : (
                              <p className="text-[10px] text-slate-400 mt-0.5">Unsubmitted</p>
                            )}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <p className="font-bold text-slate-900 truncate max-w-[180px]">
                              {year} {make} {model}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 tracking-wider truncate max-w-[180px]">
                              {vin}
                            </p>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <p className="font-medium text-slate-800 truncate max-w-[220px]" title={concern}>
                              {concern}
                            </p>
                            {faultCat && (
                              <span className="text-[10px] font-mono text-slate-600 border border-slate-200 bg-slate-50 inline-block mt-0.5 px-1.5 py-0.5 rounded">
                                {faultCat}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{c.brandName}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{c.siteName}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{c.technicianName}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <span>
                              {new Date(c.createdAt).toLocaleDateString('en-AU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                            <span>·</span>
                            <span className="text-slate-800 font-mono font-bold">
                              {new Date(c.createdAt).toLocaleTimeString('en-AU', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1 w-24">
                            <div className="flex items-center justify-between w-full text-[10px] font-mono">
                              <span className="text-[#E11F26] font-bold">
                                {completed}/{total}
                              </span>
                              <span className="text-slate-500 font-semibold">{gatePercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  gatePercent === 100
                                    ? 'bg-emerald-500'
                                    : gatePercent > 50
                                    ? 'bg-[#E11F26]'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${gatePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge status={c.status} size="sm" />
                          {c.status === 'Flagged' && (
                            <span className="block text-[10px] text-[#E11F26] font-mono font-bold mt-1">
                              Action Required
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {c.status === 'Flagged' && userRole === 'TECHNICIAN' ? (
                            <Link
                              href={`/cases/${c.id}?retake=true`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs transition-all shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              </svg>
                              <span>Retake Photo</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/cases/${c.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#E11F26] text-slate-700 hover:text-white font-bold text-xs transition-all border border-slate-300 hover:border-[#E11F26] shadow-xs"
                            >
                              <span>{c.status === 'Flagged' ? 'View Flags' : 'Review'}</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

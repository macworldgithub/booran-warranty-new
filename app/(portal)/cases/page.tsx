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
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  // Read URL params on mount (deep-link from dashboard)
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
    if (urlSiteId) setSiteFilter(urlSiteId);
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlFlagged === 'true') setFlaggedOnly(true);
    setInitializedFromUrl(true);
  }, []);

  useEffect(() => {
    if (initializedFromUrl) loadCases();
  }, [statusFilter, brandFilter, siteFilter, flaggedOnly, userRole, userName, initializedFromUrl]);

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

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const vin = c.vin || c.vehicle?.vin || '';
    const model = c.model || c.vehicle?.model || '';
    const concernTitle = c.concernTitle || c.concern?.title || '';
    const technicianName = c.technicianName || '';
    const roNumber = c.roNumber || '';
    return (
      roNumber.toLowerCase().includes(q) ||
      vin.toLowerCase().includes(q) ||
      model.toLowerCase().includes(q) ||
      technicianName.toLowerCase().includes(q) ||
      concernTitle.toLowerCase().includes(q)
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
          <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/80 via-[#1c080e] to-[#081225] border-2 border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.25)] flex flex-wrap items-center justify-between gap-4 animate-slideInLeft">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 animate-pulse flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-white flex items-center gap-2">
                  <span>Action Required: {flaggedCases.length} Ticket{flaggedCases.length > 1 ? 's' : ''} Returned For Evidence Retake</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono text-[10px] uppercase">
                    Spec §6
                  </span>
                </p>
                <p className="text-xs text-red-200/90 mt-0.5">
                  The warranty clerk identified blurry, wrong angle, or missing evidence. Please retake the required photos to return the ticket to review.
                </p>
              </div>
            </div>
            <Link
              href={`/cases/${flaggedCases[0].id}?retake=true`}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span>Retake RO {flaggedCases[0].roNumber} →</span>
            </Link>
          </div>
        )}

        {/* Filters Toolbar */}
        <div className="glass-card-static p-4 border border-[#1a56db]/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search RO, VIN, Model, Technician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 text-xs"
              />
              <svg className="w-4 h-4 absolute left-3 top-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-xs w-44"
            >
              <option value="ALL">All Statuses</option>
              <option value="Awaiting Review">Awaiting Review</option>
              <option value="Flagged">Flagged</option>
              <option value="Submitted">Submitted</option>
              <option value="Draft">Draft</option>
              <option value="Closed">Closed</option>
            </select>

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
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                flaggedOnly
                  ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-[#0d1b3e] border-[#1a56db]/20 text-[#cbd5e1] hover:border-[#1a56db]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>Flagged Queue Only</span>
            </button>
            <button
              onClick={loadCases}
              className="p-2 rounded-xl bg-[#0d1b3e] border border-[#1a56db]/20 text-[#64748b] hover:text-white hover:border-[#1a56db] transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cases Table */}
        <div className="glass-card-static border border-[#1a56db]/20 overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
              <p className="text-xs text-[#64748b]">Loading warranty cases...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#132952] flex items-center justify-center mx-auto text-[#64748b]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">No warranty cases found</p>
              <p className="text-xs text-[#64748b]">Try clearing your search filters or start a new repair ticket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#081225]/80 border-b border-[#1a56db]/20 text-[#64748b] uppercase tracking-wider font-semibold">
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
                <tbody className="divide-y divide-[#1a56db]/10">
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
                        className="hover:bg-[#132952]/50 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <span className="font-mono font-bold text-white group-hover:text-[#00f0ff] transition-colors">
                              {c.roNumber}
                            </span>
                            {c.claimNumber ? (
                              <p className="text-[10px] text-[#10b981] font-mono mt-0.5">OEM: {c.claimNumber}</p>
                            ) : (
                              <p className="text-[10px] text-[#64748b] mt-0.5">Unsubmitted</p>
                            )}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <p className="font-semibold text-white truncate max-w-[180px]">
                              {year} {make} {model}
                            </p>
                            <p className="font-mono text-[10px] text-[#64748b] tracking-wider truncate max-w-[180px]">
                              {vin}
                            </p>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link href={`/cases/${c.id}`} className="block">
                            <p className="font-medium text-[#cbd5e1] truncate max-w-[220px]" title={concern}>
                              {concern}
                            </p>
                            <span className="text-[10px] text-[#00f0ff] inline-block mt-0.5 font-medium">
                              {faultCat}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-white">{c.brandName}</p>
                          <p className="text-[10px] text-[#64748b] truncate max-w-[120px]">{c.siteName}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-white">{c.technicianName}</p>
                          <p className="text-[10px] text-[#64748b]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1 w-24">
                            <div className="flex items-center justify-between w-full text-[10px] font-mono">
                              <span className="text-[#00f0ff] font-bold">
                                {completed}/{total}
                              </span>
                              <span className="text-[#64748b]">{gatePercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#081225] rounded-full overflow-hidden border border-[#1a56db]/20">
                              <div
                                className={`h-full rounded-full ${
                                  gatePercent === 100
                                    ? 'bg-[#10b981]'
                                    : gatePercent > 50
                                    ? 'bg-[#1a56db]'
                                    : 'bg-[#f59e0b]'
                                }`}
                                style={{ width: `${gatePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge status={c.status} size="sm" />
                          {c.status === 'Flagged' && (
                            <span className="block text-[10px] text-red-400 font-mono font-bold mt-1">
                              Action Required
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {c.status === 'Flagged' && userRole === 'TECHNICIAN' ? (
                            <Link
                              href={`/cases/${c.id}?retake=true`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              </svg>
                              <span>Retake Photo</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/cases/${c.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a56db]/20 hover:bg-[#1a56db] text-[#00f0ff] hover:text-white font-semibold text-xs transition-all border border-[#1a56db]/30"
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

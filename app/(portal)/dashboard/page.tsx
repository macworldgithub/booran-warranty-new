'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/header';
import { StatCard } from '../../../components/stat-card';
import { AddBrandRuleModal } from '../../../components/add-brand-rule-modal';
import { api } from '../../../lib/api';
import { BrandPack, DashboardKPIs, FlagReasonStat, SitePerformance, WarrantyCase } from '../../../lib/types';

const FLAG_REASON_LABELS: Record<string, string> = {
  POOR_LIGHTING_BLUR: 'Blurry / Under-Exposed',
  MISSING_SHOT: 'Missing Evidence Shot',
  UNREADABLE_VIN: 'Unreadable VIN Plate',
  WRONG_ANGLE: 'Wrong Angle / Framing',
  NO_SERIAL: 'Missing Part Serial',
  NO_DTC: 'Missing DTC / Scanner',
  VIDEO_TOO_SHORT: 'Video Too Short',
  INCORRECT_MEDIA_TYPE: 'Incorrect Media Type',
  OTHER: 'Other Issue',
};

function FlaggedCasesModal({
  isOpen,
  onClose,
  siteName,
  siteId,
  cases,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  siteName: string;
  siteId: string | null;
  cases: WarrantyCase[];
  loading: boolean;
}) {
  const [modalSearch, setModalSearch] = useState('');

  const filteredCases = useMemo(() => {
    if (!modalSearch.trim()) return cases;
    const q = modalSearch.toLowerCase().trim();

    return cases.filter((c) => {
      const ro = c.roNumber?.toLowerCase() || '';
      const vin = (c.vin || c.vehicle?.vin || '').toLowerCase();
      const model = (c.model || c.vehicle?.model || '').toLowerCase();
      const make = (c.make || c.vehicle?.make || '').toLowerCase();
      const tech = (c.technicianName || '').toLowerCase();
      const claim = (c.claimNumber || '').toLowerCase();
      const concern = (c.concernTitle || c.concern?.title || '').toLowerCase();
      const activeFlags = (c.flagHistory || c.flags || []).filter((f: any) => !f.resolvedAt);
      const flagMatch = activeFlags.some((f: any) =>
        f.reasonCode?.toLowerCase().includes(q) ||
        f.instruction?.toLowerCase().includes(q) ||
        FLAG_REASON_LABELS[f.reasonCode]?.toLowerCase().includes(q) ||
        f.evidenceRuleKey?.toLowerCase().includes(q)
      );

      return ro.includes(q) || vin.includes(q) || model.includes(q) || make.includes(q) || tech.includes(q) || claim.includes(q) || concern.includes(q) || flagMatch;
    });
  }, [cases, modalSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E11F26]">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Flagged Cases — {siteName}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {cases.length} case{cases.length !== 1 ? 's' : ''} requiring evidence retake or clarification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Search Bar */}
        {cases.length > 0 && (
          <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by RO, VIN, Model, Technician, or Reason..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="input-field pl-8 pr-7 text-xs w-full py-1.5"
              />
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {modalSearch && (
                <button
                  onClick={() => setModalSearch('')}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
            {modalSearch && (
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {filteredCases.length} of {cases.length}
              </span>
            )}
          </div>
        )}

        {/* List */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">No flagged cases</p>
              <p className="text-xs text-slate-500">All cases for this rooftop are currently clear.</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-900">No flagged cases match "{modalSearch}"</p>
              <button
                onClick={() => setModalSearch('')}
                className="text-xs text-[#E11F26] hover:underline font-semibold"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            filteredCases.map((c) => {
              const vin = c.vin || c.vehicle?.vin || '';
              const model = c.model || c.vehicle?.model || '';
              const make = c.make || c.vehicle?.make || '';
              const year = c.year || c.vehicle?.year || '';
              const powertrain = c.powertrain || c.vehicle?.powertrain || '';
              const concernTitle = c.concernTitle || c.concern?.title || 'Warranty Claim';
              const activeFlags = (c.flagHistory || c.flags || []).filter((f: any) => !f.resolvedAt);
              const latestFlag = activeFlags[activeFlags.length - 1];

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
                >
                  {/* Top row: RO + Vehicle + Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">{c.roNumber}</span>
                        {c.claimNumber && (
                          <span className="text-[10px] font-mono text-slate-500">{c.claimNumber}</span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-50 text-[#E11F26] border border-red-200">
                          Flagged
                        </span>
                        {powertrain && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            powertrain === 'EV'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : powertrain === 'Hybrid' || powertrain === 'PHEV'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {powertrain}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1 truncate">
                        {year} {make} {model}
                        {vin && <span className="text-slate-400 ml-2 font-mono text-[10px]">VIN: {vin.slice(-8)}</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={concernTitle}>
                        {concernTitle}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-medium text-slate-600">{c.technicianName}</p>
                      <p className="text-[10px] text-slate-400">{c.brandName}</p>
                    </div>
                  </div>

                  {/* Flag Alert */}
                  {latestFlag && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-[#E11F26] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-[#E11F26]">
                              {FLAG_REASON_LABELS[latestFlag.reasonCode] || latestFlag.reasonCode}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              Gate: {latestFlag.evidenceRuleKey}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                            {latestFlag.instruction}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">
                            Flagged by {latestFlag.flaggedBy} · {new Date(latestFlag.flaggedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  <div className="flex items-center justify-end">
                    <Link
                      href={`/cases/${c.id}`}
                      className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[#E11F26] text-[11px] font-bold hover:bg-[#E11F26] hover:text-white transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Open Case Review & Evidence →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {cases.length} flagged case{cases.length !== 1 ? 's' : ''}
          </span>
          <Link
            href={siteId ? `/cases?siteId=${siteId}&flaggedOnly=true` : '/cases?flaggedOnly=true'}
            className="text-[11px] font-bold text-[#E11F26] hover:text-[#c81a20] hover:underline flex items-center gap-1"
            onClick={onClose}
          >
            View all in Cases CRM →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [flagReasons, setFlagReasons] = useState<FlagReasonStat[]>([]);
  const [sites, setSites] = useState<SitePerformance[]>([]);
  const [brandPacks, setBrandPacks] = useState<BrandPack[]>([]);
  const [loading, setLoading] = useState(true);

  // Flagged modal state
  const [flaggedModalOpen, setFlaggedModalOpen] = useState(false);
  const [flaggedModalSiteName, setFlaggedModalSiteName] = useState('');
  const [flaggedModalSiteId, setFlaggedModalSiteId] = useState<string | null>(null);
  const [flaggedCases, setFlaggedCases] = useState<WarrantyCase[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);

  // Add Brand Rule & CSV/Excel Import Modal state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState<'MANUAL' | 'IMPORT'>('MANUAL');

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiRes, flagRes, siteRes, packsRes] = await Promise.all([
          api.getKPIs(),
          api.getFlagReasons(),
          api.getSitePerformance(),
          api.getBrandPacks().catch(() => []),
        ]);
        setKpis(kpiRes);
        setFlagReasons(flagRes);
        setSites(siteRes);
        setBrandPacks(packsRes || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function openFlaggedModal(siteId: string | null, siteName: string) {
    setFlaggedModalSiteId(siteId);
    setFlaggedModalSiteName(siteName);
    setFlaggedModalOpen(true);
    setFlaggedLoading(true);
    try {
      const params: any = { flaggedOnly: true };
      if (siteId) params.siteId = siteId;
      const res = await api.getWarrantyCases(params);
      setFlaggedCases(res.data || (res as any));
    } catch (err) {
      console.error('Failed to load flagged cases:', err);
      setFlaggedCases([]);
    } finally {
      setFlaggedLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Group Warranty Operations Dashboard"
        subtitle="Live cross-dealership KPIs, First-Time Pass Rates, and Flag Analytics"
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* OEM Standards & Rules Quick Action Banner */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E11F26] shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">OEM Evidence Standards & Rules Engine</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold border border-emerald-200">
                  {brandPacks.length} Active Packs
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({brandPacks.reduce((acc, p) => acc + (p.rules?.length || 0), 0)} Total Gates)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Add required photo/video gates for technicians or bulk import warranty checklist guidelines from CSV/Excel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                setRuleModalMode('MANUAL');
                setRuleModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-[#E11F26] hover:bg-[#c81a20] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>➕ Add Brand Rule</span>
            </button>
            <button
              onClick={() => {
                setRuleModalMode('IMPORT');
                setRuleModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-[#E11F26] font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📁 Upload CSV / Excel</span>
            </button>
            <Link
              href="/brand-packs"
              className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <span>Rules CRM</span>
              <span>➔</span>
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Total Opened"
            value={kpis?.totalCasesOpened ?? '...'}
            subtext="This billing cycle"
            accent="blue"
            trend="+14%"
            trendPositive={true}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            label="Same-Day SLA"
            value={kpis ? `${kpis.submittedSameDayPercent}%` : '...'}
            subtext="Submitted <24h"
            accent="green"
            trend="+5.2%"
            trendPositive={true}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <div className="cursor-pointer" onClick={() => openFlaggedModal(null, 'All Rooftops')}>
            <StatCard
              label="Flagged Queue"
              value={kpis?.activeFlaggedCases ?? '...'}
              subtext="Requires retake/clarification"
              accent="red"
              trend="-3 cases"
              trendPositive={true}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>
          <StatCard
            label="Avg Velocity"
            value={kpis ? `${kpis.avgWorkshopToSubmittedHours}h` : '...'}
            subtext="Workshop to OEM portal"
            accent="cyan"
            trend="-45 min"
            trendPositive={true}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Rooftops"
            value={kpis?.activeRooftopsCount ?? 4}
            subtext="Booran VIC Sites"
            accent="gold"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            label="OEM Brands"
            value={kpis?.activeBrandsCount ?? 8}
            subtext="BYD, Kia, Hyundai..."
            accent="blue"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            }
          />
        </div>

        {/* Middle Section: Site Performance + Top Flag Reasons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sites Performance Table */}
          <div className="lg:col-span-2 glass-card-static p-6 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Dealership Rooftop Velocity & Quality</h3>
                  <p className="text-xs text-slate-500">Pass rates before clerk submission</p>
                </div>
                <span className="text-xs text-[#E11F26] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E11F26] animate-ping" />
                  Live Feed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold bg-slate-50">
                    <tr>
                      <th className="py-3 px-3">Site Rooftop</th>
                      <th className="py-3 px-3 text-center">Cases</th>
                      <th className="py-3 px-3 text-center">1st-Time Pass</th>
                      <th className="py-3 px-3 text-center">Flagged</th>
                      <th className="py-3 px-3 text-right">Avg Velocity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sites.map((site) => (
                      <tr key={site.siteId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-slate-900">
                          {site.siteName}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">
                          {site.totalCases}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                            {site.firstTimePassRate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {site.flaggedCount > 0 ? (
                            <button
                              onClick={() => openFlaggedModal(site.siteId, site.siteName)}
                              className="px-2.5 py-0.5 rounded-full bg-red-50 text-[#E11F26] font-bold cursor-pointer hover:bg-red-100 transition-all border border-red-200"
                              title={`View ${site.flaggedCount} flagged cases for ${site.siteName}`}
                            >
                              {site.flaggedCount}
                            </button>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-800">
                          {site.avgHoursToSubmit}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Group Average Pass Rate: <strong className="text-slate-900">92.8%</strong></span>
              <Link href="/sites" className="text-[#E11F26] hover:underline font-bold">
                Manage Rooftops →
              </Link>
            </div>
          </div>

          {/* Top Failure / Retake Reasons */}
          <div className="glass-card-static p-6 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Top Flagged Issues</h3>
                  <p className="text-xs text-slate-500">Technician training insights</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#E11F26]" />
              </div>

              <div className="space-y-4">
                {flagReasons.map((reason) => {
                  const pct = reason.percent ?? reason.percentage ?? 0;
                  return (
                    <div key={reason.reasonCode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={reason.label}>
                          {reason.label}
                        </span>
                        <span className="font-bold text-[#E11F26] font-mono">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-[#E11F26] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 text-right">{reason.count} occurrences</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <strong className="text-slate-900 block mb-0.5">Automated Gate Prevention:</strong>
              Mobile camera AI validation reduces blurry VIN & odometer submissions before repair begins.
            </div>
          </div>
        </div>

        {/* Quick Review Portal Banner */}
        <div className="glass-card p-6 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 bg-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E11F26]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Warranty Clerk Review Queue</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Review pending workshop cases, audit BYD Attachment A checklist gates, and export OEM ZIP packs.
              </p>
            </div>
          </div>
          <Link
            href="/cases"
            className="btn-primary text-xs py-2.5 px-6 whitespace-nowrap shadow-sm"
          >
            Open Live Cases Queue →
          </Link>
        </div>

        {/* Flagged Cases Modal */}
        <FlaggedCasesModal
          isOpen={flaggedModalOpen}
          onClose={() => setFlaggedModalOpen(false)}
          siteName={flaggedModalSiteName}
          siteId={flaggedModalSiteId}
          cases={flaggedCases}
          loading={flaggedLoading}
        />

        {/* Add Brand Rule & Spreadsheet Import Modal */}
        <AddBrandRuleModal
          isOpen={ruleModalOpen}
          onClose={() => setRuleModalOpen(false)}
          initialMode={ruleModalMode}
          onSuccess={() => {
            // refresh brand packs data
            api.getBrandPacks().then((data) => setBrandPacks(data)).catch(() => {});
          }}
        />
      </div>
    </div>
  );
}

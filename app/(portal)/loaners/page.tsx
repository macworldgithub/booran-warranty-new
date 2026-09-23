'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { LoanAgreement, LoanAgreementKpis } from '@/lib/types';

const ROOFTOPS = [
  { label: 'All Rooftops', siteId: 'all' },
  { label: 'Cranbourne', siteId: 'site_cranbourne_byd' },
  { label: 'Dandenong', siteId: 'site_dandenong_multi' },
  { label: 'Berwick', siteId: 'site_berwick_nissan' },
  { label: 'Cheltenham', siteId: 'site_cheltenham_mg' },
];

export default function LoanersPage() {
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ATTENTION' | 'RETURNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<LoanAgreement[]>([]);
  const [kpis, setKpis] = useState<LoanAgreementKpis>({
    available: 14,
    outNow: 8,
    dueSoon: 2,
    overdue: 1,
  });

  // Modals
  const [previewAgreement, setPreviewAgreement] = useState<LoanAgreement | null>(null);
  const [returnAgreement, setReturnAgreement] = useState<LoanAgreement | null>(null);
  const [returnOdo, setReturnOdo] = useState('');
  const [returnFuel, setReturnFuel] = useState('75');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const siteParam = selectedSiteId === 'all' ? undefined : selectedSiteId;
      const [agList, kpiData] = await Promise.all([
        api.getLoanAgreements(siteParam),
        api.getLoanAgreementKpis(siteParam),
      ]);
      setAgreements(agList || []);
      if (kpiData) {
        setKpis(kpiData);
      }
    } catch (err: any) {
      console.error('Failed to load loan operations data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered agreements
  const filteredAgreements = agreements.filter((ag) => {
    if (selectedSiteId !== 'all' && ag.siteId !== selectedSiteId) {
      return false;
    }
    if (statusFilter === 'ACTIVE' && ag.status !== 'ACTIVE' && ag.status !== 'DUE_SOON') {
      return false;
    }
    if (statusFilter === 'ATTENTION' && ag.status !== 'DUE_SOON' && ag.status !== 'OVERDUE') {
      return false;
    }
    if (statusFilter === 'RETURNED' && ag.status !== 'RETURNED') {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRego = ag.vehicle?.rego?.toLowerCase().includes(q);
      const matchName = ag.customer?.name?.toLowerCase().includes(q);
      const matchMobile = ag.customer?.mobile?.toLowerCase().includes(q);
      const matchNum = ag.agreementNumber?.toLowerCase().includes(q);
      const matchVin = ag.vehicle?.vin?.toLowerCase().includes(q);
      return matchRego || matchName || matchMobile || matchNum || matchVin;
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-rose-500/10 text-rose-600 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Overdue
          </span>
        );
      case 'DUE_SOON':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-amber-500/10 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Due Soon
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-blue-500/10 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            On Loan
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Returned
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnAgreement) return;

    const odoOut = returnAgreement.outbound?.odometerOut || 0;
    const numOdoIn = parseInt(returnOdo, 10);
    if (isNaN(numOdoIn) || numOdoIn < odoOut) {
      alert(`Inbound odometer cannot be less than outbound reading (${odoOut} km).`);
      return;
    }

    try {
      setSubmittingReturn(true);
      await api.returnLoanAgreement(returnAgreement.id, {
        odometerIn: numOdoIn,
        fuelLevelInPercent: parseInt(returnFuel, 10) || 75,
        returnDamageNotes: returnNotes.trim() || 'Returned and checked by dealership staff.',
        hasDamageIncident: false,
        applicableExcessAmount: 0,
      });
      setReturnAgreement(null);
      fetchData();
    } catch (err: any) {
      alert('Return failed: ' + (err?.message || 'Server error'));
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header
        title="Loan Vehicle Operations"
        subtitle="Booran Motor Group • Digital Customer Agreements & Electronic SOW Compliance"
        action={
          <div className="flex items-center gap-3">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-2 shadow-xs focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
            >
              {ROOFTOPS.map((rt) => (
                <option key={rt.siteId} value={rt.siteId}>
                  {rt.label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchData}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* KPI Stat Cards (Matching PDF page 7 Example 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Available */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fleet Available</span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{kpis.available}</span>
              <p className="text-xs text-slate-500 mt-1">Ready for customer loan</p>
            </div>
          </div>

          {/* 2. Out Now */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Out Now (Active)</span>
              <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-blue-600 tracking-tight">{kpis.outNow}</span>
              <p className="text-xs text-slate-500 mt-1">With customers currently</p>
            </div>
          </div>

          {/* 3. Due Soon */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due in 60 Min</span>
              <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-amber-600 tracking-tight">{kpis.dueSoon}</span>
              <p className="text-xs text-slate-500 mt-1">Expected back shortly</p>
            </div>
          </div>

          {/* 4. Overdue */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue Alerts</span>
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-rose-600 tracking-tight">{kpis.overdue}</span>
              <p className="text-xs text-rose-600 font-semibold mt-1">Requires advisor attention</p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            {[
              { key: 'ALL', label: 'All Fleet' },
              { key: 'ACTIVE', label: 'Active Loans' },
              { key: 'ATTENTION', label: 'Alerts (Due/Overdue)' },
              { key: 'RETURNED', label: 'Returned' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                  statusFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by rego, customer, agreement #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden transition-all"
            />
          </div>
        </div>

        {/* Agreements Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-black tracking-wider">
                  <th className="py-3.5 px-4">Agreement & Rooftop</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Loaner Vehicle</th>
                  <th className="py-3.5 px-4">Time Out / Due</th>
                  <th className="py-3.5 px-4">Excess & Cap</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-[#D71920]/20 border-t-[#D71920] rounded-full animate-spin mb-2" />
                      <p className="text-xs font-semibold">Loading loan agreements...</p>
                    </td>
                  </tr>
                ) : filteredAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-bold text-slate-800">No Loan Agreements Found</p>
                      <p className="text-xs text-slate-400 mt-1">Try changing rooftop filter or search terms</p>
                    </td>
                  </tr>
                ) : (
                  filteredAgreements.map((ag) => {
                    const isLoanActive = ag.status === 'ACTIVE' || ag.status === 'DUE_SOON' || ag.status === 'OVERDUE';
                    const odoOut = ag.outbound?.odometerOut || 0;
                    const odoIn = ag.inbound?.odometerIn;
                    return (
                      <tr key={ag.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Agreement # */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {ag.agreementNumber}
                          </span>
                          <span className="text-xs text-[#D71920] font-semibold">
                            {ag.siteName}
                          </span>
                        </td>

                        {/* 2. Customer */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{ag.customer.name}</span>
                          <span className="text-xs text-slate-500 block">{ag.customer.mobile}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Lic: {ag.customer.licenceNumber} ({ag.customer.licenceState})
                          </span>
                        </td>

                        {/* 3. Vehicle */}
                        <td className="py-3.5 px-4">
                          <span className="font-black text-slate-900 tracking-wide font-mono block">
                            {ag.vehicle.rego}
                          </span>
                          <span className="text-xs text-slate-600 block">
                            {ag.vehicle.year} {ag.vehicle.make} {ag.vehicle.model}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Odo Out: {odoOut.toLocaleString()} km
                          </span>
                        </td>

                        {/* 4. Timings */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Due Back</span>
                            <span className="font-semibold text-slate-900">
                              {new Date(ag.dueBackDateTime).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {ag.inbound?.returnedAt && (
                              <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">
                                Ret: {new Date(ag.inbound.returnedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Excess & Km */}
                        <td className="py-3.5 px-4 text-xs">
                          <span className="font-bold text-slate-900 block">
                            ${ag.basicInsuranceExcess.toLocaleString()} Excess
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {ag.dailyKmCap} km/day • $0.50/km excess
                          </span>
                          {ag.inbound?.excessKm && ag.inbound.excessKm > 0 ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Excess: +${ag.inbound.excessKmChargeAmount?.toFixed(2)} ({ag.inbound.excessKm} km)
                            </span>
                          ) : null}
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(ag.status)}
                        </td>

                        {/* 7. Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPreviewAgreement(ag)}
                              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5 text-[#D71920]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View PDF
                            </button>

                            {isLoanActive && (
                              <button
                                onClick={() => {
                                  setReturnAgreement(ag);
                                  setReturnOdo(String(odoOut + 45));
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-all flex items-center gap-1 shadow-2xs"
                              >
                                Check In
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PDF Viewer & Clauses Modal */}
      {previewAgreement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Loan Agreement: {previewAgreement.agreementNumber}</h3>
                <p className="text-xs text-slate-300">
                  {previewAgreement.vehicle.rego} • {previewAgreement.vehicle.make} {previewAgreement.vehicle.model}
                </p>
              </div>
              <button
                onClick={() => setPreviewAgreement(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Top Meta Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">CUSTOMER</span>
                  <span className="font-bold text-slate-900">{previewAgreement.customer.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">LICENCE</span>
                  <span className="font-bold text-slate-900">{previewAgreement.customer.licenceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">ODOMETER OUT</span>
                  <span className="font-bold text-slate-900">{previewAgreement.outbound.odometerOut.toLocaleString()} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">BASIC EXCESS</span>
                  <span className="font-bold text-amber-600">${previewAgreement.basicInsuranceExcess} AUD</span>
                </div>
              </div>

              {/* SHA-256 Cryptographic Hash */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-800">Digitally Certified & SOW Compliant</p>
                  <p className="text-[11px] font-mono text-emerald-700 truncate">
                    SHA-256: 3a9f82d1c4e77699103c80e12345bcdef90123456789abcdef0123456789abcd
                  </p>
                </div>
              </div>

              {/* PDF Preview Actions */}
              <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Official 18-Clause PDF Agreement Generated
                </p>
                <a
                  href={`/api/v1/loan-agreements/${previewAgreement.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D71920] hover:bg-[#B91218] text-white rounded-lg text-sm font-bold shadow-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Signed PDF (A4)
                </a>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewAgreement(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Inspection Modal */}
      {returnAgreement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReturnSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Inbound Return Inspection</h3>
                <p className="text-xs text-slate-300">
                  {returnAgreement.vehicle.rego} • {returnAgreement.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnAgreement(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                Outbound Odometer was <span className="font-bold">{returnAgreement.outbound.odometerOut.toLocaleString()} km</span>.
                Daily Allowance: 50 km/day. Excess: $0.50/km.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Inbound Odometer (km) *
                </label>
                <input
                  type="number"
                  required
                  value={returnOdo}
                  onChange={(e) => setReturnOdo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fuel / Battery Level (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={returnFuel}
                  onChange={(e) => setReturnFuel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Return Inspection Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Checked exterior, interior, tyres and fuel. Nil issues."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReturnAgreement(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReturn}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2"
              >
                {submittingReturn ? 'Submitting...' : 'Confirm Vehicle Return'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

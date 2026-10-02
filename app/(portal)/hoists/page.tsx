'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Hoist, HoistInspection, HoistSummary, HoistFacility, HoistStatus, InspectionStatus } from '@/lib/types';
import { useToast } from '@/components/toast';

const CHECKLIST_ITEMS_DEF = [
  { id: 'item_1', title: 'Operating controls & emergency stop functioning' },
  { id: 'item_2', title: 'Safety locks engaging and disengaging cleanly' },
  { id: 'item_3', title: 'Wire ropes, chains & pulleys undamaged and properly tensioned' },
  { id: 'item_4', title: 'Hydraulic lines, cylinders & fittings free of leaks' },
  { id: 'item_5', title: 'Lifting arms, rubber pads & adapters intact and secure' },
  { id: 'item_6', title: 'Overhead limit switch functioning (if equipped)' },
  { id: 'item_7', title: 'Floor area clean, dry & free of obstructions / slip hazards' },
  { id: 'item_8', title: 'Hoist structural integrity (anchors, posts, carriages) no cracks/damage' },
  { id: 'item_9', title: 'Warning labels and load capacity placards legible' },
];

export default function HoistsPage() {
  const { showToast } = useToast();
  const [hoists, setHoists] = useState<Hoist[]>([]);
  const [summary, setSummary] = useState<HoistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [facilityFilter, setFacilityFilter] = useState<HoistFacility>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedHoist, setSelectedHoist] = useState<Hoist | null>(null);
  const [inspections, setInspections] = useState<HoistInspection[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectHoist, setInspectHoist] = useState<Hoist | null>(null);
  const [checklistValues, setChecklistValues] = useState<Record<string, 'PASS' | 'FAULT' | 'NA'>>({});
  const [faultNotes, setFaultNotes] = useState('');
  const [faultSeverity, setFaultSeverity] = useState<'NONE' | 'MINOR' | 'MODERATE' | 'CRITICAL'>('NONE');
  const [lockoutTagout, setLockoutTagout] = useState(false);
  const [submittingInspection, setSubmittingInspection] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [hoistsData, summaryData] = await Promise.all([
        api.getHoists(facilityFilter === 'all' ? undefined : facilityFilter),
        api.getHoistSummary(facilityFilter === 'all' ? undefined : facilityFilter),
      ]);
      setHoists(hoistsData || []);
      setSummary(summaryData || null);
    } catch (err: any) {
      console.error('Failed to load hoists:', err);
      showToast('Failed to load hoist data from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [facilityFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredHoists = useMemo(() => {
    return hoists.filter((h) => {
      if (facilityFilter !== 'all' && h.facility !== facilityFilter) return false;
      if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = h.name.toLowerCase().includes(q);
        const matchNum = String(h.hoistNumber).includes(q);
        const matchBrand = h.brand?.toLowerCase().includes(q);
        const matchType = h.type?.toLowerCase().includes(q);
        return matchName || matchNum || matchBrand || matchType;
      }
      return true;
    });
  }, [hoists, facilityFilter, statusFilter, searchQuery]);

  const openHistory = async (hoist: Hoist) => {
    setSelectedHoist(hoist);
    setShowHistoryModal(true);
    setLoadingInspections(true);
    try {
      const records = await api.getHoistInspections({ hoistId: hoist.id, limit: 30 });
      setInspections(records || []);
    } catch (err) {
      console.error('Failed to fetch hoist inspections:', err);
      showToast('Failed to load inspection history', 'error');
    } finally {
      setLoadingInspections(false);
    }
  };

  const openInspectModal = (hoist: Hoist) => {
    setInspectHoist(hoist);
    const initial: Record<string, 'PASS' | 'FAULT' | 'NA'> = {};
    CHECKLIST_ITEMS_DEF.forEach((item) => {
      initial[item.id] = 'PASS';
    });
    setChecklistValues(initial);
    setFaultNotes('');
    setFaultSeverity('NONE');
    setLockoutTagout(false);
    setShowInspectModal(true);
  };

  const handleToggleChecklist = (itemId: string, status: 'PASS' | 'FAULT' | 'NA') => {
    setChecklistValues((prev) => {
      const next = { ...prev, [itemId]: status };
      const hasFault = Object.values(next).some((s) => s === 'FAULT');
      if (hasFault && faultSeverity === 'NONE') {
        setFaultSeverity('MINOR');
      } else if (!hasFault) {
        setFaultSeverity('NONE');
      }
      return next;
    });
  };

  const handleSubmitInspection = async () => {
    if (!inspectHoist) return;
    const hasFault = Object.values(checklistValues).some((s) => s === 'FAULT');
    if (hasFault && !faultNotes.trim()) {
      showToast('Please provide notes describing the identified fault.', 'warning');
      return;
    }

    try {
      setSubmittingInspection(true);
      const userProfileStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      const userProfile = userProfileStr ? JSON.parse(userProfileStr) : null;

      const checklistItems = CHECKLIST_ITEMS_DEF.map((item) => ({
        itemId: item.id,
        title: item.title,
        status: checklistValues[item.id] || 'PASS',
      }));

      const overallStatus: InspectionStatus = lockoutTagout
        ? 'TAGGED_OUT'
        : hasFault
          ? 'FAULT_IDENTIFIED'
          : 'PASS';

      await api.submitHoistInspection({
        hoistId: inspectHoist.id,
        inspectorId: userProfile?.id || 'usr_portal_admin',
        inspectorName: userProfile?.name || 'Workshop Controller',
        inspectorRole: userProfile?.role || 'ADMIN',
        shiftDate: new Date().toISOString().slice(0, 10),
        shiftType: 'DAILY',
        status: overallStatus,
        checklistItems,
        faultNotes: hasFault ? faultNotes : undefined,
        faultSeverity: hasFault ? faultSeverity : 'NONE',
        lockoutTagoutApplied: lockoutTagout,
        photos: [],
      });

      showToast(`Daily inspection recorded for ${inspectHoist.name}`, 'success');
      setShowInspectModal(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to submit inspection:', err);
      showToast('Error recording inspection', 'error');
    } finally {
      setSubmittingInspection(false);
    }
  };

  const handleToggleLockout = async (hoist: Hoist) => {
    const nextLockout = !hoist.lockoutTagoutActive;
    const nextStatus: HoistStatus = nextLockout ? 'OUT_OF_SERVICE' : 'OPERATIONAL';
    try {
      await api.updateHoist(hoist.id, {
        lockoutTagoutActive: nextLockout,
        status: nextStatus,
        activeFaultNotes: nextLockout ? 'Tagged Out / Out of Service by Workshop Management' : '',
      });
      showToast(
        nextLockout
          ? `${hoist.name} has been TAGGED OUT and marked OUT OF SERVICE.`
          : `${hoist.name} returned to OPERATIONAL service.`,
        nextLockout ? 'warning' : 'success'
      );
      loadData();
    } catch (err) {
      console.error('Failed to toggle lockout:', err);
      showToast('Failed to update hoist status', 'error');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f8fafc]">
      <Header
        title="Daily Hoist Inspections"
        subtitle="Mandatory Pre-Shift Equipment Safety Checklists & Compliance Audits (South Morang 23 Hoists)"
        action={
          <button
            onClick={() => loadData()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs tracking-wide shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Status
          </button>
        }
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Total Hoists</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.totalHoists ?? hoists.length}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Across 2 South Morang workshops</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              23
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 tracking-wider uppercase">Inspected Today</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{summary?.inspectedToday ?? 0}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Passed pre-shift checks</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              ✓
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-600 tracking-wider uppercase">Inspection Due</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{summary?.pendingToday ?? 0}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Pending tech check this shift</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              ⏳
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-600 tracking-wider uppercase">Fault / Tagged Out</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                {(summary?.faultIdentified ?? 0) + (summary?.outOfService ?? 0)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {summary?.outOfService ?? 0} Tagged Out · {summary?.faultIdentified ?? 0} Faults
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
              ⚠️
            </div>
          </div>
        </div>

        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setFacilityFilter('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                facilityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Workshops (23 Hoists)
            </button>
            <button
              onClick={() => setFacilityFilter('hyundai_chery')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                facilityFilter === 'hyundai_chery'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hyundai & Chery Workshop (11 Hoists)
            </button>
            <button
              onClick={() => setFacilityFilter('byd_kia')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                facilityFilter === 'byd_kia'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BYD & Kia Workshop (12 Hoists)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hoist bay, type, capacity..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 w-56"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-semibold bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="FAULT_IDENTIFIED">Fault Identified</option>
              <option value="OUT_OF_SERVICE">Out of Service / Tagged Out</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#E11F26]/20 border-t-[#E11F26] rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Hoist Inventory & Shift Logs...</p>
          </div>
        ) : filteredHoists.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-base font-bold text-slate-700">No Hoists Matching Filters</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search or status filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHoists.map((hoist) => {
              const isCheckedToday =
                hoist.lastInspectionDate &&
                new Date(hoist.lastInspectionDate).toISOString().slice(0, 10) === todayStr;

              const isTaggedOut = hoist.lockoutTagoutActive || hoist.status === 'OUT_OF_SERVICE';
              const isFault = hoist.status === 'FAULT_IDENTIFIED';

              return (
                <div
                  key={hoist.id}
                  className={`rounded-2xl border transition-all duration-200 bg-white shadow-xs overflow-hidden ${
                    isTaggedOut
                      ? 'border-rose-300 ring-2 ring-rose-100'
                      : isFault
                        ? 'border-amber-300 ring-2 ring-amber-100'
                        : isCheckedToday
                          ? 'border-emerald-200'
                          : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`px-5 py-3.5 flex items-center justify-between border-b ${
                      isTaggedOut
                        ? 'bg-rose-50/80 border-rose-100 text-rose-900'
                        : isFault
                          ? 'bg-amber-50/80 border-amber-100 text-amber-900'
                          : isCheckedToday
                            ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900'
                            : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center font-black text-xs text-slate-900 border border-slate-200">
                        {hoist.hoistNumber}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm tracking-tight">{hoist.name}</h4>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">{hoist.facilityName}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-xs ${
                        isTaggedOut
                          ? 'bg-rose-600 text-white border-rose-600'
                          : isFault
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-emerald-600 text-white border-emerald-600'
                      }`}
                    >
                      {isTaggedOut ? 'TAGGED OUT' : isFault ? 'FAULT' : 'OPERATIONAL'}
                    </span>
                  </div>

                  <div className="p-5 space-y-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Type & Capacity:</span>
                      <span className="font-bold text-slate-800">{hoist.type}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Brand Alignment:</span>
                      <span className="font-bold text-slate-800">{hoist.brand}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift Inspection</p>
                        <p className={`text-xs font-black mt-0.5 ${isCheckedToday ? 'text-emerald-700' : 'text-amber-600'}`}>
                          {isCheckedToday ? '✓ Checked Today' : '⏳ Inspection Due'}
                        </p>
                      </div>
                      {hoist.lastInspectedByName && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">By: {hoist.lastInspectedByName}</p>
                          <p className="text-[10px] text-slate-400">
                            {hoist.lastInspectionDate ? new Date(hoist.lastInspectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    {hoist.activeFaultNotes && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                        <strong className="block text-rose-900 font-bold mb-0.5">Active Note / Fault:</strong>
                        {hoist.activeFaultNotes}
                      </div>
                    )}

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => openInspectModal(hoist)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Inspect
                      </button>

                      <button
                        onClick={() => openHistory(hoist)}
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                        title="View Inspection History"
                      >
                        History
                      </button>

                      <button
                        onClick={() => handleToggleLockout(hoist)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          isTaggedOut
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                        }`}
                        title={isTaggedOut ? 'Return Hoist to Service' : 'Apply Lockout / Tagout'}
                      >
                        {isTaggedOut ? 'Unlock' : 'Tag Out'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showHistoryModal && selectedHoist && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">{selectedHoist.name} — Inspection Audit Trail</h3>
                <p className="text-xs text-slate-300 font-medium">
                  {selectedHoist.facilityName} · {selectedHoist.brand} ({selectedHoist.type})
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingInspections ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-bold">Loading past inspection records...</p>
                </div>
              ) : inspections.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No previous inspection records found for this hoist.
                </div>
              ) : (
                inspections.map((insp) => (
                  <div key={insp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            insp.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : insp.status === 'TAGGED_OUT'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {insp.status}
                        </span>
                        <span className="text-xs font-bold text-slate-900">Shift Date: {insp.shiftDate}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Inspector: <strong>{insp.inspectorName}</strong> ({insp.inspectorRole}) · {new Date(insp.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {insp.faultNotes && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                        <strong>Fault Notes:</strong> {insp.faultNotes} (Severity: {insp.faultSeverity})
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      {insp.checklistItems?.map((item) => (
                        <div key={item.itemId} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-100">
                          <span className="text-slate-600 truncate mr-2">{item.title}</span>
                          <span
                            className={`font-black text-[10px] px-1.5 py-0.5 rounded ${
                              item.status === 'PASS'
                                ? 'text-emerald-700 bg-emerald-50'
                                : item.status === 'FAULT'
                                  ? 'text-rose-700 bg-rose-50'
                                  : 'text-slate-500 bg-slate-50'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInspectModal && inspectHoist && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">Pre-Shift Hoist Checklist — {inspectHoist.name}</h3>
                <p className="text-xs text-slate-300 font-medium">
                  {inspectHoist.facilityName} · {inspectHoist.type} ({inspectHoist.capacityKg} kg)
                </p>
              </div>
              <button
                onClick={() => setShowInspectModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Verify each of the 9 required safety check items before operating this hoist for the current shift.
              </p>

              <div className="space-y-2">
                {CHECKLIST_ITEMS_DEF.map((item, idx) => {
                  const val = checklistValues[item.id] || 'PASS';
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        val === 'FAULT'
                          ? 'bg-rose-50/70 border-rose-200'
                          : val === 'PASS'
                            ? 'bg-white border-slate-200'
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 leading-snug">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id, 'PASS')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            val === 'PASS'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id, 'FAULT')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            val === 'FAULT'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Fault
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id, 'NA')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            val === 'NA'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.values(checklistValues).some((s) => s === 'FAULT') && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Fault Description & Tagout</h4>
                  <div>
                    <label className="block text-xs font-bold text-rose-900 mb-1">Fault Description *</label>
                    <textarea
                      value={faultNotes}
                      onChange={(e) => setFaultNotes(e.target.value)}
                      placeholder="Describe the issue in detail (e.g., hydraulic hose seepage, safety latch sluggish)..."
                      className="w-full p-2.5 text-xs rounded-xl border border-rose-300 focus:outline-none focus:border-rose-500 bg-white"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1">Severity Level</label>
                      <select
                        value={faultSeverity}
                        onChange={(e) => setFaultSeverity(e.target.value as any)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-rose-300 bg-white font-semibold text-rose-900"
                      >
                        <option value="MINOR">Minor (Observation / Monitor)</option>
                        <option value="MODERATE">Moderate (Needs Service Soon)</option>
                        <option value="CRITICAL">Critical (Unsafe for Use)</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-3">
                      <input
                        type="checkbox"
                        checked={lockoutTagout}
                        onChange={(e) => setLockoutTagout(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-bold text-rose-900">Apply Lockout / Tag Out (Out of Service)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingInspection}
                onClick={handleSubmitInspection}
                className="px-5 py-2 rounded-xl bg-[#E11F26] hover:bg-[#c9181f] text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submittingInspection ? 'Submitting...' : 'Sign & Submit Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

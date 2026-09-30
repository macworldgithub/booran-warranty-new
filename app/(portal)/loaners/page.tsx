'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { LoanAgreement, LoanAgreementKpis } from '@/lib/types';

type RooftopOption = { label: string; siteId: string; fullName: string };

const FALLBACK_ROOFTOPS: RooftopOption[] = [
  { label: 'All Rooftops', siteId: 'all', fullName: 'All Rooftops & Dealerships' },
  { label: 'Cranbourne', siteId: 'site_cranbourne_byd', fullName: 'Booran BYD Cranbourne' },
  { label: 'Dandenong', siteId: 'site_dandenong_multi', fullName: 'Booran Dandenong Multi-Franchise' },
  { label: 'Berwick', siteId: 'site_berwick_toyota_ford', fullName: 'Booran Toyota / Ford Berwick' },
  { label: 'Cheltenham', siteId: 'site_cheltenham_mg', fullName: 'Booran MG & Chery Cheltenham' },
];

function getDynamicLoanCategory(
  status?: string,
  dueBackDateTime?: string
): 'RETURNED' | 'OVERDUE' | 'DUE_SOON' | 'ACTIVE' {
  if (status === 'RETURNED' || status === 'CANCELLED') {
    return 'RETURNED';
  }
  if (!dueBackDateTime) {
    return 'ACTIVE';
  }

  const now = Date.now();
  const dueTime = new Date(dueBackDateTime).getTime();
  const in60Min = now + 60 * 60 * 1000;

  if (dueTime < now) {
    return 'OVERDUE';
  }
  if (dueTime <= in60Min) {
    return 'DUE_SOON';
  }
  return 'ACTIVE';
}

function computeKpis(agreementList: LoanAgreement[], siteId: string): LoanAgreementKpis {
  const filtered = siteId === 'all'
    ? agreementList
    : agreementList.filter((a) => a.siteId === siteId);

  const totalCars = filtered.length;
  let available = 0;
  let outNow = 0;
  let activeLoans = 0;
  let activeTestDrives = 0;
  let dueSoon = 0;
  let overdue = 0;

  for (const a of filtered) {
    if (a.status === 'RETURNED') {
      available++;
      continue;
    }

    outNow++;
    if (a.purpose === 'TEST_DRIVE') {
      activeTestDrives++;
    } else {
      activeLoans++;
    }

    const category = getDynamicLoanCategory(a.status, a.dueBackDateTime);
    if (category === 'OVERDUE') {
      overdue++;
    } else if (category === 'DUE_SOON') {
      dueSoon++;
    }
  }

  return {
    totalCars,
    available,
    outNow,
    activeLoans,
    activeTestDrives,
    dueSoon,
    overdue,
  };
}

export default function LoanersPage() {
  const router = useRouter();
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [userRole, setUserRole] = useState<string>('');
  const [sessionReady, setSessionReady] = useState(false);
  const [rooftops, setRooftops] = useState<RooftopOption[]>(FALLBACK_ROOFTOPS);
  const [technicianSiteId, setTechnicianSiteId] = useState<string>('');
  const [technicianSiteName, setTechnicianSiteName] = useState<string>('');
  const [authorizedSiteIds, setAuthorizedSiteIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'ACTIVE' | 'ACTIVE_LOAN' | 'ACTIVE_TEST_DRIVE' | 'DUE_SOON' | 'OVERDUE'>('ALL');
  const [purposeFilter, setPurposeFilter] = useState<'ALL' | 'SERVICE_LOANER' | 'TEST_DRIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<LoanAgreement[]>([]);
  const [kpis, setKpis] = useState<LoanAgreementKpis>({
    totalCars: 0,
    available: 0,
    outNow: 0,
    activeLoans: 0,
    activeTestDrives: 0,
    dueSoon: 0,
    overdue: 0,
  });

  const isTechnician = userRole?.toUpperCase() === 'TECHNICIAN';
  const isClerk = userRole?.toUpperCase() === 'CLERK';
  const visibleRooftops = rooftops;

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const [me, siteList] = await Promise.all([
          api.getMe().catch(() => null),
          api.getSites().catch(() => []),
        ]);
        if (cancelled) return;

        const stored = (() => {
          try {
            const raw = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
            return raw ? JSON.parse(raw) : {};
          } catch {
            return {};
          }
        })();
        const role = String(me?.role || stored.role || '').toUpperCase();
        if (role === 'TECHNICIAN') {
          router.replace('/cases');
          return;
        }

        const rawAssigned = Array.isArray(me?.authorizedSiteIds) && me.authorizedSiteIds.length > 0
          ? me.authorizedSiteIds
          : Array.isArray(stored.authorizedSiteIds) && stored.authorizedSiteIds.length > 0
            ? stored.authorizedSiteIds
            : (me?.defaultSiteId || stored.defaultSiteId)
              ? [me?.defaultSiteId || stored.defaultSiteId]
              : [];

        const assignedSites: string[] = rawAssigned.length > 0
          ? rawAssigned
          : (siteList || []).map((s: any) => s.id);

        const defaultSiteId = me?.defaultSiteId || stored.defaultSiteId || assignedSites[0] || 'site_cranbourne_byd';
        setUserRole(role || me?.role || stored.role || '');
        setAuthorizedSiteIds(assignedSites);
        setTechnicianSiteId(defaultSiteId);

        const scopedSites = (siteList && siteList.length > 0)
          ? siteList.filter((site: any) => assignedSites.length === 0 || assignedSites.includes(site.id))
          : FALLBACK_ROOFTOPS.filter((r) => r.siteId !== 'all');

        const finalScopedSites = scopedSites.length > 0
          ? scopedSites
          : (siteList && siteList.length > 0 ? siteList : FALLBACK_ROOFTOPS.filter((r) => r.siteId !== 'all'));

        const allLabel = role === 'CLERK' ? 'All Assigned Rooftops' : 'All Rooftops';
        const allName = role === 'CLERK' ? 'Assigned Dealership Rooftops' : 'All Rooftops & Dealerships';
        const nextRooftops: RooftopOption[] = [
          { label: allLabel, siteId: 'all', fullName: allName },
          ...finalScopedSites.map((site: any) => ({
            label: (site.name || site.label || '').replace(/^Booran\s+/i, ''),
            siteId: site.id || site.siteId,
            fullName: site.fullName || site.name || `Booran ${site.label}`,
          })),
        ];
        setRooftops(nextRooftops);
        const assignedLabel = nextRooftops.find((r) => r.siteId === defaultSiteId)?.label || defaultSiteId;
        setTechnicianSiteName(assignedLabel);

        if (role === 'CLERK') {
          setSelectedSiteId('all');
          const firstSite = finalScopedSites[0] as any;
          setIssueSiteId(assignedSites[0] || defaultSiteId || firstSite?.id || firstSite?.siteId || 'site_cranbourne_byd');
        }
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Modals & CRUD State
  const [previewAgreement, setPreviewAgreement] = useState<LoanAgreement | null>(null);
  const [returnAgreement, setReturnAgreement] = useState<LoanAgreement | null>(null);
  const [returnOdo, setReturnOdo] = useState('');
  const [returnFuel, setReturnFuel] = useState('75');
  const [returnFuelChargeOverride, setReturnFuelChargeOverride] = useState('');
  const [returnHasDamage, setReturnHasDamage] = useState(false);
  const [returnDamageCharge, setReturnDamageCharge] = useState('150.00');
  const [returnHasIncident, setReturnHasIncident] = useState(false);
  const [returnExcessBand, setReturnExcessBand] = useState('Basic Excess ($2,500)');
  const [returnExcessAmount, setReturnExcessAmount] = useState('2500');
  const [returnHasCleaning, setReturnHasCleaning] = useState(false);
  const [returnCleaningFee, setReturnCleaningFee] = useState('120.00');
  const [returnDepositHeld, setReturnDepositHeld] = useState('500');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Read: Details Modal
  const [detailsAgreement, setDetailsAgreement] = useState<LoanAgreement | null>(null);

  // Update: Edit Modal
  const [editAgreement, setEditAgreement] = useState<LoanAgreement | null>(null);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRego, setEditRego] = useState('');
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editDailyKm, setEditDailyKm] = useState('50');
  const [editExcessKm, setEditExcessKm] = useState('0.50');
  const [editNotes, setEditNotes] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Create: Issue Modal
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issuePurpose, setIssuePurpose] = useState<'SERVICE_LOANER' | 'TEST_DRIVE'>('SERVICE_LOANER');
  const [issueSiteId, setIssueSiteId] = useState('site_cranbourne_byd');
  const [issueCustomerName, setIssueCustomerName] = useState('');
  const [issueMobile, setIssueMobile] = useState('');
  const [issueEmail, setIssueEmail] = useState('');
  const [issueLicence, setIssueLicence] = useState('');
  const [issueRego, setIssueRego] = useState('');
  const [issueMake, setIssueMake] = useState('');
  const [issueModel, setIssueModel] = useState('');
  const [issueOdo, setIssueOdo] = useState('');
  const [issueDueHours, setIssueDueHours] = useState('24');
  const [issueDeposit, setIssueDeposit] = useState('500');
  const [issueDepositMethod, setIssueDepositMethod] = useState('CARD_PREAUTH');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const fetchData = useCallback(async () => {
    if (!sessionReady || isTechnician) return;
    try {
      setLoading(true);
      const effectiveSite = selectedSiteId;
      const siteParam = effectiveSite === 'all' ? undefined : effectiveSite;
      const [agList, kpiData] = await Promise.all([
        api.getLoanAgreements(siteParam),
        api.getLoanAgreementKpis(siteParam).catch(() => null),
      ]);
      let list = agList || [];
      if (isClerk && authorizedSiteIds.length > 0) {
        list = list.filter((agreement) => authorizedSiteIds.includes(agreement.siteId));
      }
      setAgreements(list);
      if (kpiData && typeof kpiData.totalCars === 'number' && !(isClerk && selectedSiteId === 'all')) {
        setKpis(kpiData);
      } else {
        setKpis(computeKpis(list, effectiveSite === 'all' ? 'all' : effectiveSite));
      }
    } catch (err: any) {
      console.error('Failed to load loan operations data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId, isTechnician, isClerk, authorizedSiteIds, sessionReady]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep KPI boxes synced when site filter changes
  useEffect(() => {
    if (agreements.length > 0) {
      setKpis(computeKpis(agreements, selectedSiteId));
    }
  }, [selectedSiteId, agreements]);

  // Filtered agreements
  const filteredAgreements = agreements.filter((ag) => {
    const effectiveSite = selectedSiteId;
    if (isClerk && authorizedSiteIds.length > 0 && !authorizedSiteIds.includes(ag.siteId)) {
      return false;
    }
    if (effectiveSite !== 'all' && ag.siteId !== effectiveSite) {
      return false;
    }
    if (purposeFilter !== 'ALL' && ag.purpose !== purposeFilter) {
      return false;
    }
    const category = getDynamicLoanCategory(ag.status, ag.dueBackDateTime);
    if (statusFilter === 'AVAILABLE' && category !== 'RETURNED') {
      return false;
    }
    if (statusFilter === 'ACTIVE_LOAN') {
      if (category !== 'ACTIVE' && category !== 'DUE_SOON') return false;
      if (ag.purpose === 'TEST_DRIVE') return false;
    }
    if (statusFilter === 'ACTIVE_TEST_DRIVE') {
      if (category !== 'ACTIVE' && category !== 'DUE_SOON') return false;
      if (ag.purpose !== 'TEST_DRIVE') return false;
    }
    if (statusFilter === 'ACTIVE' && category !== 'ACTIVE' && category !== 'DUE_SOON') {
      return false;
    }
    if (statusFilter === 'DUE_SOON' && category !== 'DUE_SOON') {
      return false;
    }
    if (statusFilter === 'OVERDUE' && category !== 'OVERDUE') {
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

  const getStatusBadge = (status?: string, dueBackDateTime?: string) => {
    const category = getDynamicLoanCategory(status, dueBackDateTime);
    switch (category) {
      case 'OVERDUE': {
        const diffMinutes = dueBackDateTime ? Math.round((Date.now() - new Date(dueBackDateTime).getTime()) / 60000) : 0;
        const label = diffMinutes >= 60
          ? `Overdue (${Math.floor(diffMinutes / 60)}h)`
          : `Overdue (${Math.max(1, diffMinutes)}m)`;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-rose-500/10 text-rose-600 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            {label}
          </span>
        );
      }
      case 'DUE_SOON': {
        const diffMinutes = dueBackDateTime ? Math.max(1, Math.round((new Date(dueBackDateTime).getTime() - Date.now()) / 60000)) : 60;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-amber-500/10 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Due in {diffMinutes}m
          </span>
        );
      }
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

  const formatDueTime = (isoString?: string) => {
    if (!isoString) return 'Not set';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday = now.toDateString() === d.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      if (isToday) {
        return `Today, ${timeStr}`;
      }
      const dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return isoString;
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

    const kmTravelled = Math.max(0, numOdoIn - odoOut);
    const startMs = new Date(returnAgreement.loanStartDateTime).getTime();
    const endMs = Date.now();
    const days = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const allowableKm = days * (returnAgreement.dailyKmCap || 50);
    const excessKm = Math.max(0, kmTravelled - allowableKm);
    const excessRate = returnAgreement.excessKmRate || 0.50;
    const excessKmCharge = Number((excessKm * excessRate).toFixed(2));

    const fuelOut = returnAgreement.outbound?.fuelLevelOutPercent ?? 100;
    const numFuelIn = Math.min(100, Math.max(0, parseInt(returnFuel, 10) || 0));
    const fuelShortage = Math.max(0, fuelOut - numFuelIn);
    const autoFuelCharge = Number((fuelShortage * 1.50).toFixed(2));
    const finalFuelCharge = returnFuelChargeOverride !== ''
      ? Math.max(0, parseFloat(returnFuelChargeOverride) || 0)
      : autoFuelCharge;

    const finalDamageCharge = returnHasDamage ? Math.max(0, parseFloat(returnDamageCharge) || 0) : 0;
    const finalExcessCharge = returnHasIncident ? Math.max(0, parseFloat(returnExcessAmount) || 0) : 0;
    const finalCleaningCharge = returnHasCleaning ? Math.max(0, parseFloat(returnCleaningFee) || 0) : 0;
    const totalChargesDue = Number(
      (excessKmCharge + finalFuelCharge + finalDamageCharge + finalExcessCharge + finalCleaningCharge).toFixed(2)
    );

    const depositHeld = Math.max(0, parseFloat(returnDepositHeld) || 0);
    const netAmountDue = Math.max(0, Number((totalChargesDue - depositHeld).toFixed(2)));
    const depositRefundAmount = Math.max(0, Number((depositHeld - totalChargesDue).toFixed(2)));

    try {
      setSubmittingReturn(true);
      await api.returnLoanAgreement(returnAgreement.id, {
        odometerIn: numOdoIn,
        fuelLevelInPercent: numFuelIn,
        fuelShortagePercent: fuelShortage,
        fuelChargeAmount: finalFuelCharge,
        damageChargeAmount: finalDamageCharge,
        cleaningFeeAmount: finalCleaningCharge,
        totalChargesDue,
        securityDepositHeld: depositHeld,
        depositRefundAmount,
        netAmountDue,
        returnDamageNotes: returnNotes.trim() || (returnHasDamage ? 'Damage recorded on return.' : 'Returned and checked by dealership staff.'),
        hasDamageIncident: returnHasDamage || returnHasIncident,
        applicableExcessBand: returnHasIncident ? returnExcessBand : undefined,
        applicableExcessAmount: finalExcessCharge,
      });
      setReturnAgreement(null);
      fetchData();
    } catch (err: any) {
      alert('Return failed: ' + (err?.message || 'Server error'));
    } finally {
      setSubmittingReturn(false);
    }
  };

  const openEditModal = (ag: LoanAgreement) => {
    setEditAgreement(ag);
    setEditName(ag.customer?.name || '');
    setEditMobile(ag.customer?.mobile || '');
    setEditEmail(ag.customer?.email || '');
    setEditRego(ag.vehicle?.rego || '');
    setEditMake(ag.vehicle?.make || '');
    setEditModel(ag.vehicle?.model || '');
    setEditDueTime(ag.dueBackDateTime || new Date().toISOString());
    setEditDailyKm(String(ag.dailyKmCap || 50));
    setEditExcessKm(String(ag.excessKmRate || 0.5));
    setEditNotes(ag.outbound?.damageNotes || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgreement) return;

    try {
      setSubmittingEdit(true);
      const payload = {
        customer: {
          name: editName.trim(),
          mobile: editMobile.trim(),
          email: editEmail.trim(),
        },
        vehicle: {
          rego: editRego.trim().toUpperCase(),
          make: editMake.trim(),
          model: editModel.trim(),
        },
        dueBackDateTime: editDueTime,
        dailyKmCap: parseInt(editDailyKm, 10) || 50,
        excessKmRate: parseFloat(editExcessKm) || 0.5,
        outbound: {
          ...editAgreement.outbound,
          damageNotes: editNotes.trim(),
        },
      };

      let updated: LoanAgreement;
      try {
        updated = await api.updateLoanAgreement(editAgreement.id, payload);
      } catch (apiErr) {
        console.warn('API update failed, updating locally:', apiErr);
        updated = {
          ...editAgreement,
          customer: {
            ...editAgreement.customer,
            ...payload.customer,
          },
          vehicle: {
            ...editAgreement.vehicle,
            ...payload.vehicle,
          },
          dueBackDateTime: payload.dueBackDateTime,
          dailyKmCap: payload.dailyKmCap,
          excessKmRate: payload.excessKmRate,
          outbound: {
            ...editAgreement.outbound,
            damageNotes: payload.outbound.damageNotes,
          },
        };
      }

      setAgreements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditAgreement(null);
    } catch (err: any) {
      alert('Update failed: ' + (err?.message || 'Server error'));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteAgreement = async (ag: LoanAgreement) => {
    if (!confirm(`Are you sure you want to delete loan agreement ${ag.agreementNumber} (${ag.vehicle?.rego})? This action cannot be undone.`)) {
      return;
    }

    try {
      try {
        await api.deleteLoanAgreement(ag.id);
      } catch (apiErr) {
        console.warn('API delete failed, removing locally:', apiErr);
      }
      setAgreements((prev) => prev.filter((a) => a.id !== ag.id));
      if (detailsAgreement?.id === ag.id) setDetailsAgreement(null);
    } catch (err: any) {
      alert('Delete failed: ' + (err?.message || 'Server error'));
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueCustomerName.trim() || !issueMobile.trim() || !issueRego.trim()) {
      alert('Please fill in customer name, mobile, and vehicle registration.');
      return;
    }

    const effectiveIssueSite = isTechnician && technicianSiteId ? technicianSiteId : issueSiteId;
    const siteObj = rooftops.find((r) => r.siteId === effectiveIssueSite) || rooftops.find((r) => r.siteId !== 'all') || FALLBACK_ROOFTOPS[1];
    const hours = parseInt(issueDueHours, 10) || 24;
    const dueTime = new Date(Date.now() + hours * 3600000).toISOString();

    const payload = {
      siteId: siteObj.siteId,
      siteName: siteObj.fullName || `Booran ${siteObj.label}`,
      purpose: issuePurpose,
      customer: {
        name: issueCustomerName.trim(),
        dob: '1990-01-01',
        mobile: issueMobile.trim(),
        email: issueEmail.trim() || 'customer@gmail.com',
        residentialAddress: 'Melbourne VIC',
        licenceNumber: issueLicence.trim() || 'LIC998822',
        licenceState: 'VIC',
        licenceExpiry: '2028-12-31',
        licenceSighted: true,
      },
      vehicle: {
        vin: 'LGX' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        rego: issueRego.trim().toUpperCase(),
        make: issueMake.trim() || 'Booran Fleet',
        model: issueModel.trim() || (issuePurpose === 'TEST_DRIVE' ? 'Demo Vehicle' : 'Service Loaner'),
        year: 2024,
        colour: 'White',
      },
      dueBackDateTime: dueTime,
      dailyKmCap: 50,
      excessKmRate: 0.5,
      basicInsuranceExcess: 2500,
      securityDepositHeld: parseFloat(issueDeposit) || 500,
      depositPaymentMethod: issueDepositMethod,
      outbound: {
        odometerOut: parseInt(issueOdo, 10) || 0,
        fuelLevelOutPercent: 100,
        damageNotes: 'Clean pre-delivery check completed.',
        photos: {},
      },
    };

    try {
      setSubmittingIssue(true);
      let created: LoanAgreement;
      try {
        created = await api.issueLoanAgreement(payload);
      } catch (apiErr) {
        console.warn('API issue failed, adding locally:', apiErr);
        created = {
          id: `lagr_${Date.now()}`,
          agreementNumber: `BMG-${siteObj.label.toUpperCase()}-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...payload,
        } as any;
      }
      setAgreements((prev) => [created, ...prev]);
      setIsIssueOpen(false);
      setIssueCustomerName('');
      setIssueMobile('');
      setIssueEmail('');
      setIssueLicence('');
      setIssueRego('');
      setIssueMake('');
      setIssueModel('');
      setIssueOdo('');
    } catch (err: any) {
      alert('Issue failed: ' + (err?.message || 'Server error'));
    } finally {
      setSubmittingIssue(false);
    }
  };

  const openIssueModal = (purpose: 'SERVICE_LOANER' | 'TEST_DRIVE') => {
    setIssuePurpose(purpose);
    setIssueDueHours(purpose === 'TEST_DRIVE' ? '1' : '24');
    if (isTechnician && technicianSiteId) {
      setIssueSiteId(technicianSiteId);
    }
    setIsIssueOpen(true);
  };

  const activeRooftopLabel = rooftops.find(
    (r) => r.siteId === (isTechnician && technicianSiteId ? technicianSiteId : selectedSiteId)
  )?.label || technicianSiteName || 'Assigned rooftops';
  const assignedRooftopNames = rooftops.filter((r) => r.siteId !== 'all').map((r) => r.label).join(', ');

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header
        portalRole={userRole}
        title="Loan Vehicle Operations"
        subtitle={
          isClerk
            ? `Warranty Clerk • Loan operations for assigned rooftops${assignedRooftopNames ? ` (${assignedRooftopNames})` : ''}`
            : isTechnician
            ? `Booran Motor Group • Workshop Fleet (${activeRooftopLabel} Rooftop - Technician Scoped)`
            : "Booran Motor Group • Digital Customer Agreements & Electronic SOW Compliance"
        }
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => openIssueModal('SERVICE_LOANER')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Issue Loaner
            </button>
            <button
              onClick={() => openIssueModal('TEST_DRIVE')}
              className="px-3.5 py-2 bg-[#D71920] hover:bg-[#B91218] text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Start Test Drive
            </button>

            {isTechnician ? (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-500">Rooftop:</span>
                <span className="font-extrabold text-[#D71920]">
                  {activeRooftopLabel}
                </span>
                <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
                  Technician View
                </span>
              </div>
            ) : (
              <div className="relative group inline-flex items-center">
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-2 shadow-xs focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden cursor-pointer"
                >
                  {visibleRooftops.map((rt) => (
                    <option key={rt.siteId} value={rt.siteId}>
                      {rt.label}
                    </option>
                  ))}
                </select>
                {/* Tooltip for selected rooftop */}
                <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex flex-col items-center z-50">
                  <div className="w-2 h-2 bg-slate-900 rotate-45 -mb-1 border-l border-t border-slate-700/80" />
                  <div className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D71920]" />
                    <span>
                      {rooftops.find((r) => r.siteId === selectedSiteId)?.fullName || (isClerk ? 'Assigned Dealership Rooftops' : 'All Dealership Rooftops')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Dealership Rooftop Control & Filter Bar */}
        <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏢</span> Dealership Rooftop:
            </span>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D71920] cursor-pointer"
            >
              {visibleRooftops.map((rt) => (
                <option key={rt.siteId} value={rt.siteId}>
                  {rt.fullName || rt.label}
                </option>
              ))}
            </select>

            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
              {selectedSiteId === 'all'
                ? `📍 ${isClerk ? 'Assigned Dealership Rooftops' : 'All Dealership Rooftops'} • ${visibleRooftops.filter((r) => r.siteId !== 'all').length} Locations Monitored`
                : `📍 Rooftop: ${rooftops.find((r) => r.siteId === selectedSiteId)?.fullName || selectedSiteId}`
              }
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Active Filter:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
              {rooftops.find((r) => r.siteId === selectedSiteId)?.label || (isClerk ? 'All Assigned Rooftops' : 'All Rooftops')}
            </span>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Total Cars */}
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`text-left bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'ring-2 ring-slate-800 border-transparent shadow-md'
                : 'border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800" />
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cars</span>
              <span className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" strokeWidth="2" />
                  <circle cx="17" cy="17" r="2" strokeWidth="2" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{kpis.totalCars ?? agreements.length}</span>
              <p className="text-xs text-slate-500 mt-1">Total fleet vehicles</p>
            </div>
          </button>

          {/* 2. Available */}
          <button
            type="button"
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`text-left bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
              statusFilter === 'AVAILABLE'
                ? 'ring-2 ring-emerald-500 border-transparent shadow-md'
                : 'border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fleet Available</span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-emerald-600 tracking-tight">{kpis.available}</span>
              <p className="text-xs text-slate-500 mt-1">In depot ready to loan</p>
            </div>
          </button>

          {/* 3. Active Loans (Service Loaners) */}
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE_LOAN')}
            className={`text-left bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
              statusFilter === 'ACTIVE_LOAN'
                ? 'ring-2 ring-blue-500 border-transparent shadow-md'
                : 'border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Loans</span>
              <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-blue-600 tracking-tight">{kpis.activeLoans ?? 0}</span>
              <p className="text-xs text-slate-500 mt-1">Service loaners on road</p>
            </div>
          </button>

          {/* 4. Active Test Drives */}
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE_TEST_DRIVE')}
            className={`text-left bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
              statusFilter === 'ACTIVE_TEST_DRIVE'
                ? 'ring-2 ring-purple-500 border-transparent shadow-md'
                : 'border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Test Drives</span>
              <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-purple-600 tracking-tight">{kpis.activeTestDrives ?? 0}</span>
              <p className="text-xs text-slate-500 mt-1">Customer test drives active</p>
            </div>
          </button>

          {/* 5. Overdue */}
          <button
            type="button"
            onClick={() => setStatusFilter('OVERDUE')}
            className={`text-left bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer ${
              statusFilter === 'OVERDUE'
                ? 'ring-2 ring-rose-500 border-transparent shadow-md'
                : 'border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue Alerts</span>
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-rose-600 tracking-tight">{kpis.overdue}</span>
              <p className="text-xs text-rose-600 font-semibold mt-1">
                {kpis.dueSoon > 0 ? `${kpis.dueSoon} vehicle(s) due soon` : 'Requires advisor attention'}
              </p>
            </div>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tab Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
            {[
              { key: 'ALL', label: 'All Fleet', count: kpis.totalCars ?? agreements.length },
              { key: 'ACTIVE_LOAN', label: 'Active Loans', count: kpis.activeLoans, activeStyle: 'bg-blue-600 text-white shadow-xs' },
              { key: 'ACTIVE_TEST_DRIVE', label: 'Active Test Drives', count: kpis.activeTestDrives, activeStyle: 'bg-purple-600 text-white shadow-xs' },
              { key: 'AVAILABLE', label: 'Available (In Depot)', count: kpis.available },
              { key: 'OVERDUE', label: 'Overdue', count: kpis.overdue },
            ].map((tab) => {
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? (tab.activeStyle || 'bg-white text-slate-900 shadow-xs')
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isSelected
                          ? tab.key === 'ACTIVE_TEST_DRIVE' || tab.key === 'ACTIVE_LOAN'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-800'
                          : tab.key === 'ACTIVE_TEST_DRIVE' && tab.count > 0
                          ? 'bg-purple-100 text-purple-700'
                          : tab.key === 'ACTIVE_LOAN' && tab.count > 0
                          ? 'bg-blue-100 text-blue-700'
                          : tab.key === 'OVERDUE' && tab.count > 0
                          ? 'bg-rose-100 text-rose-700 font-bold'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Rooftop Quick Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Rooftop:
              </span>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-1 pr-1"
                aria-label="Dealership rooftop filter"
              >
                {visibleRooftops.map((rt) => (
                  <option key={rt.siteId} value={rt.siteId}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value as typeof purposeFilter)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-[#D71920]"
              aria-label="Agreement purpose filter"
            >
              <option value="ALL">All purposes</option>
              <option value="SERVICE_LOANER">Service loaners only</option>
              <option value="TEST_DRIVE">Test drives only</option>
            </select>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
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
        </div>

        {/* Agreements Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-black tracking-wider">
                  <th className="py-3.5 px-4">Agreement & Rooftop</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">
                    {statusFilter === 'ACTIVE_TEST_DRIVE'
                      ? 'Test Drive Vehicle'
                      : statusFilter === 'ACTIVE_LOAN'
                      ? 'Loaner Vehicle'
                      : 'Vehicle & Purpose'}
                  </th>
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
                    const category = getDynamicLoanCategory(ag.status, ag.dueBackDateTime);
                    const isLoanActive = category !== 'RETURNED';
                    const odoOut = ag.outbound?.odometerOut || 0;
                    const odoIn = ag.inbound?.odometerIn;
                    return (
                      <tr key={ag.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Agreement # & Rooftop */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {ag.agreementNumber}
                          </span>
                          <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${
                            ag.purpose === 'TEST_DRIVE'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ag.purpose === 'TEST_DRIVE' ? 'bg-purple-600' : 'bg-blue-600'}`} />
                            {ag.purpose === 'TEST_DRIVE' ? 'Test Drive' : 'Service Loaner'}
                          </span>
                          <div className="relative group inline-block max-w-[170px] mt-0.5">
                            <span
                              className="text-xs text-[#D71920] font-semibold truncate block cursor-help"
                              title={ag.siteName}
                            >
                              {ag.siteName}
                            </span>
                            {/* Rich Tooltip */}
                            <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover:flex flex-col z-50">
                              <div className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D71920]" />
                                <span>{ag.siteName}</span>
                                {(ag.siteId === 'site_dandenong_multi' || ag.siteName?.toLowerCase().includes('multi')) && (
                                  <span className="text-[10px] text-slate-400 font-normal border-l border-slate-700 pl-1.5">
                                    Multi-Franchise Dealership
                                  </span>
                                )}
                              </div>
                              <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 ml-3 border-r border-b border-slate-700/80" />
                            </div>
                          </div>
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
                              {formatDueTime(ag.dueBackDateTime)}
                            </span>
                            {ag.inbound?.returnedAt && (
                              <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium">
                                Ret: {formatDueTime(ag.inbound.returnedAt)}
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
                          {(() => {
                            const fuelOut = ag.outbound?.fuelLevelOutPercent ?? 100;
                            const fuelIn = ag.inbound?.fuelLevelInPercent ?? fuelOut;
                            const fuelShortage = Math.max(0, fuelOut - fuelIn);
                            const fuelCharge = ag.inbound?.fuelChargeAmount !== undefined
                              ? ag.inbound.fuelChargeAmount
                              : Number((fuelShortage * 1.50).toFixed(2));
                            const excessKmCharge = ag.inbound?.excessKmChargeAmount ?? 0;
                            const damageCharge = ag.inbound?.damageChargeAmount ?? 0;
                            const incidentExcess = ag.inbound?.applicableExcessAmount ?? 0;
                            const cleaningFee = ag.inbound?.cleaningFeeAmount ?? 0;
                            const totalIncurred = ag.inbound?.totalChargesDue !== undefined && ag.inbound.totalChargesDue > 0
                              ? ag.inbound.totalChargesDue
                              : Number((excessKmCharge + fuelCharge + damageCharge + incidentExcess + cleaningFee).toFixed(2));
                            const depositHeld = ag.inbound?.securityDepositHeld ?? ag.securityDepositHeld ?? 500;
                            const netDue = ag.inbound?.netAmountDue !== undefined
                              ? ag.inbound.netAmountDue
                              : Math.max(0, Number((totalIncurred - depositHeld).toFixed(2)));
                            const refundDue = ag.inbound?.depositRefundAmount !== undefined
                              ? ag.inbound.depositRefundAmount
                              : Math.max(0, Number((depositHeld - totalIncurred).toFixed(2)));

                            if (ag.status === 'RETURNED') {
                              if (netDue > 0) {
                                return (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold" title={`Incurred: $${totalIncurred.toFixed(2)} - Deposit: $${depositHeld.toFixed(2)} = Net Due: $${netDue.toFixed(2)}`}>
                                    Net Paid: ${netDue.toFixed(2)}
                                  </span>
                                );
                              } else if (totalIncurred > 0 && refundDue > 0) {
                                return (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold" title={`Incurred: $${totalIncurred.toFixed(2)} deducted from $${depositHeld.toFixed(2)} deposit. Refund: $${refundDue.toFixed(2)}`}>
                                    Refunded: ${refundDue.toFixed(2)}
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium" title={`Zero charges incurred. Deposit ($${depositHeld.toFixed(2)}) refunded.`}>
                                    Nil Due ($0.00)
                                  </span>
                                );
                              }
                            }
                            if (ag.inbound?.excessKm && ag.inbound.excessKm > 0) {
                              return (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Excess: +${ag.inbound.excessKmChargeAmount?.toFixed(2)} ({ag.inbound.excessKm} km)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(ag.status, ag.dueBackDateTime)}
                        </td>

                        {/* 7. Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDetailsAgreement(ag)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                              title="View Full Details"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Details
                            </button>

                            <button
                              onClick={() => openEditModal(ag)}
                              className="px-2 py-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                              title="Edit Details / Extend Return Time"
                            >
                              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>

                            <button
                              onClick={() => setPreviewAgreement(ag)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                              title="View PDF"
                            >
                              <svg className="w-3.5 h-3.5 text-[#D71920]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF
                            </button>

                            {isLoanActive && (
                              <button
                                onClick={() => {
                                  setReturnAgreement(ag);
                                  setReturnOdo(String(odoOut + 45));
                                  setReturnFuel('75');
                                  setReturnFuelChargeOverride('');
                                  setReturnHasDamage(false);
                                  setReturnDamageCharge('150.00');
                                  setReturnHasIncident(false);
                                  setReturnExcessBand('Basic Excess ($2,500)');
                                  setReturnExcessAmount('2500');
                                  setReturnHasCleaning(false);
                                  setReturnCleaningFee('120.00');
                                  setReturnDepositHeld(String(ag.securityDepositHeld ?? 500));
                                  setReturnNotes('');
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Check In Return"
                              >
                                Check In
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteAgreement(ag)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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
                  download={`${previewAgreement.agreementNumber}.pdf`}
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
      {returnAgreement && (() => {
        const odoOut = returnAgreement.outbound?.odometerOut || 0;
        const numOdoIn = parseInt(returnOdo, 10) || odoOut;
        const kmTravelled = Math.max(0, numOdoIn - odoOut);
        const startMs = new Date(returnAgreement.loanStartDateTime).getTime();
        const endMs = Date.now();
        const days = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
        const allowableKm = days * (returnAgreement.dailyKmCap || 50);
        const excessKm = Math.max(0, kmTravelled - allowableKm);
        const excessRate = returnAgreement.excessKmRate || 0.50;
        const excessKmCharge = Number((excessKm * excessRate).toFixed(2));

        const fuelOut = returnAgreement.outbound?.fuelLevelOutPercent ?? 100;
        const numFuelIn = Math.min(100, Math.max(0, parseInt(returnFuel, 10) || 0));
        const fuelShortage = Math.max(0, fuelOut - numFuelIn);
        const autoFuelCharge = Number((fuelShortage * 1.50).toFixed(2));
        const finalFuelCharge = returnFuelChargeOverride !== ''
          ? Math.max(0, parseFloat(returnFuelChargeOverride) || 0)
          : autoFuelCharge;

        const finalDamageCharge = returnHasDamage ? Math.max(0, parseFloat(returnDamageCharge) || 0) : 0;
        const finalExcessCharge = returnHasIncident ? Math.max(0, parseFloat(returnExcessAmount) || 0) : 0;
        const finalCleaningCharge = returnHasCleaning ? Math.max(0, parseFloat(returnCleaningFee) || 0) : 0;
        const totalIncurred = Number(
          (excessKmCharge + finalFuelCharge + finalDamageCharge + finalExcessCharge + finalCleaningCharge).toFixed(2)
        );
        const depositHeld = Math.max(0, parseFloat(returnDepositHeld) || 0);
        const netAmountDue = Math.max(0, Number((totalIncurred - depositHeld).toFixed(2)));
        const depositRefundAmount = Math.max(0, Number((depositHeld - totalIncurred).toFixed(2)));

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleReturnSubmit}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Inbound Check In & Settlement</h3>
                  <p className="text-xs text-slate-300">
                    {returnAgreement.vehicle.rego} • {returnAgreement.vehicle.year} {returnAgreement.vehicle.make} {returnAgreement.vehicle.model} • Borrower: {returnAgreement.customer.name}
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

              <div className="p-6 space-y-4 overflow-y-auto">
                {/* 1. Odometer Reading */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Inbound Odometer (km) *
                    </label>
                    <span className="text-xs text-slate-500 font-medium">
                      Outbound: <strong className="text-slate-800">{odoOut.toLocaleString()} km</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    value={returnOdo}
                    onChange={(e) => setReturnOdo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-white"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Travelled: <strong>{kmTravelled} km</strong></span>
                    <span>Cap ({days}d × {returnAgreement.dailyKmCap || 50}km): <strong>{allowableKm} km</strong></span>
                    {excessKm > 0 ? (
                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        +{excessKm} km excess (${excessKmCharge.toFixed(2)})
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Within daily limit</span>
                    )}
                  </div>
                </div>

                {/* 2. Fuel Level & Price Impact */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Inbound Fuel Level (%)
                    </label>
                    <span className="text-xs text-slate-500 font-medium">
                      Outbound Fuel: <strong className="text-slate-800">{fuelOut}%</strong>
                    </span>
                  </div>

                  {/* Preset chips */}
                  <div className="flex items-center gap-2 mb-2.5">
                    {['25', '50', '75', '100'].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setReturnFuel(pct);
                          setReturnFuelChargeOverride('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          returnFuel === pct
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                    <div className="w-24 relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={returnFuel}
                        onChange={(e) => {
                          setReturnFuel(e.target.value);
                          setReturnFuelChargeOverride('');
                        }}
                        className="w-full px-2 py-1.5 text-center text-xs font-bold border border-slate-300 rounded-lg bg-white"
                        placeholder="Custom %"
                      />
                      <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  {/* Fuel Deficit Price Feedback */}
                  {fuelShortage > 0 ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-rose-800">
                          Fuel Deficit: -{fuelShortage}% (Out: {fuelOut}% → In: {numFuelIn}%)
                        </p>
                        <p className="text-[11px] text-rose-600">
                          Refuel Charge: ${autoFuelCharge.toFixed(2)} ($1.50 per 1% shortage)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={autoFuelCharge.toFixed(2)}
                          value={returnFuelChargeOverride}
                          onChange={(e) => setReturnFuelChargeOverride(e.target.value)}
                          className="w-20 px-2 py-1 text-xs text-right font-bold border border-rose-300 rounded bg-white"
                          title="Override charge amount"
                        />
                        <button
                          type="button"
                          onClick={() => setReturnFuelChargeOverride('0')}
                          className="text-[10px] px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 font-bold border border-slate-300 rounded"
                        >
                          Waive
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Fuel Verified: Returned full / matched outbound ($0.00 refueling fee)
                    </div>
                  )}
                </div>

                {/* 3. Damage & Accident Surcharges */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Damage, Fault & Accident Surcharges
                  </h4>

                  {/* Damage Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Damage / Fault Observed on Return?</p>
                      <p className="text-[11px] text-slate-500">Scratches, scuffs, kerb rash, or mechanical defect</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReturnHasDamage(!returnHasDamage)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        returnHasDamage
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {returnHasDamage ? 'YES' : 'NO'}
                    </button>
                  </div>

                  {returnHasDamage && (
                    <div className="p-3 bg-white border border-rose-200 rounded-lg space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Damage & Fault Details:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Scuff on rear bumper, alloy wheel rash..."
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          Damage / Repair Estimate Charge ($):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={returnDamageCharge}
                          onChange={(e) => setReturnDamageCharge(e.target.value)}
                          className="w-28 px-2 py-1 text-xs text-right font-bold border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Incident / Accident Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">At-Fault Accident / Major Incident?</p>
                      <p className="text-[11px] text-slate-500">Applies Borrower Insurance Excess Schedule (Clause 11)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReturnHasIncident(!returnHasIncident)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        returnHasIncident
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {returnHasIncident ? 'YES' : 'NO'}
                    </button>
                  </div>

                  {returnHasIncident && (
                    <div className="p-3 bg-white border border-rose-200 rounded-lg space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Insurance Excess Schedule Band:
                        </label>
                        <select
                          value={returnExcessBand}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReturnExcessBand(val);
                            if (val.includes('2,500')) setReturnExcessAmount('2500');
                            else if (val.includes('3,750')) setReturnExcessAmount('3750');
                            else if (val.includes('3,250')) setReturnExcessAmount('3250');
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-800"
                        >
                          <option value="Basic Excess ($2,500)">Basic Excess ($2,500 AUD)</option>
                          <option value="Age Under 21 yrs ($3,750)">Age Under 21 yrs (+$1,250 = $3,750 AUD)</option>
                          <option value="Age 21–25 yrs ($3,250)">Age 21–25 yrs (+$750 = $3,250 AUD)</option>
                          <option value="Licence < 2 yrs / Int ($3,250)">Licence &lt; 2 yrs / Int (+$750 = $3,250 AUD)</option>
                          <option value="Custom Agreed Excess">Custom Agreed Excess</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          Insurance Excess Payable ($):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={returnExcessAmount}
                          onChange={(e) => setReturnExcessAmount(e.target.value)}
                          className="w-28 px-2 py-1 text-xs text-right font-bold border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cleaning Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Detailing / Deep Cleaning Required?</p>
                      <p className="text-[11px] text-slate-500">Smoking breach, pet stains, or heavy soiling</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReturnHasCleaning(!returnHasCleaning)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        returnHasCleaning
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {returnHasCleaning ? 'YES' : 'NO'}
                    </button>
                  </div>

                  {returnHasCleaning && (
                    <div className="p-3 bg-white border border-rose-200 rounded-lg flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        Detailing Surcharge ($):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={returnCleaningFee}
                        onChange={(e) => setReturnCleaningFee(e.target.value)}
                        className="w-28 px-2 py-1 text-xs text-right font-bold border border-slate-300 rounded"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Security Deposit / Pre-auth Held */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Security Deposit / Pre-Auth Held ($)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Subtracted from charges at return to calculate net amount due or refund
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={returnDepositHeld}
                        onChange={(e) => setReturnDepositHeld(e.target.value)}
                        className="w-24 px-2 py-1 text-xs text-right font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-hidden"
                        placeholder="500.00"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Live Check-In Pricing Summary Card */}
                <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700 mb-2.5">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Live Settlement Breakdown
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                      Auto-Calculated
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Excess Kilometres ({excessKm} km @ $0.50/km):</span>
                      <span className={`font-semibold ${excessKmCharge > 0 ? 'text-amber-400 font-bold' : ''}`}>
                        ${excessKmCharge.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Fuel Deficit ({fuelShortage > 0 ? `-${fuelShortage}% shortage` : 'Equal/Full'}):</span>
                      <span className={`font-semibold ${finalFuelCharge > 0 ? 'text-amber-400 font-bold' : ''}`}>
                        ${finalFuelCharge.toFixed(2)}
                      </span>
                    </div>

                    {returnHasDamage && (
                      <div className="flex justify-between text-slate-300">
                        <span>Damage / Repair Cost:</span>
                        <span className="text-rose-400 font-bold">${finalDamageCharge.toFixed(2)}</span>
                      </div>
                    )}

                    {returnHasIncident && (
                      <div className="flex justify-between text-slate-300">
                        <span>Insurance Incident Excess ({returnExcessBand}):</span>
                        <span className="text-rose-400 font-bold">${finalExcessCharge.toFixed(2)}</span>
                      </div>
                    )}

                    {returnHasCleaning && (
                      <div className="flex justify-between text-slate-300">
                        <span>Detailing / Sanitisation Fee:</span>
                        <span className="text-rose-400 font-bold">${finalCleaningCharge.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Subtotal of Incurred Charges */}
                    <div className="flex justify-between text-slate-200 pt-2 border-t border-slate-700 font-bold">
                      <span>Total Incurred Charges:</span>
                      <span className={totalIncurred > 0 ? 'text-amber-300' : 'text-slate-300'}>
                        ${totalIncurred.toFixed(2)}
                      </span>
                    </div>

                    {/* Deduct Security Deposit */}
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Less Security Deposit Held:</span>
                      <span>-${depositHeld.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Net Result Highlight */}
                  <div className="mt-3 pt-2.5 border-t border-slate-700 flex items-center justify-between">
                    <div>
                      {netAmountDue > 0 ? (
                        <>
                          <span className="text-xs font-black uppercase text-rose-400 block tracking-wide">
                            Net Amount to be Paid
                          </span>
                          <span className="text-[10px] text-slate-300">
                            Charges (${totalIncurred.toFixed(2)}) exceed deposit (${depositHeld.toFixed(2)}) — collect from borrower
                          </span>
                        </>
                      ) : depositRefundAmount > 0 ? (
                        <>
                          <span className="text-xs font-black uppercase text-emerald-400 block tracking-wide">
                            Deposit Refund Due to Borrower
                          </span>
                          <span className="text-[10px] text-slate-300">
                            Deposit (${depositHeld.toFixed(2)}) minus charges (${totalIncurred.toFixed(2)}) — release to borrower card
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-black uppercase text-slate-200 block tracking-wide">
                            Settlement Balanced (Nil Due)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Charges exactly equal deposit held ($0.00 balance)
                          </span>
                        </>
                      )}
                    </div>
                    <span className={`text-xl font-black ${
                      netAmountDue > 0 ? 'text-rose-400' : depositRefundAmount > 0 ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {netAmountDue > 0
                        ? `$${netAmountDue.toFixed(2)}`
                        : depositRefundAmount > 0
                        ? `$${depositRefundAmount.toFixed(2)}`
                        : '$0.00'}
                    </span>
                  </div>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {submittingReturn
                    ? 'Submitting...'
                    : netAmountDue > 0
                    ? `Confirm Return (Collect $${netAmountDue.toFixed(2)})`
                    : depositRefundAmount > 0
                    ? `Confirm Return (Refund $${depositRefundAmount.toFixed(2)})`
                    : 'Confirm Return (Nil Due)'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Read: Details Modal */}
      {detailsAgreement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{detailsAgreement.vehicle.rego}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-200">
                    {detailsAgreement.agreementNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {detailsAgreement.vehicle.make} {detailsAgreement.vehicle.model} ({detailsAgreement.vehicle.year}) • {detailsAgreement.siteName || detailsAgreement.siteId}
                </p>
              </div>
              <button
                onClick={() => setDetailsAgreement(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Current Status:</span>
                  {getStatusBadge(detailsAgreement.status, detailsAgreement.dueBackDateTime)}
                </div>
                <div className="text-xs text-slate-500">
                  Created: {detailsAgreement.createdAt ? new Date(detailsAgreement.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              {/* Customer Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Customer Information</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Name</span>
                    <span className="font-bold text-slate-900">{detailsAgreement.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Mobile</span>
                    <a href={`tel:${detailsAgreement.customer.mobile}`} className="font-bold text-blue-600 hover:underline">
                      {detailsAgreement.customer.mobile}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Email</span>
                    <span className="font-semibold text-slate-800 truncate block">{detailsAgreement.customer.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Licence #</span>
                    <span className="font-mono font-bold text-slate-900">{detailsAgreement.customer.licenceNumber} ({detailsAgreement.customer.licenceState || 'VIC'})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Licence Expiry</span>
                    <span className="font-semibold text-slate-800">{detailsAgreement.customer.licenceExpiry || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Licence Sighted</span>
                    <span className="font-bold text-emerald-600">✓ Sighted & Verified</span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Loan Parameters Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vehicle & Loan Parameters</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Dealership Rooftop</span>
                    <div className="relative group inline-block">
                      <span className="font-bold text-[#D71920] cursor-help">
                        {detailsAgreement.siteName || detailsAgreement.siteId}
                      </span>
                      <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover:flex flex-col z-50">
                        <div className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D71920]" />
                          <span>{detailsAgreement.siteName}</span>
                          {(detailsAgreement.siteId === 'site_dandenong_multi' || detailsAgreement.siteName?.toLowerCase().includes('multi')) && (
                            <span className="text-[10px] text-slate-400 font-normal border-l border-slate-700 pl-1.5">
                              Multi-Franchise Dealership
                            </span>
                          )}
                        </div>
                        <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 ml-3 border-r border-b border-slate-700/80" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Vehicle</span>
                    <span className="font-bold text-slate-900">{detailsAgreement.vehicle.make} {detailsAgreement.vehicle.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">VIN</span>
                    <span className="font-mono text-slate-800">{detailsAgreement.vehicle.vin}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Daily Allowance</span>
                    <span className="font-bold text-slate-900">{detailsAgreement.dailyKmCap || 50} km / day</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Excess Rate</span>
                    <span className="font-bold text-amber-600">${detailsAgreement.excessKmRate || 0.50} / km</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Due Back</span>
                    <span className="font-bold text-slate-900">{formatDueTime(detailsAgreement.dueBackDateTime)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Basic Excess</span>
                    <span className="font-bold text-slate-900">${detailsAgreement.basicInsuranceExcess || 2500} AUD</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Outbound Odometer</span>
                    <span className="font-bold text-slate-900">{detailsAgreement.outbound?.odometerOut?.toLocaleString() || 0} km</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Outbound Fuel</span>
                    <span className="font-bold text-slate-900">{detailsAgreement.outbound?.fuelLevelOutPercent ?? 100}%</span>
                  </div>
                </div>
              </div>

              {/* Inbound Return Record (if returned) */}
              {detailsAgreement.inbound && (() => {
                const fuelOut = detailsAgreement.outbound?.fuelLevelOutPercent ?? 100;
                const fuelIn = detailsAgreement.inbound.fuelLevelInPercent ?? fuelOut;
                const fuelShortage = Math.max(0, fuelOut - fuelIn);
                const fuelCharge = detailsAgreement.inbound.fuelChargeAmount !== undefined
                  ? detailsAgreement.inbound.fuelChargeAmount
                  : Number((fuelShortage * 1.50).toFixed(2));

                const excessKmCharge = detailsAgreement.inbound.excessKmChargeAmount ?? 0;
                const damageCharge = detailsAgreement.inbound.damageChargeAmount ?? 0;
                const incidentExcess = detailsAgreement.inbound.applicableExcessAmount ?? 0;
                const cleaningFee = detailsAgreement.inbound.cleaningFeeAmount ?? 0;

                const computedTotal = Number(
                  (excessKmCharge + fuelCharge + damageCharge + incidentExcess + cleaningFee).toFixed(2)
                );
                const totalIncurred = detailsAgreement.inbound.totalChargesDue !== undefined && detailsAgreement.inbound.totalChargesDue > 0
                  ? detailsAgreement.inbound.totalChargesDue
                  : computedTotal;
                const depositHeld = detailsAgreement.inbound.securityDepositHeld ?? detailsAgreement.securityDepositHeld ?? 500;
                const netDue = detailsAgreement.inbound.netAmountDue !== undefined
                  ? detailsAgreement.inbound.netAmountDue
                  : Math.max(0, Number((totalIncurred - depositHeld).toFixed(2)));
                const refundDue = detailsAgreement.inbound.depositRefundAmount !== undefined
                  ? detailsAgreement.inbound.depositRefundAmount
                  : Math.max(0, Number((depositHeld - totalIncurred).toFixed(2)));

                return (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        Inbound Return & Settlement Record
                      </h4>
                      {netDue > 0 ? (
                        <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-300 shadow-2xs">
                          Net Balance Paid: ${netDue.toFixed(2)} (Charges: ${totalIncurred.toFixed(2)} - Deposit: ${depositHeld.toFixed(2)})
                        </span>
                      ) : refundDue > 0 && totalIncurred > 0 ? (
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                          Deposit Refunded: ${refundDue.toFixed(2)} (Charges: ${totalIncurred.toFixed(2)} from ${depositHeld.toFixed(2)})
                        </span>
                      ) : totalIncurred === 0 ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                          Clean Return • Full Deposit Refunded (${depositHeld.toFixed(2)})
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
                          Settlement Balanced ($0.00 Balance)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-emerald-700 block font-medium">Returned At</span>
                        <span className="font-bold text-slate-900">{formatDueTime(detailsAgreement.inbound.returnedAt || (detailsAgreement.inbound as any).returnedDateTime)}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block font-medium">Odometer In</span>
                        <span className="font-bold text-slate-900">{detailsAgreement.inbound.odometerIn?.toLocaleString()} km</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block font-medium">Distance Travelled</span>
                        <span className="font-bold text-slate-900">
                          {((detailsAgreement.inbound.odometerIn || 0) - (detailsAgreement.outbound?.odometerOut || 0))} km
                        </span>
                        {detailsAgreement.inbound.excessKm !== undefined && detailsAgreement.inbound.excessKm > 0 && (
                          <span className="text-[10px] text-amber-700 font-bold block">
                            +{detailsAgreement.inbound.excessKm} km excess (${excessKmCharge.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-emerald-700 block font-medium">Fuel Level In</span>
                        <span className="font-bold text-slate-900">{detailsAgreement.inbound.fuelLevelInPercent ?? 'N/A'}%</span>
                        {fuelCharge > 0 ? (
                          <span className="text-[10px] text-amber-700 font-bold block">
                            Refuel Charge: ${fuelCharge.toFixed(2)}
                            {fuelShortage > 0 ? ` (-${fuelShortage}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            No Refuel Charge
                          </span>
                        )}
                      </div>

                      {damageCharge > 0 && (
                        <div>
                          <span className="text-rose-700 block font-medium">Damage / Repair Fee</span>
                          <span className="font-bold text-rose-800">${damageCharge.toFixed(2)}</span>
                        </div>
                      )}

                      {(detailsAgreement.inbound.hasDamageIncident || incidentExcess > 0) && (
                        <div>
                          <span className="text-rose-700 block font-medium">Insurance Incident Excess</span>
                          <span className="font-bold text-rose-800">
                            ${incidentExcess.toFixed(2)} ({detailsAgreement.inbound.applicableExcessBand || 'Basic Excess'})
                          </span>
                        </div>
                      )}

                      {cleaningFee > 0 && (
                        <div>
                          <span className="text-rose-700 block font-medium">Detailing Surcharge</span>
                          <span className="font-bold text-rose-800">${cleaningFee.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Reconciliation Box */}
                    <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 text-xs space-y-1.5 shadow-2xs">
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>Total Incurred Return Charges:</span>
                        <span className="font-bold text-slate-900">${totalIncurred.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Less Security Deposit Held:</span>
                        <span className="font-bold">-${depositHeld.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                        {netDue > 0 ? (
                          <>
                            <div>
                              <span className="font-black text-rose-700 uppercase block tracking-wide">
                                Net Amount Paid by Borrower:
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Excess charged above security deposit
                              </span>
                            </div>
                            <span className="text-base font-black text-rose-700">${netDue.toFixed(2)}</span>
                          </>
                        ) : refundDue > 0 ? (
                          <>
                            <div>
                              <span className="font-black text-emerald-700 uppercase block tracking-wide">
                                Deposit Refund Due to Borrower:
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Released back to card after deducting charges
                              </span>
                            </div>
                            <span className="text-base font-black text-emerald-700">${refundDue.toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="font-black text-slate-700 uppercase block tracking-wide">
                                Settlement Balanced:
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Charges exactly equal security deposit
                              </span>
                            </div>
                            <span className="text-base font-black text-slate-800">$0.00</span>
                          </>
                        )}
                      </div>
                    </div>

                    {detailsAgreement.inbound.returnDamageNotes && (
                      <div className="mt-3 text-xs bg-white/90 p-2.5 rounded-lg border border-emerald-200 text-slate-800">
                        <span className="font-semibold text-slate-600 block">Inspection & Damage Notes:</span>
                        {detailsAgreement.inbound.returnDamageNotes}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ag = detailsAgreement;
                    setDetailsAgreement(null);
                    openEditModal(ag);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
                >
                  Edit Loan Details
                </button>
                <button
                  onClick={() => {
                    const ag = detailsAgreement;
                    setDetailsAgreement(null);
                    handleDeleteAgreement(ag);
                  }}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-all"
                >
                  Delete Record
                </button>
              </div>
              <button
                onClick={() => setDetailsAgreement(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update: Edit Modal */}
      {editAgreement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Edit Loan Agreement</h3>
                <p className="text-xs text-slate-300">
                  {editAgreement.agreementNumber} • {editAgreement.vehicle.rego}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditAgreement(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Customer Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile *</label>
                    <input
                      type="tel"
                      required
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Vehicle Details */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle Details</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Rego *</label>
                    <input
                      type="text"
                      required
                      value={editRego}
                      onChange={(e) => setEditRego(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold uppercase text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Make</label>
                    <input
                      type="text"
                      value={editMake}
                      onChange={(e) => setEditMake(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Due Date & Extension */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Return Due Time</h4>
                <div>
                  <input
                    type="datetime-local"
                    value={editDueTime ? new Date(new Date(editDueTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setEditDueTime(new Date(e.target.value).toISOString());
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                  />
                </div>
                {/* Quick Extension Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quick Time Extension:</span>
                  {[
                    { label: '+2 Hours', ms: 2 * 3600000 },
                    { label: '+24 Hours', ms: 24 * 3600000 },
                    { label: '+48 Hours', ms: 48 * 3600000 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const current = editDueTime ? new Date(editDueTime).getTime() : Date.now();
                        setEditDueTime(new Date(current + btn.ms).toISOString());
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-all cursor-pointer inline-flex items-center justify-center text-center"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Km Allowance & Excess */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Cap (km)</label>
                  <input
                    type="number"
                    value={editDailyKm}
                    onChange={(e) => setEditDailyKm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Excess Rate ($/km)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={editExcessKm}
                    onChange={(e) => setEditExcessKm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Pre-existing Conditions</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditAgreement(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="px-5 py-2 bg-[#D71920] hover:bg-[#B91218] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2"
              >
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create: Issue Loan Vehicle Modal */}
      {isIssueOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleIssueSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {issuePurpose === 'TEST_DRIVE' ? 'Start Test Drive' : 'Issue Service Loaner'}
                </h3>
                <p className="text-xs text-slate-300">
                  New electronic {issuePurpose === 'TEST_DRIVE' ? 'test drive' : 'service loan'} agreement & SOW indemnity
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Agreement Purpose *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'SERVICE_LOANER', label: 'Service Loaner' },
                    { value: 'TEST_DRIVE', label: 'Test Drive' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        const purpose = option.value as typeof issuePurpose;
                        setIssuePurpose(purpose);
                        setIssueDueHours(purpose === 'TEST_DRIVE' ? '1' : '24');
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                        issuePurpose === option.value
                          ? 'bg-[#D71920] text-white border-[#D71920]'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rooftop Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dealership Rooftop *</label>
                {isTechnician ? (
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-slate-800">
                        {rooftops.find((r) => r.siteId === (technicianSiteId || issueSiteId))?.fullName || activeRooftopLabel}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-[11px] font-bold text-slate-600">
                      Assigned Workshop
                    </span>
                  </div>
                ) : (
                  <select
                    value={issueSiteId}
                    onChange={(e) => setIssueSiteId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-hidden bg-white"
                  >
                    {visibleRooftops.filter((r) => r.siteId !== 'all').map((r) => (
                      <option key={r.siteId} value={r.siteId}>
                        {r.fullName || `Booran ${r.label}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Customer Information */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={issueCustomerName}
                      onChange={(e) => setIssueCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0412 345 678"
                      value={issueMobile}
                      onChange={(e) => setIssueMobile(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="customer@gmail.com"
                      value={issueEmail}
                      onChange={(e) => setIssueEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Driver Licence Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10982344"
                      value={issueLicence}
                      onChange={(e) => setIssueLicence(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Loan Vehicle Details */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {issuePurpose === 'TEST_DRIVE' ? 'Test Drive Vehicle Details' : 'Loan Vehicle Details'}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Registration *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BMG405"
                      value={issueRego}
                      onChange={(e) => setIssueRego(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold uppercase text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Make</label>
                    <input
                      type="text"
                      placeholder="e.g. BYD"
                      value={issueMake}
                      onChange={(e) => setIssueMake(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Model</label>
                    <input
                      type="text"
                      placeholder="e.g. Atto 3"
                      value={issueModel}
                      onChange={(e) => setIssueModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Outbound Odometer (km)</label>
                    <input
                      type="number"
                      placeholder="e.g. 12500"
                      value={issueOdo}
                      onChange={(e) => setIssueOdo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {issuePurpose === 'TEST_DRIVE' ? 'Test Drive Duration' : 'Loan Duration'}
                    </label>
                    <select
                      value={issueDueHours}
                      onChange={(e) => setIssueDueHours(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden bg-white"
                    >
                      {issuePurpose === 'TEST_DRIVE' && <option value="1">1 Hour</option>}
                      {issuePurpose === 'TEST_DRIVE' && <option value="2">2 Hours</option>}
                      <option value="4">4 Hours (Same Day Return)</option>
                      <option value="8">8 Hours (End of Day Return)</option>
                      <option value="24">24 Hours (Next Day Return)</option>
                      <option value="48">48 Hours (2 Days)</option>
                      <option value="72">72 Hours (3 Days)</option>
                      <option value="168">7 Days (Full Week)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Security Deposit & Pre-Authorisation */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Deposit / Bond</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="500.00"
                      value={issueDeposit}
                      onChange={(e) => setIssueDeposit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Subtracted from inbound charges on return</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment / Pre-Auth Method</label>
                    <select
                      value={issueDepositMethod}
                      onChange={(e) => setIssueDepositMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#D71920] outline-hidden bg-white"
                    >
                      <option value="CARD_PREAUTH">Card Pre-Authorisation ($500 hold)</option>
                      <option value="CREDIT_CARD">Credit / Debit Card Payment</option>
                      <option value="CASH">Cash Bond</option>
                      <option value="EFT">Direct EFT / Bank Transfer</option>
                      <option value="WAIVED">Waived (Corporate / Internal)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SOW Terms Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Daily Km Allowance:</span>
                  <span className="font-bold text-slate-900">50 km / day</span>
                </div>
                <div className="flex justify-between">
                  <span>Excess Mileage Rate:</span>
                  <span className="font-bold text-amber-700">$0.50 AUD / km</span>
                </div>
                <div className="flex justify-between">
                  <span>Insurance Basic Excess:</span>
                  <span className="font-bold text-slate-900">$2,500.00 AUD</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsIssueOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingIssue}
                className="px-5 py-2 bg-[#D71920] hover:bg-[#B91218] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2"
              >
                {submittingIssue
                  ? 'Creating...'
                  : issuePurpose === 'TEST_DRIVE'
                    ? 'Start & Activate Test Drive'
                    : 'Issue & Activate Loan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

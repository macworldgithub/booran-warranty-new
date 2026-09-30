'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../../components/header';
import { useToast } from '../../../components/toast';
import { api } from '../../../lib/api';
import { Site } from '../../../lib/types';

interface TechnicianPresence {
  technicianId: string;
  technicianName: string;
  email: string;
  siteId: string;
  siteName?: string;
  status: 'ON_SITE' | 'OFF_SITE';
  distanceMeters: number;
  speedKmh: number;
  currentActivity: string;
  activeRoNumber?: string;
  lastPingAt: string;
}

interface GeofenceEvent {
  technicianId: string;
  technicianName: string;
  eventType: 'ENTER' | 'EXIT';
  siteId: string;
  siteName?: string;
  distanceMeters?: number;
  activeRoNumber?: string;
  notes?: string;
  timestamp: string;
}

interface RoadTestTrip {
  id: string;
  repairOrder: string;
  registration: string;
  vehicleLabel: string;
  customerConcern: string;
  dateLabel: string;
  duration: string;
  distanceKm: number;
  maxSpeedKph: number;
  outcome: 'Passed' | 'Flagged';
  technician: string;
  notes: string;
}

const DEMO_ROAD_TEST_LOGS: RoadTestTrip[] = [
  {
    id: 'trip-1',
    repairOrder: 'RO-48291',
    registration: 'SGS 274',
    vehicleLabel: '2021 Holden Commodore RS-V Liftback',
    customerConcern: 'Intermittent shudder under light load at 60–80 km/h after transmission fluid service.',
    dateLabel: 'Today, 09:42 AM',
    duration: '14m 20s',
    distanceKm: 8.6,
    maxSpeedKph: 82,
    outcome: 'Flagged',
    technician: 'Marcus Vance',
    notes: 'Shudder reproduced at 68 km/h on incline along South Gippsland Hwy. Torque converter slip confirmed.',
  },
  {
    id: 'trip-2',
    repairOrder: 'RO-48305',
    registration: 'BWM 882',
    vehicleLabel: '2022 Hyundai Tucson Highlander AWD',
    customerConcern: 'Rattle from front-right suspension over sharp road joints.',
    dateLabel: 'Today, 08:15 AM',
    duration: '09m 10s',
    distanceKm: 5.2,
    maxSpeedKph: 64,
    outcome: 'Passed',
    technician: 'Sarah Jenkins',
    notes: 'Sway bar link replaced. Road test completed over speed bumps and railway crossing with no noise.',
  },
  {
    id: 'trip-3',
    repairOrder: 'RO-48319',
    registration: 'VIC 901',
    vehicleLabel: '2023 Kia Sportage GT-Line Diesel',
    customerConcern: 'Hesitation during acceleration from low speed.',
    dateLabel: 'Yesterday, 03:30 PM',
    duration: '18m 45s',
    distanceKm: 12.1,
    maxSpeedKph: 100,
    outcome: 'Passed',
    technician: 'David Chen',
    notes: 'MAF sensor recalibrated and adaptives reset. Vehicle accelerates cleanly throughout rev band.',
  },
];

export default function TestDrivesPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'geofence' | 'logs'>('geofence');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [sitesReady, setSitesReady] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [roster, setRoster] = useState<TechnicianPresence[]>([]);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [onSiteCount, setOnSiteCount] = useState<number>(0);
  const [offSiteCount, setOffSiteCount] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showRadiusModal, setShowRadiusModal] = useState<boolean>(false);
  const [editingRadius, setEditingRadius] = useState<number>(200);
  const [savingRadius, setSavingRadius] = useState<boolean>(false);
  const [applyToAllRooftops, setApplyToAllRooftops] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authorizedSiteIds, setAuthorizedSiteIds] = useState<string[]>([]);
  const isClerk = userRole.toUpperCase() === 'CLERK';
  const isTechnician = userRole.toUpperCase() === 'TECHNICIAN';

  // Client Vehicle Test Drive Logs State (MongoDB backed)
  const [testDriveLogs, setTestDriveLogs] = useState<any[]>([]);
  const [testDriveKpis, setTestDriveKpis] = useState<{
    totalDrives: number;
    passedCount: number;
    flaggedCount: number;
    autoVerifiedRate: number;
    avgMaxSpeed: number;
  }>({
    totalDrives: 0,
    passedCount: 0,
    flaggedCount: 0,
    autoVerifiedRate: 100,
    avgMaxSpeed: 0,
  });
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'Passed' | 'Flagged'>('all');
  const [logsSearch, setLogsSearch] = useState<string>('');
  const [selectedTripModal, setSelectedTripModal] = useState<any | null>(null);

  // CRUD Modal & Action States
  const [showCreateTripModal, setShowCreateTripModal] = useState<boolean>(false);
  const [editingTrip, setEditingTrip] = useState<any | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [submittingTrip, setSubmittingTrip] = useState<boolean>(false);

  const [tripForm, setTripForm] = useState({
    repairOrder: '',
    registration: '',
    vehicleLabel: '',
    customerConcern: '',
    technicianName: '',
    duration: '12m 30s',
    distanceKm: 6.5,
    maxSpeedKph: 72,
    outcome: 'Passed' as 'Passed' | 'Flagged',
    technicianNotes: '',
    siteId: '',
  });

  const handleOpenCreateTrip = () => {
    setEditingTrip(null);
    setTripForm({
      repairOrder: '',
      registration: '',
      vehicleLabel: '',
      customerConcern: '',
      technicianName: '',
      duration: '10m 00s',
      distanceKm: 5.2,
      maxSpeedKph: 68,
      outcome: 'Passed',
      technicianNotes: '',
      siteId: selectedSiteId && selectedSiteId !== 'all' ? selectedSiteId : sites[0]?.id || '',
    });
    setShowCreateTripModal(true);
  };

  const handleOpenEditTrip = (trip: any) => {
    setEditingTrip(trip);
    setTripForm({
      repairOrder: trip.repairOrder || '',
      registration: trip.registration || '',
      vehicleLabel: trip.vehicleLabel || '',
      customerConcern: trip.customerConcern || '',
      technicianName: trip.technicianName || '',
      duration: trip.duration || '10m 00s',
      distanceKm: trip.distanceKm ?? 5.0,
      maxSpeedKph: trip.maxSpeedKph ?? 65,
      outcome: trip.outcome || 'Passed',
      technicianNotes: trip.technicianNotes || '',
      siteId: trip.siteId || (selectedSiteId !== 'all' ? selectedSiteId : sites[0]?.id) || '',
    });
    setShowCreateTripModal(true);
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripForm.repairOrder.trim() || !tripForm.registration.trim()) {
      showToast('Repair Order and Registration are required', 'error');
      return;
    }
    setSubmittingTrip(true);
    try {
      if (editingTrip) {
        await api.updateTestDrive(editingTrip.id, {
          repairOrder: tripForm.repairOrder,
          registration: tripForm.registration,
          vehicleLabel: tripForm.vehicleLabel || `${tripForm.registration} Vehicle`,
          customerConcern: tripForm.customerConcern,
          technicianName: tripForm.technicianName,
          duration: tripForm.duration,
          distanceKm: Number(tripForm.distanceKm),
          maxSpeedKph: Number(tripForm.maxSpeedKph),
          outcome: tripForm.outcome,
          technicianNotes: tripForm.technicianNotes,
          siteId: tripForm.siteId,
        });
        showToast(`Trip ${editingTrip.id} updated successfully`, 'success');
        setEditingTrip(null);
        if (selectedTripModal && selectedTripModal.id === editingTrip.id) {
          setSelectedTripModal((prev: any) => ({ ...prev, ...tripForm }));
        }
      } else {
        await api.createTestDrive({
          repairOrder: tripForm.repairOrder,
          registration: tripForm.registration,
          vehicleLabel: tripForm.vehicleLabel || `${tripForm.registration} Vehicle`,
          customerConcern: tripForm.customerConcern,
          technicianName: tripForm.technicianName,
          duration: tripForm.duration,
          distanceKm: Number(tripForm.distanceKm),
          maxSpeedKph: Number(tripForm.maxSpeedKph),
          outcome: tripForm.outcome,
          technicianNotes: tripForm.technicianNotes,
          siteId: tripForm.siteId,
        });
        showToast('New test drive trip record created successfully', 'success');
      }
      setShowCreateTripModal(false);
      loadTestDriveLogs(selectedSiteId, outcomeFilter, logsSearch);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save trip', 'error');
    } finally {
      setSubmittingTrip(false);
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm(`Are you sure you want to permanently delete trip record ${id}?`)) return;
    setDeletingTripId(id);
    try {
      await api.deleteTestDrive(id);
      showToast(`Trip ${id} deleted successfully`, 'success');
      if (selectedTripModal && selectedTripModal.id === id) {
        setSelectedTripModal(null);
      }
      loadTestDriveLogs(selectedSiteId, outcomeFilter, logsSearch);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete trip', 'error');
    } finally {
      setDeletingTripId(null);
    }
  };

  // Load current user profile, assigned rooftops, and geofence sites
  useEffect(() => {
    let cancelled = false;
    async function initSites() {
      try {
        const [user, siteList] = await Promise.all([
          api.getMe().catch(() => null),
          api.getSites(),
        ]);
        if (cancelled) return;

        const storedUser = (() => {
          try {
            const raw = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
            return raw ? JSON.parse(raw) : {};
          } catch {
            return {};
          }
        })();
        const role = String(user?.role || storedUser.role || '').toUpperCase();
        if (role === 'TECHNICIAN') {
          router.replace('/cases');
          return;
        }

        setUserRole(role);
        setIsAdmin(role === 'ADMIN');
        const assigned: string[] = Array.isArray(user?.authorizedSiteIds)
          ? user.authorizedSiteIds
          : Array.isArray(storedUser.authorizedSiteIds)
            ? storedUser.authorizedSiteIds
            : user?.defaultSiteId || storedUser.defaultSiteId
              ? [user?.defaultSiteId || storedUser.defaultSiteId]
              : [];
        setAuthorizedSiteIds(assigned);

        let visibleSites = siteList || [];
        if (role === 'CLERK') {
          visibleSites = visibleSites.filter((site) => assigned.includes(site.id));
        }
        setSites(visibleSites);
        if (role === 'CLERK') {
          setSelectedSiteId(visibleSites.length === 1 ? visibleSites[0].id : 'all');
        } else if (visibleSites.length > 0) {
          setSelectedSiteId((current) =>
            visibleSites.some((site) => site.id === current) ? current : visibleSites[0].id
          );
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        if (!cancelled) setSitesReady(true);
      }
    }
    initSites();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadGeofenceData = useCallback(async (siteId: string) => {
    try {
      setLoading(true);
      const [rosterRes, eventsRes] = await Promise.all([
        api.getGeofenceRoster(siteId).catch(() => null),
        api.getGeofenceEvents(siteId, 30).catch(() => []),
      ]);

      if (rosterRes && rosterRes.roster) {
        setRoster(rosterRes.roster);
        setOnSiteCount(rosterRes.onSiteCount ?? 0);
        setOffSiteCount(rosterRes.offSiteCount ?? 0);
      } else {
        // Fallback demo seed if empty
        const fallback: TechnicianPresence[] = [
          {
            technicianId: 'tech-1',
            technicianName: 'Marcus Vance',
            email: 'marcus.v@booran.com.au',
            siteId: siteId,
            siteName: 'Booran BYD Cranbourne',
            status: 'OFF_SITE',
            distanceMeters: 1850,
            speedKmh: 48,
            currentActivity: 'ROAD_TEST',
            activeRoNumber: 'RO-48291',
            lastPingAt: new Date(Date.now() - 45000).toISOString(),
          },
          {
            technicianId: 'tech-2',
            technicianName: 'Sarah Jenkins',
            email: 'sarah.j@booran.com.au',
            siteId: siteId,
            siteName: 'Booran BYD Cranbourne',
            status: 'ON_SITE',
            distanceMeters: 42,
            speedKmh: 0,
            currentActivity: 'WORKSHOP',
            activeRoNumber: undefined,
            lastPingAt: new Date(Date.now() - 12000).toISOString(),
          },
          {
            technicianId: 'tech-3',
            technicianName: 'David Chen',
            email: 'david.c@booran.com.au',
            siteId: siteId,
            siteName: 'Booran BYD Cranbourne',
            status: 'ON_SITE',
            distanceMeters: 28,
            speedKmh: 0,
            currentActivity: 'INSPECTION',
            activeRoNumber: 'RO-48319',
            lastPingAt: new Date(Date.now() - 80000).toISOString(),
          },
        ];
        setRoster(fallback);
        setOnSiteCount(2);
        setOffSiteCount(1);
      }

      setEvents(eventsRes || []);
    } catch (err) {
      console.error('Error fetching geofence data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveRadius = async () => {
    if (!isAdmin) {
      showToast('Only Administrators are authorized to adjust rooftop perimeter radius', 'error');
      return;
    }
    if (!selectedSiteId) return;
    setSavingRadius(true);
    try {
      if (applyToAllRooftops) {
        await Promise.all(
          sites.map((s) => api.updateSite(s.id, { geofenceRadiusMeters: editingRadius }))
        );
        setSites((prev) =>
          prev.map((s) => ({ ...s, geofenceRadiusMeters: editingRadius }))
        );
        showToast(`Geofence boundary updated to ${editingRadius}m across all ${sites.length} rooftops`, 'success');
      } else {
        await api.updateSite(selectedSiteId, { geofenceRadiusMeters: editingRadius });
        setSites((prev) =>
          prev.map((s) => (s.id === selectedSiteId ? { ...s, geofenceRadiusMeters: editingRadius } : s))
        );
        showToast(`Geofence boundary updated to ${editingRadius}m for ${activeSite?.name}`, 'success');
      }
      setShowRadiusModal(false);
      loadGeofenceData(selectedSiteId);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to update radius', 'error');
    } finally {
      setSavingRadius(false);
    }
  };

  useEffect(() => {
    if (selectedSiteId) {
      loadGeofenceData(selectedSiteId);
    }
  }, [selectedSiteId, loadGeofenceData]);

  // Periodic poll every 15s if autoRefresh is active
  useEffect(() => {
    if (!autoRefresh || !selectedSiteId) return;
    const interval = setInterval(() => {
      loadGeofenceData(selectedSiteId);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedSiteId, loadGeofenceData]);

  const loadTestDriveLogs = useCallback(async (siteId?: string, outcome?: string, search?: string) => {
    try {
      setLogsLoading(true);
      const targetSite = siteId !== undefined ? siteId : selectedSiteId;
      const targetOutcome = outcome !== undefined ? outcome : outcomeFilter;
      const targetSearch = search !== undefined ? search : logsSearch;

      const res = await api.getTestDrives({
        siteId: targetSite,
        outcome: targetOutcome !== 'all' ? targetOutcome : undefined,
        ro: targetSearch || undefined,
      });

      if (res && res.items) {
        setTestDriveLogs(res.items);
        if (res.kpis) setTestDriveKpis(res.kpis);
      }
    } catch (err) {
      console.error('Failed to load test drive logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedSiteId, outcomeFilter, logsSearch]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadTestDriveLogs(selectedSiteId, outcomeFilter, logsSearch);
    }
  }, [activeTab, selectedSiteId, outcomeFilter, loadTestDriveLogs, logsSearch]);

  const activeSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Test Drives & Staff Geofence"
        subtitle="Real-time dealership rooftop perimeter tracking, technician on/off site presence, and customer road-test diagnostics"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar: Site Selector & Tabs */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dealership Rooftop:
            </span>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11F26]"
            >
              {sites.length > 1 && (
                <option value="all">
                  {isClerk ? 'All Assigned Rooftops' : 'All Dealership Rooftops'} ({sites.length})
                </option>
              )}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roPrefix})
                </option>
              ))}
            </select>

            {selectedSiteId === 'all' ? (
              <span className="text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                📍 {isClerk ? 'Assigned Dealership Rooftops' : 'All Rooftops'} • {sites.length} Locations Monitored
              </span>
            ) : activeSite?.latitude && activeSite?.longitude ? (
              <span className="text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                📍 {activeSite.latitude.toFixed(4)}, {activeSite.longitude.toFixed(4)} • {activeSite.geofenceRadiusMeters ?? 200}m
              </span>
            ) : (
              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                ⚠ Coordinates not configured for this rooftop
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* View Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('geofence')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'geofence'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Geofence & Staff Presence
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Client Test Drive Logs
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                loadGeofenceData(selectedSiteId);
                showToast('Geofence presence refreshed', 'success');
              }}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Refresh Roster"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* TAB 1: GEOFENCE & STAFF PRESENCE */}
        {activeTab === 'geofence' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Technicians
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    👥
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{roster.length}</span>
                  <span className="text-xs font-semibold text-slate-500">tracked on shift</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    On-Site (In Bays)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-600">{onSiteCount}</span>
                  <span className="text-xs font-semibold text-emerald-700">inside boundary</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Off-Site (Road Test / Roving)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-600">{offSiteCount}</span>
                  <span className="text-xs font-semibold text-amber-700">outside perimeter</span>
                </div>
              </div>

              <div
                onClick={() => {
                  if (!isAdmin) return;
                  setEditingRadius(activeSite?.geofenceRadiusMeters ?? 200);
                  setShowRadiusModal(true);
                }}
                className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all ${
                  isAdmin
                    ? 'hover:border-[#E11F26] hover:shadow-md cursor-pointer group'
                    : 'cursor-default'
                }`}
                title={isAdmin ? 'Click to adjust rooftop perimeter radius' : 'Dealership rooftop perimeter boundary (Admin configured)'}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Perimeter Radius
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <span className="text-[11px] font-bold text-[#E11F26] opacity-0 group-hover:opacity-100 transition-opacity">
                        Adjust ✎
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      🛡
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {selectedSiteId === 'all' ? 'Multi-Site' : (activeSite?.geofenceRadiusMeters ?? 200)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedSiteId === 'all' ? 'geofenced boundaries' : 'meters boundary'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{isClerk ? 'Assigned Rooftops' : 'All Dealership Rooftops'}</span>
                  {isAdmin ? (
                    <span className="text-[#E11F26] font-semibold underline">Adjust</span>
                  ) : (
                    <span className="text-slate-400 font-medium">Admin Controlled</span>
                  )}
                </p>
              </div>
            </div>

            {/* Live Technician Presence Roster Table (Available to Admin and Warranty Clerks) */}
            {(isAdmin || isClerk) && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Dealership Rooftop Staff Roster
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time presence based on mobile telemetry pings relative to {selectedSiteId === 'all' ? (isClerk ? 'assigned dealership rooftops' : 'all dealership rooftops') : (activeSite?.name || 'Dealership Rooftop')}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Syncing Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-6">Technician</th>
                      <th className="py-3 px-6">Presence State</th>
                      <th className="py-3 px-6">Workshop Proximity</th>
                      <th className="py-3 px-6">Current Activity</th>
                      <th className="py-3 px-6">Active Repair Order</th>
                      <th className="py-3 px-6">Speed</th>
                      <th className="py-3 px-6">Last Ping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400">
                          No technicians tracked for this rooftop currently.
                        </td>
                      </tr>
                    ) : (
                      roster.map((tech) => {
                        const isOnSite = tech.status === 'ON_SITE';
                        return (
                          <tr key={tech.technicianId} className="hover:bg-slate-50/60 transition-colors">
                            {/* Technician */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                                  {tech.technicianName.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{tech.technicianName}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">{tech.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-6">
                              <span
                                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                                  isOnSite
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isOnSite ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'
                                  }`}
                                />
                                {isOnSite ? 'ON-SITE' : 'OFF-SITE'}
                              </span>
                            </td>

                            {/* Distance */}
                            <td className="py-4 px-6 font-medium text-slate-700">
                              {isOnSite ? (
                                <span className="text-emerald-700 font-semibold">
                                  ~{tech.distanceMeters}m (Inside {activeSite?.geofenceRadiusMeters ?? 200}m)
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold font-mono">
                                  {(tech.distanceMeters / 1000).toFixed(2)} km from workshop
                                </span>
                              )}
                            </td>

                            {/* Activity */}
                            <td className="py-4 px-6">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                  tech.currentActivity === 'ROAD_TEST'
                                    ? 'bg-red-50 text-[#E11F26] border border-red-200'
                                    : tech.currentActivity === 'INSPECTION'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {tech.currentActivity}
                              </span>
                            </td>

                            {/* Active RO */}
                            <td className="py-4 px-6">
                              {tech.activeRoNumber ? (
                                <span className="font-mono font-bold text-[#E11F26] bg-red-50/70 border border-red-100 px-2 py-0.5 rounded text-[11px]">
                                  {tech.activeRoNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Speed */}
                            <td className="py-4 px-6 font-mono text-slate-700">
                              {tech.speedKmh > 0 ? (
                                <span className="font-bold text-slate-900">{tech.speedKmh} km/h</span>
                              ) : (
                                <span className="text-slate-400">0 km/h</span>
                              )}
                            </td>

                            {/* Last Ping */}
                            <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                              {tech.lastPingAt
                                ? new Date(tech.lastPingAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : 'Active'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* Geofence Perimeter Transition History */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Recent Geofence Perimeter Crossing Events
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Automated logs recorded when staff or vehicles leave and return across the {activeSite?.geofenceRadiusMeters ?? 200}m boundary.
              </p>

              <div className="space-y-3">
                {events.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    No crossing transitions recorded yet today for this site.
                  </div>
                ) : (
                  events.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                            ev.eventType === 'EXIT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ev.eventType === 'EXIT' ? '↗' : '↙'}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900">{ev.technicianName}</span>
                          <span className="text-slate-500 ml-2">
                            {ev.eventType === 'EXIT'
                              ? 'Exited workshop perimeter (Off-site)'
                              : 'Returned to workshop perimeter (On-site)'}
                          </span>
                          {ev.activeRoNumber && (
                            <span className="font-mono text-[#E11F26] ml-2 font-bold">
                              [{ev.activeRoNumber}]
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px]">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENT VEHICLE TEST DRIVE LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* Top KPI Cards for Road Test Telemetry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Test Drives
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    🚗
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{testDriveKpis.totalDrives}</span>
                  <span className="text-xs font-semibold text-slate-500">trips recorded</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Auto-Verified Perimeter
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    ✓
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-600">{testDriveKpis.autoVerifiedRate}%</span>
                  <span className="text-xs font-semibold text-emerald-700">geofence verified</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Avg Max Speed
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{testDriveKpis.avgMaxSpeed}</span>
                  <span className="text-xs font-semibold text-slate-500">km/h highway</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Flagged for Warranty
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E11F26] flex items-center justify-center font-bold">
                    🚩
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#E11F26]">{testDriveKpis.flaggedCount}</span>
                  <span className="text-xs font-semibold text-red-600">faults confirmed</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    placeholder="Search by RO, Rego, VIN, or Tech..."
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E11F26] transition-all"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                </div>
                {logsSearch && (
                  <button
                    onClick={() => setLogsSearch('')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setOutcomeFilter('all')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      outcomeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Drives ({testDriveKpis.totalDrives})
                  </button>
                  <button
                    onClick={() => setOutcomeFilter('Passed')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      outcomeFilter === 'Passed'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Passed ({testDriveKpis.passedCount})
                  </button>
                  <button
                    onClick={() => setOutcomeFilter('Flagged')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      outcomeFilter === 'Flagged'
                        ? 'bg-white text-red-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Flagged ({testDriveKpis.flaggedCount})
                  </button>
                </div>

                <button
                  onClick={() => {
                    loadTestDriveLogs(selectedSiteId, outcomeFilter, logsSearch);
                    showToast('Road test logs refreshed', 'success');
                  }}
                  className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="Refresh Test Drive Logs"
                >
                  <svg className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreateTrip}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#E11F26] hover:bg-[#c91920] rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Log Road Test</span>
                </button>
              </div>
            </div>

            {/* Test Drive Logs List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Client Vehicle Road Test Records
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live GPS and diagnostic telemetry linked to active customer Repair Orders
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Showing {testDriveLogs.length} logged drives
                </span>
              </div>

              {logsLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-[#E11F26] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-semibold">Loading live test drive records...</p>
                </div>
              ) : testDriveLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <span className="text-3xl block">🚙</span>
                  <p className="text-sm font-bold text-slate-800">No test drive records found</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Start a live road test in the mobile app under the Test Drive tab to record real GPS routes, boundary crossings, and diagnostic findings.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {testDriveLogs.map((trip: any) => {
                    const isFlagged = trip.outcome === 'Flagged';
                    const tripDate = trip.startTime ? new Date(trip.startTime) : new Date();
                    const dateFormatted = tripDate.toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    const timeFormatted = tripDate.toLocaleTimeString('en-AU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={trip.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                {trip.repairOrder}
                              </span>
                              <span className="font-mono font-bold text-xs bg-red-50 text-[#E11F26] px-2.5 py-0.5 rounded-lg border border-red-200">
                                {trip.registration}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                  isFlagged
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isFlagged ? '🚩 Outcome: Flagged (Fault)' : '✓ Outcome: Passed (Clear)'}
                              </span>
                              {trip.isLiveGps && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  🛰 Live GPS Verified
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              {trip.vehicleLabel}
                              {trip.vin && (
                                <span className="font-mono text-[11px] font-normal text-slate-400">
                                  VIN: ...{trip.vin.slice(-6)}
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Customer: <strong className="text-slate-700">{trip.customerName || 'Customer'}</strong> • Rooftop: {trip.siteName}
                            </p>
                          </div>

                          <div className="text-right text-xs font-mono text-slate-500">
                            <div>{dateFormatted} at {timeFormatted}</div>
                            <div className="text-slate-800 font-semibold mt-0.5">
                              Tech: {trip.technicianName}
                            </div>
                          </div>
                        </div>

                        {/* Customer Fault Concern */}
                        {trip.customerConcern ? (
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs mb-3">
                            <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px] mb-0.5">
                              Customer Fault Concern
                            </span>
                            <p className="text-slate-800 font-medium">{trip.customerConcern}</p>
                          </div>
                        ) : null}

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Duration</span>
                            <span className="font-bold text-slate-900">{trip.duration}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Distance</span>
                            <span className="font-bold text-slate-900">{trip.distanceKm} km</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Max Speed</span>
                            <span className="font-bold text-slate-900">{trip.maxSpeedKph} km/h</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Perimeter Return</span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                              ✓ Auto-Verified
                            </span>
                          </div>
                        </div>

                        {/* Technician Diagnostic Observations */}
                        <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 mb-3">
                          <strong className="text-slate-800">Technician Observations & Diagnostic Findings: </strong>
                          {trip.technicianNotes || 'Road test completed and verified within dealership parameters.'}
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setSelectedTripModal(trip)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>🛰</span> Inspect Route
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTrip(trip)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrip(trip.id)}
                              disabled={deletingTripId === trip.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>{deletingTripId === trip.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                            <a
                              href={`/cases?search=${encodeURIComponent(trip.repairOrder)}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#E11F26] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                            >
                              <span>📂</span> Case ({trip.repairOrder})
                            </a>
                          </div>

                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {trip.id}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Geofence Radius Adjustment Modal (All Admins Authority) */}
      {showRadiusModal && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowRadiusModal(false)}
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Adjust Geofence Perimeter Radius
                </h3>
                <p className="text-xs text-slate-500">
                  Authorized for All Admins across Booran rooftops
                </p>
              </div>
              <button
                onClick={() => setShowRadiusModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Dealership Rooftop:
                </label>
                <select
                  value={selectedSiteId}
                  disabled={applyToAllRooftops}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    const s = sites.find((x) => x.id === e.target.value);
                    if (s) setEditingRadius(s.geofenceRadiusMeters ?? 200);
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11F26] disabled:opacity-50"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.roPrefix}) — currently {s.geofenceRadiusMeters ?? 200}m
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  New Perimeter Boundary:
                </label>
                <span className="font-mono text-sm font-black text-[#E11F26] bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                  {editingRadius} meters
                </span>
              </div>

              <input
                type="range"
                min="50"
                max="800"
                step="25"
                value={editingRadius}
                onChange={(e) => setEditingRadius(parseInt(e.target.value, 10))}
                className="w-full accent-[#E11F26] cursor-pointer"
              />

              <div className="flex items-center justify-between gap-1.5 pt-1">
                {[100, 150, 200, 250, 350, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEditingRadius(val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      editingRadius === val
                        ? 'bg-red-50 border-[#E11F26] text-[#E11F26] font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {val}m
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="applyAll"
                  checked={applyToAllRooftops}
                  onChange={(e) => setApplyToAllRooftops(e.target.checked)}
                  className="w-4 h-4 rounded text-[#E11F26] focus:ring-[#E11F26] border-slate-300 cursor-pointer"
                />
                <label htmlFor="applyAll" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Apply this {editingRadius}m radius to ALL {sites.length} rooftops
                </label>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                All Admins have unrestricted group authority to manage site geofence radiuses for all rooftops. Technicians crossing this perimeter trigger automated OFF-SITE road-test telemetry.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRadiusModal(false)}
                className="btn-ghost text-xs px-4 py-2 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRadius}
                onClick={handleSaveRadius}
                className="btn-primary text-xs px-5 py-2 rounded-xl font-bold disabled:opacity-50 cursor-pointer"
              >
                {savingRadius
                  ? 'Saving...'
                  : applyToAllRooftops
                  ? `Update All ${sites.length} Rooftops`
                  : 'Save Rooftop Radius'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Route & Telemetry Inspection Modal */}
      {selectedTripModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedTripModal(null)}
        >
          <div
            className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E11F26] flex items-center justify-center text-lg font-bold">
                  🛰
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Road Test Telemetry & GPS Route
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedTripModal.outcome === 'Flagged'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {selectedTripModal.outcome === 'Flagged' ? '🚩 Flagged' : '✓ Passed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedTripModal.repairOrder} • {selectedTripModal.registration} • {selectedTripModal.vehicleLabel}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTripModal(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Scroll */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* SVG GPS Route Map */}
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-inner relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE GPS BREADCRUMB REPLAY
                  </span>
                  <span className="font-mono text-slate-400">
                    {selectedTripModal.siteName} (Perimeter 200m)
                  </span>
                </div>

                <div className="w-full aspect-2/1 bg-slate-950/80 rounded-xl relative overflow-hidden border border-slate-800/80 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full p-3">
                    {/* Concentric boundary rings around dealership center (18, 68) */}
                    <circle cx="18" cy="68" r="16" fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="0.8" strokeDasharray="2 2" />
                    <circle cx="18" cy="68" r="26" fill="none" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="0.6" strokeDasharray="3 3" />

                    {/* Dealership marker */}
                    <circle cx="18" cy="68" r="3.2" fill="#E11F26" />
                    <circle cx="18" cy="68" r="1.5" fill="#FFFFFF" />
                    <text x="23" y="70" fill="#E2E8F0" fontSize="3" fontWeight="bold" fontFamily="monospace">
                      WORKSHOP
                    </text>

                    {/* Polyline Route */}
                    {(() => {
                      const pts = selectedTripModal.routePoints && selectedTripModal.routePoints.length > 1
                        ? selectedTripModal.routePoints
                        : [
                            { x: 18, y: 68, speed: 0 },
                            { x: 18, y: 65, speed: 14 },
                            { x: 19, y: 58, speed: 32 },
                            { x: 23, y: 54, speed: 48 },
                            { x: 31, y: 55, speed: 60 },
                            { x: 42, y: 62, speed: 68 },
                            { x: 50, y: 68, speed: 74 },
                            { x: 62, y: 76, speed: 76 },
                            { x: 74, y: 79, speed: 71 },
                            { x: 84, y: 72, speed: 58 },
                            { x: 80, y: 58, speed: 46 },
                            { x: 68, y: 44, speed: 62 },
                            { x: 55, y: 35, speed: 66 },
                            { x: 44, y: 28, speed: 52 },
                            { x: 35, y: 24, speed: 48 },
                            { x: 26, y: 22, speed: 36 },
                            { x: 21, y: 32, speed: 28 },
                            { x: 18, y: 48, speed: 20 },
                            { x: 18, y: 68, speed: 0 },
                          ];
                      const polyPoints = pts.map((p: any) => `${p.x},${p.y}`).join(' ');

                      return (
                        <>
                          <polyline
                            points={polyPoints}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {pts.map((p: any, idx: number) => {
                            if (idx % 3 !== 0 && idx !== pts.length - 1) return null;
                            const isHighSpeed = (p.speed || 0) >= 70;
                            return (
                              <g key={idx}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isHighSpeed ? '1.8' : '1.2'}
                                  fill={isHighSpeed ? '#EF4444' : '#10B981'}
                                />
                                {isHighSpeed && (
                                  <text
                                    x={p.x + 2}
                                    y={p.y - 1}
                                    fill="#F87171"
                                    fontSize="2.5"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                  >
                                    {p.speed}k
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  <div className="absolute bottom-2 right-3 flex items-center gap-3 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Sub-60 km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 70+ km/h Sector
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                  <span className="text-sm font-black text-slate-900">{selectedTripModal.duration}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Distance</span>
                  <span className="text-sm font-black text-slate-900">{selectedTripModal.distanceKm} km</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Speed</span>
                  <span className="text-sm font-black text-slate-900">{selectedTripModal.maxSpeedKph} km/h</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Technician</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">{selectedTripModal.technicianName}</span>
                </div>
              </div>

              {/* Customer Concern vs Diagnostic Findings */}
              <div className="space-y-3">
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs">
                  <span className="font-bold text-amber-800 uppercase tracking-wider block text-[10px] mb-1">
                    Customer Reported Concern:
                  </span>
                  <p className="text-slate-800 font-medium">{selectedTripModal.customerConcern || 'Diagnostic verification'}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[10px] mb-1">
                    Technician Observations & Diagnostic Notes:
                  </span>
                  <p className="text-slate-900 leading-relaxed font-normal">
                    {selectedTripModal.technicianNotes || 'Road test completed and verified within dealership parameters.'}
                  </p>
                </div>
              </div>

              {/* OEM Warranty Compliance Certificate Banner */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-emerald-600">🛡</span>
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      OEM Warranty Audit Defense Compliance
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Geofence perimeter exit & return timestamps electronically verified against Repair Order {selectedTripModal.repairOrder}.
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-800 bg-white px-2 py-1 rounded-lg border border-emerald-200 shrink-0">
                  VERIFIED
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-[11px] font-mono text-slate-400">
                Log ID: {selectedTripModal.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditTrip(selectedTripModal)}
                  className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                >
                  ✏️ Edit Record
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTrip(selectedTripModal.id)}
                  className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                >
                  🗑️ Delete
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  🖨 Print Summary
                </button>
                <a
                  href={`/cases?search=${encodeURIComponent(selectedTripModal.repairOrder)}`}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#E11F26] hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Open Warranty Case
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Trip Record Modal */}
      {showCreateTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div
            className="fixed inset-0"
            onClick={() => setShowCreateTripModal(false)}
          />

          <div className="relative bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl z-10 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#E11F26] block">
                  {editingTrip ? 'Update Record' : 'Manual Entry'}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {editingTrip ? 'Edit Test Drive Trip' : 'Log New Road Test Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTripModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Repair Order # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RO-48291"
                    value={tripForm.repairOrder}
                    onChange={(e) => setTripForm({ ...tripForm, repairOrder: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registration Plate *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SGS 274"
                    value={tripForm.registration}
                    onChange={(e) => setTripForm({ ...tripForm, registration: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vehicle Label / Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2021 Holden Commodore RS-V"
                    value={tripForm.vehicleLabel}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleLabel: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dealership Rooftop
                  </label>
                  <select
                    value={tripForm.siteId}
                    onChange={(e) => setTripForm({ ...tripForm, siteId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none cursor-pointer"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Diagnostic Outcome *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTripForm({ ...tripForm, outcome: 'Passed' })}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tripForm.outcome === 'Passed'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>✓</span> Passed (No Fault Duplicated)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripForm({ ...tripForm, outcome: 'Flagged' })}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tripForm.outcome === 'Flagged'
                        ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🚩</span> Flagged (Fault Found)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14m 20s"
                    value={tripForm.duration}
                    onChange={(e) => setTripForm({ ...tripForm, duration: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 8.6"
                    value={tripForm.distanceKm}
                    onChange={(e) => setTripForm({ ...tripForm, distanceKm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Speed (km/h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 78"
                    value={tripForm.maxSpeedKph}
                    onChange={(e) => setTripForm({ ...tripForm, maxSpeedKph: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Technician Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Vance"
                  value={tripForm.technicianName}
                  onChange={(e) => setTripForm({ ...tripForm, technicianName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Concern
                </label>
                <input
                  type="text"
                  placeholder="e.g. Intermittent shudder under load at 60-80 km/h"
                  value={tripForm.customerConcern}
                  onChange={(e) => setTripForm({ ...tripForm, customerConcern: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Diagnostic Findings & Road Test Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed notes on road test results, noise, vibration, speed conditions..."
                  value={tripForm.technicianNotes}
                  onChange={(e) => setTripForm({ ...tripForm, technicianNotes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E11F26] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateTripModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTrip}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#E11F26] hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingTrip ? 'Saving...' : editingTrip ? 'Update Trip Record' : 'Save Trip Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

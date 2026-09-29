'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

  const [activeTab, setActiveTab] = useState<'geofence' | 'logs'>('geofence');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('site_cranbourne_byd');
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
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  // Load current user profile & role
  useEffect(() => {
    api.getMe().then((user) => {
      if (user) {
        setUserRole(user.role || '');
        setIsAdmin((user.role || '').toUpperCase() === 'ADMIN');
      }
    }).catch(() => {});
  }, []);

  // Load sites
  useEffect(() => {
    async function initSites() {
      try {
        const siteList = await api.getSites();
        setSites(siteList);
        if (siteList.length > 0 && !selectedSiteId) {
          setSelectedSiteId(siteList[0].id);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    }
    initSites();
  }, []);

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
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roPrefix})
                </option>
              ))}
            </select>

            {activeSite?.latitude && activeSite?.longitude ? (
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
                  setEditingRadius(activeSite?.geofenceRadiusMeters ?? 200);
                  setShowRadiusModal(true);
                }}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-[#E11F26] hover:shadow-md transition-all cursor-pointer group"
                title="Click to adjust rooftop perimeter radius"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Perimeter Radius
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#E11F26] opacity-0 group-hover:opacity-100 transition-opacity">
                      Adjust ✎
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      🛡
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {activeSite?.geofenceRadiusMeters ?? 200}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">meters boundary</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>All Admins Authorized • All Rooftops</span>
                  <span className="text-[#E11F26] font-semibold underline">Adjust</span>
                </p>
              </div>
            </div>

            {/* Live Technician Presence Roster Table (Hidden from Technician Portal) */}
            {isAdmin && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Dealership Rooftop Staff Roster
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time presence based on mobile telemetry pings relative to {activeSite?.name}
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
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Client Vehicle Road Test Records
                  </h3>
                  <p className="text-xs text-slate-500">
                    Historical diagnostic drives linked to active customer Repair Orders
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {DEMO_ROAD_TEST_LOGS.map((trip) => (
                  <div key={trip.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            {trip.repairOrder}
                          </span>
                          <span className="font-mono font-bold text-xs bg-red-50 text-[#E11F26] px-2 py-0.5 rounded border border-red-200">
                            {trip.registration}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              trip.outcome === 'Passed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            Outcome: {trip.outcome}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{trip.vehicleLabel}</h4>
                      </div>

                      <div className="text-right text-xs font-mono text-slate-500">
                        <div>{trip.dateLabel}</div>
                        <div className="text-slate-700 font-semibold mt-0.5">Tech: {trip.technician}</div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs mb-3">
                      <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px] mb-0.5">
                        Customer Fault Concern
                      </span>
                      <p className="text-slate-800">{trip.customerConcern}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
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
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                      <strong className="text-slate-800">Technician Observations: </strong>
                      {trip.notes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Geofence Radius Adjustment Modal (All Admins Authority) */}
      {showRadiusModal && (
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
    </div>
  );
}

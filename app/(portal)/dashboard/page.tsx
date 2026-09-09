'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/header';
import { StatCard } from '../../../components/stat-card';
import { api } from '../../../lib/api';
import { DashboardKPIs, FlagReasonStat, SitePerformance } from '../../../lib/types';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [flagReasons, setFlagReasons] = useState<FlagReasonStat[]>([]);
  const [sites, setSites] = useState<SitePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiRes, flagRes, siteRes] = await Promise.all([
          api.getKPIs(),
          api.getFlagReasons(),
          api.getSitePerformance(),
        ]);
        setKpis(kpiRes);
        setFlagReasons(flagRes);
        setSites(siteRes);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Group Warranty Operations Dashboard"
        subtitle="Live cross-dealership KPIs, First-Time Pass Rates, and Flag Analytics"
        action={
          <Link
            href="/cases/new"
            className="btn-primary shadow-[0_0_20px_rgba(26,86,219,0.4)] text-xs py-2 px-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Start RO Capture</span>
          </Link>
        }
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
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
          <div className="lg:col-span-2 glass-card-static p-6 border border-[#1a56db]/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Dealership Rooftop Velocity & Quality</h3>
                  <p className="text-xs text-[#cbd5e1]/70">Pass rates before clerk submission</p>
                </div>
                <span className="text-xs text-[#00f0ff] font-semibold">Live Feed</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#cbd5e1]">
                  <thead className="border-b border-[#1a56db]/20 text-[#64748b] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3">Site Rooftop</th>
                      <th className="py-3 px-3 text-center">Cases</th>
                      <th className="py-3 px-3 text-center">1st-Time Pass</th>
                      <th className="py-3 px-3 text-center">Flagged</th>
                      <th className="py-3 px-3 text-right">Avg Velocity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a56db]/10">
                    {sites.map((site) => (
                      <tr key={site.siteId} className="hover:bg-[#132952]/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          {site.siteName}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-[#00f0ff]">
                          {site.totalCases}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-[#10b981]">
                            {site.firstTimePassRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {site.flaggedCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#ef4444]/20 text-[#ef4444] font-bold">
                              {site.flaggedCount}
                            </span>
                          ) : (
                            <span className="text-[#64748b]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-white">
                          {site.avgHoursToSubmit}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#1a56db]/10 flex items-center justify-between text-xs text-[#64748b]">
              <span>Group Average Pass Rate: <strong className="text-white">92.8%</strong></span>
              <Link href="/sites" className="text-[#00f0ff] hover:underline font-semibold">
                Manage Rooftops →
              </Link>
            </div>
          </div>

          {/* Top Failure / Retake Reasons */}
          <div className="glass-card-static p-6 border border-[#1a56db]/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Top Flagged Issues</h3>
                  <p className="text-xs text-[#cbd5e1]/70">Technician training insights</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              </div>

              <div className="space-y-4">
                {flagReasons.map((reason) => (
                  <div key={reason.reasonCode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#cbd5e1] truncate max-w-[200px]" title={reason.label}>
                        {reason.label}
                      </span>
                      <span className="font-bold text-[#ef4444] font-mono">{reason.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#081225] rounded-full overflow-hidden border border-[#1a56db]/20">
                      <div
                        className="h-full bg-gradient-to-r from-[#ef4444] to-[#f59e0b] rounded-full"
                        style={{ width: `${reason.percentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#64748b] text-right">{reason.count} occurrences</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-3 rounded-xl bg-[#1a56db]/10 border border-[#1a56db]/20 text-[11px] text-[#cbd5e1]">
              <strong className="text-[#00f0ff] block mb-0.5">Automated Gate Prevention:</strong>
              Mobile camera AI validation reduces blurry VIN & odometer submissions before repair begins.
            </div>
          </div>
        </div>

        {/* Quick Review Portal Banner */}
        <div className="glass-card p-6 border border-[#1a56db]/30 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-[#0d1b3e] via-[#132952] to-[#0d1b3e]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Warranty Clerk Review Queue</h4>
              <p className="text-xs text-[#cbd5e1]/80 mt-0.5">
                Review pending workshop cases, audit BYD Attachment A checklist gates, and export OEM ZIP packs.
              </p>
            </div>
          </div>
          <Link
            href="/cases"
            className="btn-primary text-xs py-2.5 px-6 whitespace-nowrap shadow-[0_0_20px_rgba(26,86,219,0.5)]"
          >
            Open Live Cases Queue →
          </Link>
        </div>
      </div>
    </div>
  );
}

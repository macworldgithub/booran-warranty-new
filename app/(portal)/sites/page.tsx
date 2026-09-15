'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { Site } from '../../../lib/types';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSites();
        setSites(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sites;
    const q = searchQuery.toLowerCase().trim();

    return sites.filter((site) => {
      const matchName = site.name?.toLowerCase().includes(q);
      const matchLocation = site.location?.toLowerCase().includes(q);
      const matchPrefix = site.roPrefix?.toLowerCase().includes(q);
      const matchBrand = site.authorizedBrandIds?.some((bid) =>
        bid.toLowerCase().replace('brand_', '').includes(q)
      );

      return matchName || matchLocation || matchPrefix || matchBrand;
    });
  }, [sites, searchQuery]);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Booran Dealership Sites & Rooftops"
        subtitle="Manage Victoria multi-brand dealership locations, authorized OEM franchises, and RO prefixes"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Search Toolbar */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search by rooftop name, location, prefix (e.g. DAN-), or OEM brand (e.g. BYD, Kia)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 pr-8 text-xs w-full"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-3 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-sm"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-900">{filteredSites.length}</strong> of{' '}
              <strong className="text-slate-900">{sites.length}</strong> dealerships
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#E11F26] hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Sites Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Loading dealership sites & rooftops...
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="bg-white p-12 text-center border border-slate-200 rounded-2xl shadow-sm">
            <div className="max-w-xs mx-auto space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">No dealership sites found</p>
              <p className="text-xs text-slate-500">
                No rooftop matched "{searchQuery}". Try searching by suburb or brand code.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-[#E11F26] hover:underline pt-2 inline-block"
              >
                View all rooftops
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSites.map((site) => (
              <div
                key={site.id}
                className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-300 hover:shadow-md transition-all shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{site.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{site.location}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    Active
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">RO Prefix:</span>
                    <strong className="font-mono text-slate-900 font-bold">{site.roPrefix}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1.5 font-medium">Authorized OEM Rosters:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {site.authorizedBrandIds.map((bid) => (
                        <span
                          key={bid}
                          className="px-2 py-0.5 rounded border border-slate-300 text-slate-800 bg-white font-mono font-bold text-[11px]"
                        >
                          {bid.replace('brand_', '').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { Site } from '../../../lib/types';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Booran Dealership Sites & Rooftops"
        subtitle="Manage Victoria multi-brand dealership locations, authorized OEM franchises, and RO prefixes"
      />

      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sites.map((site) => (
            <div
              key={site.id}
              className="glass-card p-6 border border-[#1a56db]/20 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white">{site.name}</h3>
                  <p className="text-xs text-[#cbd5e1]/70 mt-0.5">{site.location}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#10b981]/20 text-[#10b981] text-xs font-bold">
                  Active
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1a56db]/10 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">RO Prefix:</span>
                  <strong className="font-mono text-[#00f0ff]">{site.roPrefix}</strong>
                </div>
                <div>
                  <span className="text-[#64748b] block mb-1.5">Authorized OEM Rosters:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {site.authorizedBrandIds.map((bid) => (
                      <span
                        key={bid}
                        className="px-2 py-0.5 rounded bg-[#132952] text-white font-medium text-[11px]"
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
      </div>
    </div>
  );
}

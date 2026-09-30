'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Site, UserProfile } from '../lib/types';

export const ALL_ASSIGNED_SITES = 'ALL';

type ClerkSiteContextValue = {
  activeSiteId: string;
  assignedSites: Site[];
  setActiveSiteId: (siteId: string) => void;
};

const ClerkSiteContext = createContext<ClerkSiteContextValue>({
  activeSiteId: ALL_ASSIGNED_SITES,
  assignedSites: [],
  setActiveSiteId: () => undefined,
});

function storageKey(userId: string) {
  return `booran_active_site_${userId}`;
}

function fallbackSite(siteId: string): Site {
  const name = siteId
    .replace(/^site_/, '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return {
    id: siteId,
    name,
    location: '',
    roPrefix: '',
    authorizedBrandIds: [],
    isActive: true,
  };
}

export function ClerkSiteProvider({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const authorizedSiteIds = useMemo(
    () => (Array.isArray(user.authorizedSiteIds) ? user.authorizedSiteIds : []),
    [user.authorizedSiteIds],
  );
  const [assignedSites, setAssignedSites] = useState<Site[]>(() => authorizedSiteIds.map(fallbackSite));
  const [activeSiteId, setActiveSiteState] = useState(() => {
    if (typeof window === 'undefined' || user.role !== 'CLERK') return ALL_ASSIGNED_SITES;
    const stored = localStorage.getItem(storageKey(user.id));
    if (stored === ALL_ASSIGNED_SITES && authorizedSiteIds.length > 1) return stored;
    if (stored && authorizedSiteIds.includes(stored)) return stored;
    return authorizedSiteIds.length === 1 ? authorizedSiteIds[0] : ALL_ASSIGNED_SITES;
  });

  useEffect(() => {
    if (user.role !== 'CLERK') return;
    api.getSites()
      .then((sites) => setAssignedSites(sites.filter((site) => authorizedSiteIds.includes(site.id) && site.isActive !== false)))
      .catch(() => setAssignedSites(authorizedSiteIds.map(fallbackSite)));
  }, [authorizedSiteIds, user.role]);

  const setActiveSiteId = (siteId: string) => {
    if (user.role !== 'CLERK') return;
    if (siteId !== ALL_ASSIGNED_SITES && !authorizedSiteIds.includes(siteId)) return;
    setActiveSiteState(siteId);
    localStorage.setItem(storageKey(user.id), siteId);
  };

  return (
    <ClerkSiteContext.Provider value={{ activeSiteId, assignedSites, setActiveSiteId }}>
      {children}
    </ClerkSiteContext.Provider>
  );
}

export function useClerkSite() {
  return useContext(ClerkSiteContext);
}

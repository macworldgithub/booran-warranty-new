'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { UserProfile } from '../../../lib/types';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getUsers();
        setUsers(data);
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
        title="User Access & Role Management"
        subtitle="Group Admin, Warranty Clerks, Service Managers, and Workshop Technicians"
      />

      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="glass-card-static border border-[#1a56db]/20 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#081225]/80 border-b border-[#1a56db]/20 text-[#64748b] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Default Site</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a56db]/10">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#132952]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{u.name}</td>
                  <td className="py-3.5 px-4 text-[#cbd5e1] font-mono">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#1a56db]/20 text-[#00f0ff] font-semibold">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#cbd5e1]">{u.defaultSiteId}</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-bold">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

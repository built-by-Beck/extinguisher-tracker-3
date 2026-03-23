import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { OfflineBanner } from '../offline/OfflineBanner.tsx';
import { AiAssistantPanel } from '../ai/AiAssistantPanel.tsx';
import { useOrg } from '../../hooks/useOrg.ts';
import { hasFeature } from '../../lib/planConfig.ts';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { org } = useOrg();
  const hasAiAccess = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'aiAssistant',
    org?.plan
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Offline / sync status banner */}
        <OfflineBanner />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Global AI assistant for Pro, Elite, and Enterprise */}
        {hasAiAccess && <AiAssistantPanel />}
      </div>
    </div>
  );
}

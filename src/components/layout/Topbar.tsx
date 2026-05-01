import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import {
  Menu,
  ChevronDown,
  LogOut,
  User,
  Building2,
} from 'lucide-react';
import { storage } from '../../lib/firebase.ts';
import { hasFeature } from '../../lib/planConfig.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { NotificationBell } from '../notifications/NotificationBell.tsx';
import { PresetAvatar } from '../profile/PresetAvatar.tsx';

interface TopbarProps {
  onMenuClick: () => void;
}

function isSafeStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.googleapis.com') ||
        parsed.hostname.endsWith('.firebasestorage.app'))
    );
  } catch {
    return false;
  }
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, userProfile, signOut } = useAuth();
  const { org, userOrgs, switchOrg } = useOrg();
  const navigate = useNavigate();

  const orgId = userProfile?.activeOrgId ?? '';
  const canUseBranding = hasFeature(org?.featureFlags, 'organizationBranding', org?.plan);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const logoPath = org?.branding?.logoPath;
    if (!logoPath || !canUseBranding) {
      setOrgLogoUrl('');
      return;
    }

    let cancelled = false;
    getDownloadURL(storageRef(storage, logoPath))
      .then((url) => {
        if (!cancelled && isSafeStorageUrl(url)) setOrgLogoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setOrgLogoUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [canUseBranding, org?.branding?.logoPath]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  async function handleSwitchOrg(id: string) {
    await switchOrg(id);
    setOrgMenuOpen(false);
  }

  function handleNavigateProfile() {
    setUserMenuOpen(false);
    navigate('/dashboard/profile');
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left: hamburger + org name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Org switcher */}
        {userOrgs.length > 1 ? (
          <div className="relative" ref={orgMenuRef}>
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt="" className="h-5 w-5 rounded object-contain" />
              ) : (
                <Building2 className="h-4 w-4 text-gray-500" />
              )}
              {org?.name ?? 'Select Org'}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {orgMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {userOrgs.map((entry) => (
                  <button
                    key={entry.orgId}
                    onClick={() => handleSwitchOrg(entry.orgId)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{entry.orgId}</span>
                    <span className="ml-auto text-xs text-gray-400">{entry.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            {orgLogoUrl ? (
              <img src={orgLogoUrl} alt="" className="h-5 w-5 rounded object-contain" />
            ) : (
              <Building2 className="h-4 w-4 text-gray-500" />
            )}
            {org?.name ?? 'No Organization'}
          </div>
        )}
      </div>

      {/* Right: notification bell + user menu */}
      <div className="flex items-center gap-2">
        {orgId && <NotificationBell orgId={orgId} />}

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            <PresetAvatar avatarId={userProfile?.avatarId} size="sm" />
            <span className="hidden font-medium sm:inline">
              {user?.displayName ?? user?.email ?? 'User'}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="text-sm font-medium text-gray-900">
                  {user?.displayName ?? 'User'}
                </p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleNavigateProfile}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

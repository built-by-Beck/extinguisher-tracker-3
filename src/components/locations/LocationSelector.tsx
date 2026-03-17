import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  subscribeToLocations,
  getLocationPath,
  type Location,
} from '../../services/locationService.ts';

interface LocationSelectorProps {
  value: string | null;
  onChange: (locationId: string | null) => void;
}

export function LocationSelector({ value, onChange }: LocationSelectorProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  if (locations.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        <MapPin className="mr-1 inline h-4 w-4" />
        No locations defined. Add locations in the Locations page.
      </div>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
    >
      <option value="">-- No Location --</option>
      {locations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {getLocationPath(locations, loc.id!)}
        </option>
      ))}
    </select>
  );
}

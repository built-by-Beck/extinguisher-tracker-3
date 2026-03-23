/**
 * Data Organizer Page
 * Helps users fix incomplete imported data.
 * Route: /dashboard/data-organizer
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, Save, CheckSquare, Wrench } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import {
  subscribeToExtinguishers,
  updateExtinguisher,
  batchUpdateExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import { subscribeToLocations, type Location } from '../services/locationService.ts';

const EXTINGUISHER_TYPES = [
  'ABC Dry Chemical',
  'BC Dry Chemical',
  'CO2',
  'Water',
  'Water Mist',
  'Foam',
  'Halotron',
  'Purple K',
  'Clean Agent',
  'Wet Chemical',
  'Dry Powder (Class D)',
];

const EXTINGUISHER_SIZES = [
  '2.5 lb',
  '5 lb',
  '10 lb',
  '20 lb',
  '30 lb',
  'Other',
];

function getIssues(ext: Extinguisher): string[] {
  const issues: string[] = [];
  if (!ext.locationId && !ext.parentLocation) issues.push('No location');
  if (!ext.serial) issues.push('No serial');
  if (!ext.extinguisherType) issues.push('No type');
  if (!ext.manufactureYear) issues.push('No year');
  if (!ext.extinguisherSize) issues.push('No size');
  return issues;
}

export default function DataOrganizer() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';
  const { hasRole } = useOrg();

  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Edits state
  const [edits, setEdits] = useState<Record<string, Partial<Extinguisher>>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issueFilter, setIssueFilter] = useState<string>('all');

  // Bulk Assignment States
  const [bulkLocId, setBulkLocId] = useState('');
  const [bulkSection, setBulkSection] = useState('');

  useEffect(() => {
    if (!orgId) return;
    const unsubLocs = subscribeToLocations(orgId, setLocations);
    const unsubExts = subscribeToExtinguishers(
      orgId,
      (data) => {
        setExtinguishers(data);
        setLoading(false);
      },
      { noLimit: true },
    );
    return () => {
      unsubLocs();
      unsubExts();
    };
  }, [orgId]);

  const incomplete = useMemo(() => {
    return extinguishers.filter((ext) => {
      const issues = getIssues(ext);
      if (issues.length === 0) return false;
      if (issueFilter === 'all') return true;
      return issues.includes(issueFilter);
    });
  }, [extinguishers, issueFilter]);

  const handleEdit = (id: string, field: keyof Extinguisher, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (ext: Extinguisher) => {
    const extEdits = edits[ext.id!];
    if (!extEdits || !orgId || !ext.id) return;
    
    setSaving((prev) => {
      const next = new Set(prev);
      next.add(ext.id!);
      return next;
    });

    try {
      // If setting locationId, auto-set parentLocation name too
      const updateData = { ...extEdits };
      if (updateData.locationId) {
        const loc = locations.find((l) => l.id === updateData.locationId);
        if (loc) {
          updateData.parentLocation = loc.name;
        }
      }

      await updateExtinguisher(orgId, ext.id, updateData);
      
      // Clear edits for this row
      setEdits((prev) => {
        const next = { ...prev };
        delete next[ext.id!];
        return next;
      });
    } catch (err) {
      console.error('Failed to save row', err);
      alert('Failed to save changes.');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(ext.id!);
        return next;
      });
    }
  };

  const handleBulkAssign = async () => {
    if (!orgId || selected.size === 0) return;
    if (!bulkLocId && !bulkSection) {
      alert('Please select a location or enter a section to assign.');
      return;
    }

    setBulkSaving(true);
    try {
      const updates: Array<{ extId: string; data: Partial<Extinguisher> }> = [];
      const parentLoc = locations.find(l => l.id === bulkLocId)?.name;

      for (const extId of selected) {
        const data: Partial<Extinguisher> = {};
        if (bulkLocId) {
          data.locationId = bulkLocId;
          data.parentLocation = parentLoc || '';
        }
        if (bulkSection) {
          data.section = bulkSection;
        }
        updates.push({ extId, data });
      }

      await batchUpdateExtinguishers(orgId, updates);
      
      setSelected(new Set());
      setBulkLocId('');
      setBulkSection('');
    } catch (err) {
      console.error('Failed bulk assign', err);
      alert('Failed to apply bulk assignment.');
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === incomplete.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(incomplete.map((e) => e.id!)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!hasRole(['owner', 'admin'])) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-gray-500">You need owner or admin privileges to use the Data Organizer.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
          <Wrench className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Organizer</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fix missing data from imports. Currently {incomplete.length} extinguishers need attention.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Filter by Issue:</label>
        <select
          value={issueFilter}
          onChange={(e) => {
            setIssueFilter(e.target.value);
            setSelected(new Set());
          }}
          className="rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm shadow-sm focus:border-red-500 focus:ring-red-500"
        >
          <option value="all">All Issues</option>
          <option value="No location">No location</option>
          <option value="No serial">No serial</option>
          <option value="No type">No type</option>
          <option value="No year">No year</option>
          <option value="No size">No size</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg bg-orange-50 p-4 border border-orange-200 shadow-sm">
          <span className="font-semibold text-orange-800">
            {selected.size} selected
          </span>
          <div className="h-6 w-px bg-orange-300"></div>
          
          <select
            value={bulkLocId}
            onChange={(e) => setBulkLocId(e.target.value)}
            className="rounded-md border-orange-300 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
          >
            <option value="">Assign Location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Assign Section..."
            value={bulkSection}
            onChange={(e) => setBulkSection(e.target.value)}
            className="rounded-md border-orange-300 py-1.5 px-3 text-sm focus:border-orange-500 focus:ring-orange-500"
          />

          <button
            onClick={handleBulkAssign}
            disabled={bulkSaving || (!bulkLocId && !bulkSection)}
            className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            Apply to Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {incomplete.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <CheckSquare className="mb-3 h-8 w-8 text-green-500" />
            <p>All clean! No extinguishers are missing required data.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === incomplete.length && incomplete.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Asset ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-48">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Serial</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Issues</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {incomplete.map((ext) => {
                const isSelected = selected.has(ext.id!);
                const rowEdits = edits[ext.id!] || {};
                const isDirty = Object.keys(rowEdits).length > 0;
                const isSaving = saving.has(ext.id!);
                const issues = getIssues(ext);

                return (
                  <tr key={ext.id} className={isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(ext.id!)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link to={`/dashboard/inventory/${ext.id}`} className="text-red-600 hover:underline">
                        {ext.assetId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={(rowEdits.locationId !== undefined ? rowEdits.locationId : ext.locationId) ?? ''}
                        onChange={(e) => handleEdit(ext.id!, 'locationId', e.target.value)}
                        className="block w-full min-w-[120px] rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                      >
                        <option value="">{ext.parentLocation || 'Select Location'}</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={(rowEdits.section !== undefined ? rowEdits.section : ext.section) ?? ''}
                        onChange={(e) => handleEdit(ext.id!, 'section', e.target.value)}
                        className="block w-24 rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                        placeholder="Section"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={(rowEdits.serial !== undefined ? rowEdits.serial : ext.serial) ?? ''}
                        onChange={(e) => handleEdit(ext.id!, 'serial', e.target.value)}
                        className="block w-28 rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                        placeholder="Serial"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={(rowEdits.extinguisherType !== undefined ? rowEdits.extinguisherType : ext.extinguisherType) ?? ''}
                        onChange={(e) => handleEdit(ext.id!, 'extinguisherType', e.target.value)}
                        className="block w-32 rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                      >
                        <option value="">Select Type</option>
                        {EXTINGUISHER_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={(rowEdits.extinguisherSize !== undefined ? rowEdits.extinguisherSize : ext.extinguisherSize) ?? ''}
                        onChange={(e) => handleEdit(ext.id!, 'extinguisherSize', e.target.value)}
                        className="block w-24 rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                      >
                        <option value="">Select Size</option>
                        {EXTINGUISHER_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {issues.map(issue => (
                          <span key={issue} className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            <AlertTriangle className="h-3 w-3" />
                            {issue}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSaveRow(ext)}
                        disabled={!isDirty || isSaving}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

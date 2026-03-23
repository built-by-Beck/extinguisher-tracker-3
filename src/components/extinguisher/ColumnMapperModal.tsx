/**
 * Column Mapper — lets users map their file's column names to EX3 fields
 * before importing. Auto-suggests matches based on common naming patterns.
 *
 * Author: built_by_Beck
 */

import { useState, useMemo } from 'react';
import { ArrowRight, Check, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';

/** The EX3 fields that imported data can map to */
export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  /** Common aliases users might have in their files */
  aliases: string[];
}

export const TARGET_FIELDS: TargetField[] = [
  {
    key: 'assetId',
    label: 'Asset ID',
    required: true,
    aliases: [
      'asset id', 'asset_id', 'assetid', 'asset number', 'asset_number', 'assetnumber',
      'extinguisher number', 'extinguisher_number', 'extinguishernumber', 'ext number',
      'ext_number', 'ext num', 'ext_num', 'extnum', 'ext id', 'ext_id', 'extid',
      'unit id', 'unit_id', 'unitid', 'unit number', 'unit_number', 'unitnumber',
      'tag', 'tag number', 'tag_number', 'tagnumber', 'tag id', 'tag_id', 'tagid',
      'id', 'number', 'item number', 'item_number', 'item id', 'item_id',
      'fe number', 'fe_number', 'fenumber', 'fe id', 'fe_id', 'feid',
      'equipment id', 'equipment_id', 'equipmentid', 'equip id', 'equip_id',
    ],
  },
  {
    key: 'serial',
    label: 'Serial Number',
    required: false,
    aliases: [
      'serial', 'serial number', 'serial_number', 'serialnumber', 'serial no',
      'serial_no', 'serialno', 'sn', 's/n', 'ser', 'ser no', 'ser_no',
    ],
  },
  {
    key: 'parentLocation',
    label: 'Building / Location',
    required: false,
    aliases: [
      'building', 'location', 'parent location', 'parent_location', 'parentlocation',
      'facility', 'site', 'building name', 'building_name', 'campus',
      'property', 'address',
    ],
  },
  {
    key: 'locationId',
    label: 'Location ID',
    required: false,
    aliases: [
      'location id', 'location_id', 'locationid', 'loc id', 'loc_id', 'locid',
      'room', 'room number', 'room_number', 'roomnumber', 'room id', 'room_id',
    ],
  },
  {
    key: 'barcode',
    label: 'Barcode',
    required: false,
    aliases: [
      'barcode', 'bar code', 'bar_code', 'upc', 'ean', 'scan code', 'scan_code',
      'scancode', 'barcode number', 'barcode_number',
    ],
  },
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    required: false,
    aliases: [
      'manufacturer', 'mfg', 'mfr', 'make', 'brand', 'maker', 'vendor',
      'manufacturer name', 'manufacturer_name', 'mfg name', 'mfg_name',
    ],
  },
  {
    key: 'extinguisherType',
    label: 'Extinguisher Type',
    required: false,
    aliases: [
      'type', 'extinguisher type', 'extinguisher_type', 'extinguishertype',
      'ext type', 'ext_type', 'agent', 'agent type', 'agent_type',
      'fire type', 'fire_type', 'class', 'fire class', 'fire_class',
      'abc', 'dry chemical', 'co2', 'water', 'foam',
    ],
  },
  {
    key: 'serviceClass',
    label: 'Service Class',
    required: false,
    aliases: [
      'service class', 'service_class', 'serviceclass', 'rating',
      'fire rating', 'fire_rating', 'class rating', 'class_rating',
    ],
  },
  {
    key: 'extinguisherSize',
    label: 'Size',
    required: false,
    aliases: [
      'size', 'extinguisher size', 'extinguisher_size', 'extinguishersize',
      'weight', 'capacity', 'lbs', 'pounds', 'volume',
    ],
  },
  {
    key: 'category',
    label: 'Category',
    required: false,
    aliases: [
      'category', 'cat', 'status', 'asset status', 'asset_status',
      'condition', 'state',
    ],
  },
  {
    key: 'section',
    label: 'Section',
    required: false,
    aliases: [
      'section', 'zone', 'area', 'wing', 'floor', 'dept', 'department',
      'building section', 'building_section',
    ],
  },
  {
    key: 'vicinity',
    label: 'Vicinity',
    required: false,
    aliases: [
      'vicinity', 'nearby', 'near', 'description', 'placement', 'position',
      'spot', 'detail', 'notes', 'location detail', 'location_detail',
      'location description', 'location_description',
    ],
  },
  {
    key: 'manufactureYear',
    label: 'Manufacture Year',
    required: false,
    aliases: [
      'manufacture year', 'manufacture_year', 'manufactureyear', 'mfg year', 'mfg_year',
      'mfgyear', 'year made', 'year_made', 'year manufactured', 'year_manufactured',
      'dom', 'date of manufacture', 'date_of_manufacture', 'year', 'built',
    ],
  },
  {
    key: 'expirationYear',
    label: 'Expiration Year',
    required: false,
    aliases: [
      'expiration year', 'expiration_year', 'expirationyear', 'exp year', 'exp_year',
      'expyear', 'expires', 'expiration', 'exp', 'expiry', 'expiry year',
      'expiry_year', 'end of life', 'end_of_life', 'eol',
    ],
  },
];

/**
 * Normalize a string for fuzzy matching: lowercase, strip special chars.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Auto-suggest the best target field for a given source column name.
 */
function autoMatch(sourceColumn: string): string | null {
  const norm = normalize(sourceColumn);

  // Exact key match
  for (const field of TARGET_FIELDS) {
    if (norm === normalize(field.key)) return field.key;
  }

  // Alias match
  for (const field of TARGET_FIELDS) {
    for (const alias of field.aliases) {
      if (norm === normalize(alias)) return field.key;
    }
  }

  // Partial/contains match — source contains alias or alias contains source
  for (const field of TARGET_FIELDS) {
    for (const alias of field.aliases) {
      const normAlias = normalize(alias);
      if (norm.includes(normAlias) || normAlias.includes(norm)) {
        return field.key;
      }
    }
  }

  return null;
}

interface ColumnMapperModalProps {
  open: boolean;
  onClose: () => void;
  /** Column headers from the user's file */
  sourceColumns: string[];
  /** First few rows of data for preview */
  previewRows: Record<string, string>[];
  /** Called with the final mapping: { sourceColumn -> targetFieldKey } */
  onConfirm: (mapping: Record<string, string>) => void;
}

export function ColumnMapperModal({
  open,
  onClose,
  sourceColumns,
  previewRows,
  onConfirm,
}: ColumnMapperModalProps) {
  // Initialize mapping with auto-suggestions
  const initialMapping = useMemo(() => {
    const map: Record<string, string> = {};
    const usedTargets = new Set<string>();

    // First pass: find confident matches
    for (const col of sourceColumns) {
      const match = autoMatch(col);
      if (match && !usedTargets.has(match)) {
        map[col] = match;
        usedTargets.add(match);
      }
    }

    // Unmapped columns get empty string (skip)
    for (const col of sourceColumns) {
      if (!(col in map)) map[col] = '';
    }

    return map;
  }, [sourceColumns]);

  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [showPreview, setShowPreview] = useState(true);

  // Track which target fields are already used
  const usedTargets = useMemo(() => {
    const used = new Set<string>();
    for (const target of Object.values(mapping)) {
      if (target) used.add(target);
    }
    return used;
  }, [mapping]);

  // Check required fields
  const missingRequired = TARGET_FIELDS.filter(
    (f) => f.required && !usedTargets.has(f.key),
  );

  function handleMappingChange(sourceCol: string, targetKey: string) {
    setMapping((prev) => ({ ...prev, [sourceCol]: targetKey }));
  }

  function handleConfirm() {
    // Filter out empty mappings (skipped columns)
    const finalMapping: Record<string, string> = {};
    for (const [source, target] of Object.entries(mapping)) {
      if (target) finalMapping[source] = target;
    }
    onConfirm(finalMapping);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Map Your Columns</h2>
            <p className="mt-1 text-sm text-gray-500">
              Match each column from your file to the correct field. We auto-detected what we could.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Required fields warning */}
          {missingRequired.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                Required fields not mapped:{' '}
                <span className="font-medium">
                  {missingRequired.map((f) => f.label).join(', ')}
                </span>
              </p>
            </div>
          )}

          {/* Mapping table */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Your Column</span>
              <span />
              <span>Maps To</span>
            </div>

            {sourceColumns.map((col) => {
              const target = mapping[col] ?? '';
              const matched = !!target;

              return (
                <div
                  key={col}
                  className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    matched ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Source column name + sample value */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{col}</p>
                    {previewRows.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        e.g. {previewRows[0][col] || <span className="italic">empty</span>}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className={`h-4 w-4 ${matched ? 'text-green-500' : 'text-gray-300'}`} />

                  {/* Target field dropdown */}
                  <select
                    value={target}
                    onChange={(e) => handleMappingChange(col, e.target.value)}
                    className={`w-full rounded-md border px-2 py-1.5 text-sm ${
                      matched
                        ? 'border-green-300 bg-white text-gray-900'
                        : 'border-gray-300 bg-white text-gray-500'
                    } focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500`}
                  >
                    <option value="">-- Skip this column --</option>
                    {TARGET_FIELDS.map((field) => {
                      const isUsed = usedTargets.has(field.key) && target !== field.key;
                      return (
                        <option key={field.key} value={field.key} disabled={isUsed}>
                          {field.label}
                          {field.required ? ' *' : ''}
                          {isUsed ? ' (already mapped)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Data preview */}
          {previewRows.length > 0 && (
            <div className="mt-5">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? 'Hide' : 'Show'} Data Preview
              </button>

              {showPreview && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-500">#</th>
                        {sourceColumns.map((col) => {
                          const target = mapping[col];
                          const field = target ? TARGET_FIELDS.find((f) => f.key === target) : null;
                          return (
                            <th key={col} className="px-2 py-1.5 text-left">
                              <span className="text-gray-500">{col}</span>
                              {field && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-green-600">
                                  <Check className="h-3 w-3" />
                                  {field.label}
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                          {sourceColumns.map((col) => (
                            <td key={col} className="max-w-[150px] truncate px-2 py-1 text-gray-700">
                              {row[col] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500">
            {usedTargets.size} of {TARGET_FIELDS.length} fields mapped
            {' '}&middot;{' '}
            {sourceColumns.length} columns in your file
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={missingRequired.length > 0}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm &amp; Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

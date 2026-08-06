/**
 * Field Work document — view, manual edit, and printable checksheet.
 * Route: /dashboard/field-work/:documentId
 *
 * Author: built_by_Beck
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { EGRESS_STAIRWELL_DEFAULT_FIELDS } from '../lib/workDocumentTemplates.ts';
import {
  subscribeToWorkDocument,
  updateWorkDocumentCall,
} from '../services/workDocumentService.ts';
import type {
  WorkDocument,
  WorkDocumentField,
  WorkDocumentFieldType,
  WorkDocumentItem,
  WorkDocumentSchema,
  WorkDocumentSection,
  WorkDocumentStatus,
} from '../types/workDocument.ts';

const FIELD_TYPE_LABELS: Record<WorkDocumentFieldType, string> = {
  pass_fail: 'Pass / Fail',
  yes_no: 'Yes / No',
  text: 'Text',
  checkbox: 'Checkbox',
  number: 'Number',
};

const STATUS_OPTIONS: WorkDocumentStatus[] = ['draft', 'active', 'archived'];

function cloneSchema(schema: WorkDocumentSchema): WorkDocumentSchema {
  return JSON.parse(JSON.stringify(schema)) as WorkDocumentSchema;
}

function renderPrintFieldCell(type: WorkDocumentFieldType): string {
  if (type === 'pass_fail') return 'P / F / N/A';
  if (type === 'yes_no') return 'Y / N';
  if (type === 'checkbox') return '☐';
  if (type === 'number') return '____';
  return '________________';
}

export default function FieldWorkDocument() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const canManage = hasRole(['owner', 'admin', 'inspector']);
  const hasAi = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'aiAssistant',
    org?.plan,
  );

  const [document, setDocument] = useState<WorkDocument | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkDocumentStatus>('active');
  const [schema, setSchema] = useState<WorkDocumentSchema>({
    sections: [],
    printNotes: null,
    footerText: null,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (!orgId || !documentId) return;
    return subscribeToWorkDocument(orgId, documentId, (doc) => {
      setDocument(doc);
      if (!dirty && doc) {
        setTitle(doc.title);
        setDescription(doc.description ?? '');
        setStatus(doc.status);
        setSchema(cloneSchema(doc.schema));
      }
    });
  }, [orgId, documentId, dirty]);

  function markDirty() {
    setDirty(true);
  }

  function updateSection(
    sectionId: string,
    patch: Partial<WorkDocumentSection>,
  ) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    }));
    markDirty();
  }

  function updateItem(
    sectionId: string,
    itemId: string,
    patch: Partial<WorkDocumentItem>,
  ) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : section,
      ),
    }));
    markDirty();
  }

  function addSection() {
    setSchema((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: crypto.randomUUID(),
          title: `Section ${prev.sections.length + 1}`,
          description: null,
          items: [
            {
              id: crypto.randomUUID(),
              label: 'New item',
              fields: EGRESS_STAIRWELL_DEFAULT_FIELDS.map((f) => ({ ...f })),
            },
          ],
        },
      ],
    }));
    markDirty();
  }

  function removeSection(sectionId: string) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
    markDirty();
  }

  function addItem(sectionId: string) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: [
                ...section.items,
                {
                  id: crypto.randomUUID(),
                  label: 'New item',
                  fields: EGRESS_STAIRWELL_DEFAULT_FIELDS.map((f) => ({
                    ...f,
                  })),
                },
              ],
            }
          : section,
      ),
    }));
    markDirty();
  }

  function removeItem(sectionId: string, itemId: string) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter((item) => item.id !== itemId),
            }
          : section,
      ),
    }));
    markDirty();
  }

  function addField(sectionId: string, itemId: string) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      fields: [
                        ...item.fields,
                        {
                          key: `field_${item.fields.length + 1}`,
                          label: 'New field',
                          type: 'pass_fail' as const,
                        },
                      ],
                    }
                  : item,
              ),
            }
          : section,
      ),
    }));
    markDirty();
  }

  function updateField(
    sectionId: string,
    itemId: string,
    fieldIndex: number,
    patch: Partial<WorkDocumentField>,
  ) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      fields: item.fields.map((field, index) =>
                        index === fieldIndex ? { ...field, ...patch } : field,
                      ),
                    }
                  : item,
              ),
            }
          : section,
      ),
    }));
    markDirty();
  }

  function removeField(sectionId: string, itemId: string, fieldIndex: number) {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      fields: item.fields.filter(
                        (_, index) => index !== fieldIndex,
                      ),
                    }
                  : item,
              ),
            }
          : section,
      ),
    }));
    markDirty();
  }

  async function handleSave() {
    if (!orgId || !documentId || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      await updateWorkDocumentCall({
        orgId,
        documentId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        schema,
      });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  }

  if (!hasAi) {
    navigate('/dashboard/field-work');
    return null;
  }

  if (!document) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (printMode) {
    return (
      <div className="min-h-screen bg-white text-black">
        <style>{`
          @page { size: portrait; margin: 0.5in; }
          @media print {
            .no-print { display: none !important; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
          }
        `}</style>

        <div className="no-print sticky top-0 z-10 border-b border-gray-300 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setPrintMode(false)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to edit
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8">
          <header className="mb-6 border-b border-gray-300 pb-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && (
              <p className="mt-2 text-sm text-gray-700">{description}</p>
            )}
            {document.relatedLocationLabel && (
              <p className="mt-1 text-sm text-gray-600">
                Location: {document.relatedLocationLabel}
              </p>
            )}
          </header>

          {schema.printNotes && (
            <p className="mb-4 rounded border border-gray-300 bg-gray-50 p-3 text-sm">
              {schema.printNotes}
            </p>
          )}

          {schema.sections.map((section) => (
            <section key={section.id} className="mb-8">
              <h2 className="mb-1 text-lg font-semibold">{section.title}</h2>
              {section.description && (
                <p className="mb-3 text-sm text-gray-600">
                  {section.description}
                </p>
              )}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="py-2 pr-3 text-left">Item</th>
                    {section.items[0]?.fields.map((field) => (
                      <th key={field.key} className="px-2 py-2 text-center">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-2 pr-3 align-top font-medium">
                        {item.label}
                      </td>
                      {item.fields.map((field) => (
                        <td
                          key={field.key}
                          className="px-2 py-2 text-center align-top text-gray-700"
                        >
                          {renderPrintFieldCell(field.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {schema.footerText && (
            <footer className="mt-8 border-t border-gray-300 pt-4 text-sm">
              {schema.footerText}
            </footer>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <style>{`
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/dashboard/field-work"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All forms & walkthroughs
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPrintMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Preview print
          </button>
          {canManage && (
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="no-print mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="no-print mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            value={title}
            disabled={!canManage}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="Enter a form title, such as Monthly Mechanical Room Walkthrough"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            disabled={!canManage}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={status}
              disabled={!canManage}
              onChange={(e) => {
                setStatus(e.target.value as WorkDocumentStatus);
                markDirty();
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {document.relatedLocationLabel && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Related location
              </label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {document.relatedLocationLabel}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Print notes
          </label>
          <textarea
            value={schema.printNotes ?? ''}
            disabled={!canManage}
            onChange={(e) => {
              setSchema((prev) => ({ ...prev, printNotes: e.target.value }));
              markDirty();
            }}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Footer text
          </label>
          <input
            value={schema.footerText ?? ''}
            disabled={!canManage}
            onChange={(e) => {
              setSchema((prev) => ({ ...prev, footerText: e.target.value }));
              markDirty();
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="no-print space-y-6">
        {schema.sections.map((section) => (
          <div
            key={section.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2">
                <input
                  value={section.title}
                  disabled={!canManage}
                  onChange={(e) =>
                    updateSection(section.id, { title: e.target.value })
                  }
                  placeholder="Enter a section name, such as Equipment Condition or Exit Route Checks"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                />
                <input
                  value={section.description ?? ''}
                  disabled={!canManage}
                  placeholder="Section description (optional)"
                  onChange={(e) =>
                    updateSection(section.id, {
                      description: e.target.value || null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove section
                </button>
              )}
            </div>

            <div className="space-y-4">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={item.label}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateItem(section.id, item.id, {
                          label: e.target.value,
                        })
                      }
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => removeItem(section.id, item.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove item
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {item.fields.map((field, fieldIndex) => (
                      <div
                        key={`${field.key}-${fieldIndex}`}
                        className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"
                      >
                        <input
                          value={field.label}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateField(section.id, item.id, fieldIndex, {
                              label: e.target.value,
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                        <select
                          value={field.type}
                          disabled={!canManage}
                          onChange={(e) =>
                            updateField(section.id, item.id, fieldIndex, {
                              type: e.target.value as WorkDocumentFieldType,
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          {Object.entries(FIELD_TYPE_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              removeField(section.id, item.id, fieldIndex)
                            }
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => addField(section.id, item.id)}
                        className="text-sm text-red-700 hover:text-red-800"
                      >
                        + Add field
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => addItem(section.id)}
                className="mt-4 inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            )}
          </div>
        ))}

        {canManage && (
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:border-red-300 hover:text-red-700"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        )}
      </div>

      <p className="no-print mt-8 text-xs text-gray-500">
        Pass/fail columns print as P / F / N/A for field use. In-app walk
        completion and result storage will be added in a future update.
      </p>
    </div>
  );
}

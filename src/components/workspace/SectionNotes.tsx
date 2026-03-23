import { useState, useEffect, useCallback, useId } from 'react';
import { FileText, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { SectionNotesMap } from '../../services/workspaceService.ts';

interface SectionNotesProps {
  section: string;
  notes: string;
  saveForNextMonth: boolean;
  lastUpdated: string | null;
  allNotes: SectionNotesMap;
  onSave: (section: string, notes: string, saveForNextMonth: boolean) => void;
  disabled?: boolean;
}

export function SectionNotes({
  section,
  notes,
  saveForNextMonth,
  lastUpdated,
  allNotes,
  onSave,
  disabled = false,
}: SectionNotesProps) {
  const textareaId = useId();

  const [editNotes, setEditNotes] = useState(notes);
  const [editSaveForNextMonth, setEditSaveForNextMonth] = useState(saveForNextMonth);
  const [showOtherNotes, setShowOtherNotes] = useState(false);

  // Reset internal state when section changes
  useEffect(() => {
    setEditNotes(notes);
    setEditSaveForNextMonth(saveForNextMonth);
    setShowOtherNotes(false);
  }, [section, notes, saveForNextMonth]);

  const handleSave = useCallback(() => {
    onSave(section, editNotes, editSaveForNextMonth);
  }, [onSave, section, editNotes, editSaveForNextMonth]);

  // Count other sections that have notes (non-empty)
  const otherSectionsWithNotes = Object.entries(allNotes).filter(
    ([key, val]) => key !== section && val.notes.trim().length > 0,
  );

  const hasChanges = editNotes !== notes || editSaveForNextMonth !== saveForNextMonth;

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Section Notes</h3>
        </div>
        {(() => {
          // Count total sections with saved notes (using allNotes, not local edit state)
          const totalWithNotes = Object.values(allNotes).filter(v => v.notes.trim().length > 0).length;
          return totalWithNotes > 0 ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              {totalWithNotes} section{totalWithNotes === 1 ? '' : 's'} with notes
            </span>
          ) : null;
        })()}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Textarea */}
        <label htmlFor={textareaId} className="mb-1 block text-xs font-medium text-gray-600">
          Notes for {section}
        </label>
        <textarea
          id={textareaId}
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="Add notes for this section..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />

        {/* Save for next month toggle + Save button */}
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={editSaveForNextMonth}
              onChange={(e) => setEditSaveForNextMonth(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="select-none">
              Keep for next month
            </span>
          </label>

          {!disabled && (
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          )}
        </div>

        {/* Last updated */}
        {formattedLastUpdated && (
          <p className="mt-1 text-xs text-gray-400">
            Last updated: {formattedLastUpdated}
          </p>
        )}

        {/* Other sections with notes (collapsible) */}
        {otherSectionsWithNotes.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-2">
            <button
              onClick={() => setShowOtherNotes((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              {showOtherNotes ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Other sections with notes ({otherSectionsWithNotes.length})
            </button>

            {showOtherNotes && (
              <div className="mt-2 space-y-2">
                {otherSectionsWithNotes.map(([sectionName, note]) => (
                  <div
                    key={sectionName}
                    className="rounded-md bg-gray-50 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-gray-700">{sectionName}</p>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{note.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

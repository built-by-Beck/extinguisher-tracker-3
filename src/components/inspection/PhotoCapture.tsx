/**
 * PhotoCapture — controlled component for capturing/displaying inspection photos.
 * Parent manages photoFile + photoPreview state (needed for upload on save).
 * Cleans up object URLs on unmount and on change.
 *
 * Author: built_by_Beck
 */

import { useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoCaptureProps {
  photoFile: File | null;
  photoPreview: string;
  existingPhotoUrl?: string | null;
  onPhotoSelect: (file: File, preview: string) => void;
  onPhotoRemove: () => void;
  disabled: boolean;
  isCompleted: boolean;
  canInspect: boolean;
}

export function PhotoCapture({
  photoFile,
  photoPreview,
  existingPhotoUrl,
  onPhotoSelect,
  onPhotoRemove,
  disabled,
  isCompleted,
  canInspect,
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke old preview URL before creating new one
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    const preview = URL.createObjectURL(file);
    onPhotoSelect(file, preview);
  }

  function handleRemove() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onPhotoRemove();
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Photo</h2>

      {!isCompleted && canInspect && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            disabled={disabled}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {photoFile ? 'Change Photo' : 'Take / Upload Photo'}
          </button>

          {photoFile && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>
      )}

      {/* Photo preview (new photo) */}
      {photoPreview && (
        <div className="mt-3">
          <img
            src={photoPreview}
            alt="Inspection photo preview"
            className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
          />
        </div>
      )}

      {/* Existing photo (completed inspection) */}
      {!photoPreview && existingPhotoUrl && (
        <div className="mt-1">
          <img
            src={existingPhotoUrl}
            alt="Inspection photo"
            className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
          />
        </div>
      )}

      {!photoPreview && !existingPhotoUrl && isCompleted && (
        <p className="text-sm text-gray-400">No photo attached.</p>
      )}
    </div>
  );
}

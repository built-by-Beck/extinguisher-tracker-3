import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase.ts';

const NOTE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const NOTE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function uploadNotePhoto(
  orgId: string,
  noteId: string,
  file: Blob,
): Promise<{ photoUrl: string; photoPath: string }> {
  if (!NOTE_PHOTO_TYPES.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > NOTE_PHOTO_MAX_BYTES) {
    throw new Error('Photo must be 10 MB or smaller.');
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `org/${orgId}/notes/${noteId}/photo_${Date.now()}.${extension}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const photoUrl = await getDownloadURL(fileRef);
  return { photoUrl, photoPath: path };
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(new Error('Could not read photo file.'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

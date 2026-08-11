/**
 * saveBlobAsFile(blob, filename)
 * Save a Blob as a file on client by creating an object URL and clicking an anchor.
 */
export function saveBlobAsFile(blob, filename = 'download') {
  if (!blob) return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Hide element to avoid breaking layout
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * downloadAndSave(apiDownloadFn, id, fallbackName)
 * A convenience wrapper: call an async download function that returns { blob, filename }
 * and save the blob using saveBlobAsFile.
 */
export async function downloadAndSave(downloadFn, id, fallbackName) {
  if (!downloadFn) throw new Error('download function required');
  if (!id) throw new Error('file id required');
  const result = await downloadFn(id);
  let blob;
  let filename;
  // Support two return shapes: Blob or { blob, filename }
  if (result instanceof Blob) {
    blob = result;
    filename = fallbackName;
  } else if (result && (result.blob || result instanceof Object)) {
    // If it's an object and has a blob property, use that; otherwise, try to
    // treat the entire result as a blob-like object (e.g. axios returns Blob directly)
    if (result.blob) blob = result.blob;
    else if (result.data && result.data instanceof Blob)
      blob = result.data; // some libs wrap under data
    else if (result instanceof Blob) blob = result; // fallback again
    filename = result.filename || fallbackName;
  } else {
    throw new Error('download function returned an unsupported value');
  }
  const name = filename || fallbackName || `file-${Date.now()}`;
  saveBlobAsFile(blob, name);
}

export default { saveBlobAsFile, downloadAndSave };

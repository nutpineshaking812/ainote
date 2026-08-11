import api from './index';

// Fetch file metadata (uses axios api wrapper)
export const getFileMeta = async (id) => {
  if (!id) throw new Error('File id required');
  return api.get(`/files/${id}/get-info`);
};

// Download file as blob. Return value: Blob (caller may supply its own filename).
// This mirrors the export functions in `api/data.js` (which return a raw blob)
export const downloadFile = async (id) => {
  if (!id) throw new Error('File id required');
  // Use axios with responseType blob so the central axios instance attaches auth header
  // and we get a Blob object back (consistent with exportFormTemplateExcel)
  const blob = await api.get(`/files/${id}/download`, { responseType: 'blob' });
  return blob;
};

export default { getFileMeta, downloadFile };

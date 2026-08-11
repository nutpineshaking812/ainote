// Utility functions for image handling (compression & dataURL conversions)
// Centralized so Renderer stays lean and functions can be reused elsewhere.

/**
 * Read a File object as a data URL
 * @param {File|Blob} file
 * @returns {Promise<string>} dataURL
 */
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });

/**
 * Convert a dataURL string back to a File (or Blob) object.
 * @param {string} dataUrl
 * @param {string} filename
 * @param {string} [forcedType] Optional override for mime type (e.g. 'image/jpeg')
 * @returns {File}
 */
export const dataUrlToFile = (dataUrl, filename, forcedType) => {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = forcedType || (mimeMatch ? mimeMatch[1] : 'image/jpeg');
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

/**
 * Compress an image file using canvas and return a dataURL.
 * @param {File} file Original image file
 * @param {number} quality JPEG quality 0-1
 * @returns {Promise<string>} dataURL of compressed image
 */
export const compressImageToDataUrl = (file, quality = 0.7) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建画布上下文'));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }
              const blobReader = new FileReader();
              blobReader.onload = () => resolve(blobReader.result);
              blobReader.onerror = () => reject(new Error('读取压缩后的图片失败'));
              blobReader.readAsDataURL(blob);
            },
            'image/jpeg',
            quality,
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });

/**
 * Compress an image and return a new File instance (jpeg) for upload.
 * @param {File} file
 * @param {number} quality
 * @returns {Promise<File>} compressed File
 */
export const compressImageToFile = async (file, quality = 0.7) => {
  const dataUrl = await compressImageToDataUrl(file, quality);
  const targetName = file.name.replace(/\.[^.]+$/, '.jpg');
  return dataUrlToFile(dataUrl, targetName, 'image/jpeg');
};

export default {
  fileToDataUrl,
  dataUrlToFile,
  compressImageToDataUrl,
  compressImageToFile,
};

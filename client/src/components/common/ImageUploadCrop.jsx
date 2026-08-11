import React, { useState } from 'react';
import { Upload, message } from 'antd';
import ImgCrop from 'antd-img-crop';
import { uploadImage } from '../../api/upload';

/**
 * ImageUploadCrop - A reusable component for cropping and uploading images.
 *
 * @param {string} value - Current image URL
 * @param {function} onChange - Callback when upload is successful (returns the new URL)
 * @param {number} aspect - Aspect ratio (default: 1/1)
 * @param {string} shape - Crop shape ('rect' or 'round', default: 'round')
 * @param {ReactNode} children - The trigger element (e.g., Avatar or Button)
 * @param {function} onStatusChange - Callback when uploading status changes (returns boolean)
 * @param {object} uploadProps - Additional props for the AntD Upload component
 */
const ImageUploadCrop = ({
  value,
  onChange,
  aspect = 1,
  shape = 'round',
  children,
  onStatusChange,
  uploadProps = {},
  maxWidth = 100, // Default max width
  maxHeight = 100, // Default max height
  usageType,
  usageId,
}) => {
  const [loading, setLoading] = useState(false);

  const setUploading = (status) => {
    setLoading(status);
    if (onStatusChange) {
      onStatusChange(status);
    }
  };

  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            },
            file.type,
            0.9, // Higher quality for the final resize
          );
        };
      };
    });
  };

  const handleCustomRequest = async (options) => {
    const { file, onSuccess, onError, onProgress } = options;

    try {
      setUploading(true);

      // 1. Resize the cropped image before uploading
      const processedFile = await resizeImage(file);

      // 2. Call our centralized upload API
      const result = await uploadImage(processedFile, {
        onProgress: (percent) => {
          onProgress({ percent });
        },
        usageType,
        usageId,
      });

      if (onChange) {
        onChange(result.url, result);
      }

      onSuccess(result);
    } catch (err) {
      console.error('[ImageUploadCrop] Upload failed:', err);
      message.error('图片上传失败，请稍后重试');
      onError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ImgCrop
      rotationSlider
      aspect={aspect}
      cropShape={shape}
      showGrid
      quality={0.8}
      modalTitle="编辑图片"
      modalOk="确定"
      modalCancel="取消"
    >
      <Upload
        accept="image/*"
        showUploadList={false}
        customRequest={handleCustomRequest}
        disabled={loading}
        {...uploadProps}
      >
        {children}
      </Upload>
    </ImgCrop>
  );
};

export default ImageUploadCrop;

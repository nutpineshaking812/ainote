import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Spin, message, Empty, Button, Space, Pagination, InputNumber, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DownloadOutlined,
  FullscreenOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import { getFileMeta, downloadFile } from '../../../api/files';
import { downloadAndSave } from '../../../utils/fileDownload';
import ResourcePanelHeader from '../../../pages/app-detail/components/ResourcePanelHeader';
import useAppStore from '../../../store/useAppStore';
import { useResourceTree } from '../../resource-tree/context/ResourceTreeContext';

// Configure PDF.js worker locally for better reliability in local development
// Using local worker prevents LCP delays caused by slow CDN connections (detected by subagent)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Note: If LCP is still high, it might be due to network contention with the resource cache sync.
// For production, ensure the worker is preloaded or served from a fast local CDN.

// Import styles for react-pdf (if any, but we can do custom)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/**
 * PdfResourcePanel - A premium PDF viewer powered by pdf.js
 */
const PdfResourcePanel = ({ appId, resource }) => {
  const { t } = useTranslation();
  const isSidebarCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const { getBreadcrumbById } = useResourceTree();

  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);

  // PDF state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const containerRef = useRef(null);

  // Memoize breadcrumbs to prevent recalculation on every render (efficiency)
  const breadcrumbItems = useMemo(() => {
    return resource?.id ? getBreadcrumbById(resource.id) : [];
  }, [resource?.id, getBreadcrumbById]);

  useEffect(() => {
    const fetchFile = async () => {
      if (!resource?.refId) return;
      try {
        setLoading(true);
        const data = await getFileMeta(resource.refId);
        if (data?.downloadUrl) {
          setFileUrl(data.downloadUrl);
          setFileMeta(data.file);
        } else {
          message.error('无法获取文件下载地址');
        }
      } catch (err) {
        console.error('Failed to fetch PDF meta:', err);
        message.error('加载文件失败');
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [resource?.refId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF Load Error:', error);
    message.error('PDF 加载失败: ' + error.message);
    setLoading(false);
  };

  const handleDownload = useCallback(async () => {
    if (!resource?.refId) return;
    try {
      await downloadAndSave(downloadFile, resource.refId, fileMeta?.name || 'document.pdf');
    } catch (err) {
      message.error('下载失败');
    }
  }, [resource?.refId, fileMeta?.name]);

  const zoomIn = useCallback(() => setScale((prev) => Math.min(prev + 0.2, 3.0)), []);
  const zoomOut = useCallback(() => setScale((prev) => Math.max(prev - 0.2, 0.5)), []);

  if (!resource?.refId) return <Empty description="未选择文件" />;

  // Memoize toolbar actions to avoid re-creating them on every render
  const extraActions = useMemo(
    () => (
      <Space size="middle">
        {/* Page Navigation */}
        {numPages && (
          <Space style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((prev) => prev - 1)}
            />
            <span style={{ fontSize: 13 }}>
              第 {pageNumber} / {numPages} 页
            </span>
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((prev) => prev + 1)}
            />
          </Space>
        )}

        <Divider type="vertical" />

        {/* Zoom Controls */}
        <Space>
          <Button icon={<ZoomOutOutlined />} onClick={zoomOut} size="small" />
          <span style={{ minWidth: 45, textAlign: 'center', fontSize: 13 }}>
            {Math.round(scale * 100)}%
          </span>
          <Button icon={<ZoomInOutlined />} onClick={zoomIn} size="small" />
        </Space>

        <Divider type="vertical" />

        <Button icon={<DownloadOutlined />} onClick={handleDownload} size="small">
          下载
        </Button>
        <Button
          icon={<FullscreenOutlined />}
          onClick={() => window.open(fileUrl, '_blank')}
          size="small"
        >
          全屏
        </Button>
      </Space>
    ),
    [numPages, pageNumber, scale, fileUrl, handleDownload, zoomIn, zoomOut],
  );

  if (!resource?.refId) return <Empty description="未选择文件" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ResourcePanelHeader
        breadcrumbItems={breadcrumbItems}
        siderCollapsed={isSidebarCollapsed}
        setSiderCollapsed={setSidebarCollapsed}
        extraActions={extraActions}
      />

      {/* PDF Viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          background: '#f0f2f5',
        }}
      >
        {fileUrl ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div style={{ marginTop: '20px' }}>
                <Skeleton active />
              </div>
            }
          >
            <div style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: '#fff' }}>
              <Page
                pageNumber={pageNumber}
                scale={scale}
                loading={<Skeleton active />}
              />
            </div>
          </Document>
        ) : loading ? (
          <div style={{ marginTop: '20px' }}>
            <Skeleton active />
          </div>
        ) : (
          <Empty description="文件地址无效" />
        )}
      </div>
    </div>
  );
};

const Skeleton = ({ active }) => (
  <div
    style={{
      width: '600px',
      height: '800px',
      padding: '40px',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    }}
  >
    <div
      style={{
        height: '30px',
        width: '60%',
        background: '#f0f0f0',
        borderRadius: '4px',
        animation: active ? 'pulse 1.5s infinite ease-in-out' : 'none',
      }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          style={{
            height: '12px',
            width: `${90 + Math.random() * 10}%`,
            background: '#f5f5f5',
            borderRadius: '2px',
            animation: active ? 'pulse 1.5s infinite ease-in-out' : 'none',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
    <style>{`
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `}</style>
  </div>
);

export default PdfResourcePanel;

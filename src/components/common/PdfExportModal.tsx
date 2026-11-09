import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button, PrimaryButton } from './Buttons';
import { FormField } from './FormField';
import { showToast } from './Toast';
import { storageService } from '@/services/storageService';
import { apiClient } from '@/services/apiClient';

export interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType: 'project_report' | 'concept_report' | 'tutor_notes' | 'jury_prep' | 'portfolio';
  targetId: string;
  defaultTitle: string;
  defaultSubtitle?: string;
  availableSections?: { id: string; label: string; defaultChecked?: boolean }[];
  hasImages?: boolean;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  exportType,
  targetId,
  defaultTitle,
  defaultSubtitle = '',
  availableSections = [],
  hasImages = false,
}) => {
  const session = storageService.getAuthSession();

  // Customization Form State
  const [docTitle, setDocTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [authorName, setAuthorName] = useState(session?.name || 'Studio Architect');
  const [institutionName, setInstitutionName] = useState('Faculty of Architecture');
  const [docDate, setDocDate] = useState(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
  const [pageSize, setPageSize] = useState<'A4' | 'A3'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeImages, setIncludeImages] = useState(true);

  // Sections toggle map
  const [sectionToggles, setSectionToggles] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {};
    availableSections.forEach((s) => {
      initial[s.id] = s.defaultChecked !== false;
    });
    return initial;
  });

  // Generation & Preview State
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfData, setPdfData] = useState<{
    base64: string;
    filename: string;
    sizeBytes: number;
  } | null>(null);

  // Reset title when prop changes
  useEffect(() => {
    setDocTitle(defaultTitle);
    setSubtitle(defaultSubtitle);
    setPdfData(null);
  }, [defaultTitle, defaultSubtitle, targetId]);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const res = await apiClient.exportPdf({
        exportType,
        targetId,
        options: {
          title: docTitle,
          subtitle,
          authorName,
          institutionName,
          date: docDate,
          pageSize,
          orientation,
          sections: sectionToggles,
          includeImages: hasImages ? includeImages : false,
        },
      });

      setPdfData({
        base64: res.pdfBase64,
        filename: res.filename,
        sizeBytes: res.sizeBytes,
      });

      showToast({
        type: 'success',
        title: 'PDF Dossier Generated',
        message: `Architectural ${pageSize} document rendered successfully.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'PDF Generation Failed',
        message: err.message || 'Could not compile document.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfData) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfData.base64}`;
    link.download = pdfData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Architectural PDF Dossier"
      subtitle="Compile studio projects, generative concepts, and viva defense notes into publication-grade documents."
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Configuration Fields */}
        {!pdfData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Document Title" required>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
                />
              </FormField>

              <FormField label="Document Subtitle">
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Final Academic Semester Review"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-parchment/30 border border-archBorder text-sm text-ink outline-none focus:border-espresso focus:ring-1 focus:ring-espresso"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <FormField label="Author / Architect">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-parchment/30 border border-archBorder text-xs text-ink outline-none focus:border-espresso"
                />
              </FormField>

              <FormField label="Institution / Faculty">
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-parchment/30 border border-archBorder text-xs text-ink outline-none focus:border-espresso"
                />
              </FormField>

              <FormField label="Document Date">
                <input
                  type="text"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-parchment/30 border border-archBorder text-xs text-ink outline-none focus:border-espresso"
                />
              </FormField>
            </div>

            {/* Page Geometry Controls */}
            <div className="p-4 rounded-2xl bg-cream border border-archBorder/60 space-y-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-espresso">
                Page Format & Geometry
              </span>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] text-taupe mb-1.5">Standard Sheet Size</label>
                  <div className="flex items-center gap-2">
                    {(['A4', 'A3'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPageSize(sz)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          pageSize === sz
                            ? 'bg-espresso text-cream border-espresso shadow-arch-sm'
                            : 'bg-parchment/40 border-archBorder text-ink-muted hover:bg-beige/40'
                        }`}
                      >
                        {sz} ({sz === 'A4' ? 'Academic Portfolio' : 'Competition Board'})
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-taupe mb-1.5">Orientation</label>
                  <div className="flex items-center gap-2">
                    {(['portrait', 'landscape'] as const).map((ori) => (
                      <button
                        key={ori}
                        type="button"
                        onClick={() => setOrientation(ori)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                          orientation === ori
                            ? 'bg-espresso text-cream border-espresso shadow-arch-sm'
                            : 'bg-parchment/40 border-archBorder text-ink-muted hover:bg-beige/40'
                        }`}
                      >
                        {ori}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Sections & Drawing Attachment Toggles */}
            {(availableSections.length > 0 || hasImages) && (
              <div className="p-4 rounded-2xl bg-cream border border-archBorder/60 space-y-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-espresso">
                  Include Content Sections
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {availableSections.map((sec) => (
                    <label key={sec.id} className="flex items-center gap-2 cursor-pointer text-ink">
                      <input
                        type="checkbox"
                        checked={sectionToggles[sec.id] !== false}
                        onChange={(e) =>
                          setSectionToggles((prev) => ({ ...prev, [sec.id]: e.target.checked }))
                        }
                        className="rounded border-archBorder text-espresso focus:ring-espresso"
                      />
                      <span>{sec.label}</span>
                    </label>
                  ))}

                  {hasImages && (
                    <label className="flex items-center gap-2 cursor-pointer text-ink">
                      <input
                        type="checkbox"
                        checked={includeImages}
                        onChange={(e) => setIncludeImages(e.target.checked)}
                        className="rounded border-archBorder text-espresso focus:ring-espresso"
                      />
                      <span className="font-medium text-espresso">
                        Attach Uploaded Project Drawings & Images
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-archBorder/40">
              <Button variant="secondary" onClick={onClose} disabled={isGenerating}>
                Cancel
              </Button>
              <PrimaryButton
                onClick={handleGeneratePdf}
                disabled={isGenerating || !docTitle.trim()}
                icon={<FileText className="w-4 h-4" />}
              >
                {isGenerating ? 'Compiling Architectural PDF...' : 'Generate Document Preview'}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          /* Step 2: Instant Inline Preview & Download Toolbar */
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-cream border border-archBorder/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  {pageSize} {orientation} Ready
                </span>
                <span className="font-mono text-taupe">{formatFileSize(pdfData.sizeBytes)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPdfData(null)}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Adjust Options
                </Button>

                <PrimaryButton
                  size="sm"
                  onClick={handleDownload}
                  icon={<Download className="w-4 h-4" />}
                >
                  Download {pdfData.filename}
                </PrimaryButton>
              </div>
            </div>

            {/* Inline PDF Preview Frame */}
            <div className="rounded-2xl border border-archBorder bg-parchment/40 overflow-hidden shadow-arch-md h-[500px]">
              <iframe
                src={`data:application/pdf;base64,${pdfData.base64}`}
                title="Architectural Document Preview"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

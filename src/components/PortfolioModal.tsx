'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { uploadPortfolioFileToR2 } from '@/lib/upload-client';
import { compressImage, compressThumbnailToDataUrl } from '@/lib/image-compress';
import { VIDEO_PLACEHOLDER_THUMBNAIL } from '@/lib/portfolio-media';
import {
  MAX_IMAGE_BYTES,
  IMAGE_TYPES,
  IMAGE_TOO_LARGE_MSG,
  VIDEO_USE_LINK_MSG,
  UPLOAD_HINT,
} from '@/lib/upload-limits';

export interface PortfolioItem {
  id: string;
  type: 'instagram' | 'tiktok' | 'youtube' | 'upload';
  url: string;
  thumbnail: string;
  originalUrl?: string; // For social media links
  description?: string; // Short description of the project
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'other'; // Target platform for uploaded content
}

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: PortfolioItem) => void;
  creatorId?: string; // For uploading to Supabase Storage
}

// Helper to extract video ID and create thumbnail from URLs
function parseMediaUrl(rawUrl: string): { type: PortfolioItem['type']; thumbnail: string; originalUrl: string } | null {
  try {
    const url = rawUrl.trim();
    const urlLower = url.toLowerCase();
    
    // YouTube
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      let videoId = '';
      if (urlLower.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
      } else if (urlLower.includes('v=')) {
        videoId = url.split('v=')[1]?.split('&')[0] || '';
      } else if (urlLower.includes('/shorts/')) {
        videoId = url.split('/shorts/')[1]?.split('?')[0] || '';
      }
      if (videoId) {
        return {
          type: 'youtube',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          originalUrl: url
        };
      }
    }
    
    // Instagram
    if (urlLower.includes('instagram.com')) {
      // Instagram doesn't allow direct thumbnail access, use our own placeholder
      return {
        type: 'instagram',
        thumbnail: VIDEO_PLACEHOLDER_THUMBNAIL,
        originalUrl: url
      };
    }

    // TikTok
    if (urlLower.includes('tiktok.com')) {
      // TikTok also doesn't allow direct thumbnail access
      return {
        type: 'tiktok',
        thumbnail: VIDEO_PLACEHOLDER_THUMBNAIL,
        originalUrl: url
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

export default function PortfolioModal({ isOpen, onClose, onAdd, creatorId }: PortfolioModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [urlPreview, setUrlPreview] = useState<{ type: string; thumbnail: string } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [urlDescription, setUrlDescription] = useState(''); // Description for URL links
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'other'>('instagram');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [isCompressingThumbnail, setIsCompressingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError('');
    setUrlPreview(null);

    if (value.trim()) {
      const parsed = parseMediaUrl(value);
      if (parsed) {
        setUrlPreview({ type: parsed.type, thumbnail: parsed.thumbnail });
      }
    }
  };

  const handleCustomThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUrlError('Sličica mora biti slika (JPG, PNG, WebP...)');
      return;
    }
    setIsCompressingThumbnail(true);
    setUrlError('');
    try {
      const dataUrl = await compressThumbnailToDataUrl(file);
      setCustomThumbnail(dataUrl);
    } catch {
      setUrlError('Greška pri obradi sličice');
    } finally {
      setIsCompressingThumbnail(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!url.trim()) {
      setUrlError('Unesite URL');
      return;
    }

    const parsed = parseMediaUrl(url);
    if (!parsed) {
      setUrlError('Nepodržan URL format. Koristite YouTube, Instagram ili TikTok linkove.');
      return;
    }

    const newItem: PortfolioItem = {
      id: `url-${Date.now()}`,
      type: parsed.type,
      url: parsed.originalUrl, // pravi link (za playback na profilu); thumbnail je preview
      thumbnail: customThumbnail || parsed.thumbnail,
      originalUrl: parsed.originalUrl,
      description: urlDescription.trim() || undefined,
      platform: parsed.type as 'instagram' | 'tiktok' | 'youtube', // Platform is same as type for URLs
    };

    onAdd(newItem);
    resetAndClose();
  };

  const processFile = (file: File) => {
    // Video se dodaje preko linka, ne kao fajl
    if (file.type.startsWith('video/')) {
      setUrlError(VIDEO_USE_LINK_MSG);
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setUrlError('Nepodržan format. Koristite JPG, PNG, GIF ili WebP.');
      return;
    }

    // Limit slike dolazi iz src/lib/upload-limits.ts (jedno mesto za izmenu)
    if (file.size > MAX_IMAGE_BYTES) {
      setUrlError(IMAGE_TOO_LARGE_MSG);
      return;
    }

    setUploadedFile(file);
    setUrlError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadedFile || !uploadPreview) {
      setUrlError('Izaberite fajl');
      return;
    }

    // If creatorId is provided, upload DIRECTLY to Storage (zaobilazi Vercel 4.5MB limit)
    if (creatorId) {
      setIsUploading(true);
      setUrlError('');
      
      try {
        const compressed = await compressImage(uploadedFile);
        const result = await uploadPortfolioFileToR2(compressed, creatorId);

        const newItem: PortfolioItem = {
          id: `upload-${Date.now()}`,
          type: 'upload',
          url: result.url,
          thumbnail: result.isVideo ? VIDEO_PLACEHOLDER_THUMBNAIL : result.url,
          description: description.trim() || undefined,
          platform: selectedPlatform,
        };
        
        onAdd(newItem);
        resetAndClose();
      } catch (error: any) {
        console.error('Upload error:', error);
        setUrlError(error.message || 'Greška prilikom uploada');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Fallback for local preview (legacy behavior)
      const newItem: PortfolioItem = {
        id: `upload-${Date.now()}`,
        type: 'upload',
        url: uploadPreview,
        thumbnail: uploadPreview,
        description: description.trim() || undefined,
        platform: selectedPlatform,
      };

      onAdd(newItem);
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setUrl('');
    setUrlError('');
    setUrlPreview(null);
    setUploadedFile(null);
    setUploadPreview(null);
    setDescription('');
    setUrlDescription('');
    setSelectedPlatform('instagram');
    setActiveTab('url');
    setIsDragging(false);
    setIsUploading(false);
    setCustomThumbnail(null);
    setIsCompressingThumbnail(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-medium">Dodaj u portfolio</h2>
          <button
            onClick={resetAndClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => {
              setActiveTab('url');
              setIsDragging(false);
            }}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted hover:text-foreground'
            }`}
          >
            🔗 Link (URL)
          </button>
          <button
            onClick={() => {
              setActiveTab('upload');
              setIsDragging(false);
            }}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted hover:text-foreground'
            }`}
          >
            📤 Dodaj sliku
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'url' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Link do video/slike
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... ili instagram.com/reel/..."
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted mt-2">
                  Podržani: YouTube, Instagram Reels, TikTok
                </p>
              </div>

              {/* URL Preview */}
              {urlPreview && (
                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm text-muted mb-2">Pregled:</p>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 relative rounded-lg overflow-hidden bg-secondary">
                      {customThumbnail || urlPreview.thumbnail.startsWith('http') || urlPreview.thumbnail.startsWith('data:image') ? (
                        <Image
                          src={customThumbnail || urlPreview.thumbnail}
                          alt="Preview"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted bg-secondary">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                        {urlPreview.type === 'instagram' ? 'Instagram' : urlPreview.type === 'tiktok' ? 'TikTok' : 'YouTube'}
                      </span>
                      <p className="text-xs text-muted mt-1 truncate max-w-[200px]">
                        {url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sopstvena sličica - opciono, samo za IG/TikTok gde nemamo pravi thumbnail */}
              {urlPreview && (urlPreview.type === 'instagram' || urlPreview.type === 'tiktok') && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Sopstvena sličica <span className="text-muted font-normal">(opciono)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {customThumbnail && (
                      <div className="w-14 h-14 relative rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                        <Image src={customThumbnail} alt="Sličica" fill className="object-cover" unoptimized />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={isCompressingThumbnail}
                      className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      {isCompressingThumbnail ? 'Obrađujem...' : customThumbnail ? 'Promeni sličicu' : 'Otpremi sličicu'}
                    </button>
                    {customThumbnail && (
                      <button
                        type="button"
                        onClick={() => setCustomThumbnail(null)}
                        className="text-sm text-error hover:underline"
                      >
                        Ukloni
                      </button>
                    )}
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomThumbnailSelect}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Bez ovoga koristi se generički prikaz - {urlPreview.type === 'instagram' ? 'Instagram' : 'TikTok'} ne dozvoljava automatsko preuzimanje pravog thumbnail-a.
                  </p>
                </div>
              )}

              {/* Description for URL - shows when URL is valid */}
              {urlPreview && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Kratak opis projekta <span className="text-muted font-normal">(opciono)</span>
                  </label>
                  <textarea
                    value={urlDescription}
                    onChange={(e) => setUrlDescription(e.target.value)}
                    placeholder="Npr. Kampanja za beauty brend, prikazuje proizvod u upotrebi..."
                    maxLength={150}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
                  />
                  <p className="text-xs text-muted mt-1 text-right">
                    {urlDescription.length}/150
                  </p>
                </div>
              )}

              {urlError && (
                <p className="text-sm text-red-500">{urlError}</p>
              )}

              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim()}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Dodaj link
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted'
                }`}
              >
                {uploadPreview ? (
                  <div className="space-y-4">
                    <div className="w-32 h-32 mx-auto relative rounded-xl overflow-hidden">
                      {uploadedFile?.type.startsWith('video/') ? (
                        <video
                          src={uploadPreview}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <Image
                          src={uploadPreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <p className="text-sm text-muted">{uploadedFile?.name}</p>
                    <p className="text-xs text-muted">
                      Kliknite za promenu fajla
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-4">📁</div>
                    <p className="font-medium mb-2">
                      {isDragging ? 'Spustite fajl ovde' : 'Kliknite ili prevucite fajl'}
                    </p>
                    <p className="text-sm text-muted">
                      Slike (JPG, PNG, GIF, WebP)
                    </p>
                    <p className="text-xs text-muted mt-2">
                      {UPLOAD_HINT}
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Description and Platform fields - only show when file is selected */}
              {uploadedFile && (
                <div className="space-y-4 border-t border-border pt-4">
                  {/* Platform Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Za koju platformu je ovaj sadržaj?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'instagram', label: 'Instagram' },
                        { value: 'tiktok', label: 'TikTok' },
                        { value: 'youtube', label: 'YouTube' },
                        { value: 'other', label: 'Ostalo' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSelectedPlatform(option.value as typeof selectedPlatform)}
                          className={`px-3 py-2.5 rounded-lg border transition-colors text-sm font-medium ${
                            selectedPlatform === option.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border hover:border-muted'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Kratak opis projekta <span className="text-muted font-normal">(opciono)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Npr. UGC video za beauty brend, prikazuje proizvod u upotrebi..."
                      maxLength={150}
                      rows={2}
                      className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
                    />
                    <p className="text-xs text-muted mt-1 text-right">
                      {description.length}/150
                    </p>
                  </div>
                </div>
              )}

              {urlError && (
                <p className="text-sm text-red-500">{urlError}</p>
              )}

              <button
                onClick={handleUploadSubmit}
                disabled={!uploadedFile || isUploading}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploadujem...
                  </>
                ) : (
                  'Dodaj fajl'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


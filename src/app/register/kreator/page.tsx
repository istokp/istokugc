'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { platforms, languages } from '@/lib/mockData';
import Image from 'next/image';
import ImageCropper from '@/components/ImageCropper';
import { createClient } from '@/lib/supabase/client';
import { uploadPortfolioFileToR2, safeJson } from '@/lib/upload-client';
import { compressImage } from '@/lib/image-compress';
import CityAutocomplete, { City, cityLabel } from '@/components/CityAutocomplete';
import {
  MAX_IMAGE_BYTES,
  IMAGE_TOO_LARGE_MSG,
  VIDEO_USE_LINK_MSG,
  UPLOAD_HINT,
} from '@/lib/upload-limits';

interface PortfolioItem {
  id: string;
  type: 'youtube' | 'tiktok' | 'instagram' | 'upload';
  url: string;
  thumbnail: string;
  description?: string;
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'other';
  // Raw fajl za 'upload' stavke - uploaduje se direktno u Storage POSLE
  // kreiranja naloga (ne salje se kao base64 u registracioni body).
  file?: File;
}

export default function RegisterCreatorPage() {
  const router = useRouter();
  
  // API state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    bio: '',
    location: '',
    priceFrom: '',
    categories: [] as string[],
    platforms: [] as string[],
    languages: [] as string[],
    instagram: '',
    tiktok: '',
    youtube: '',
    phone: '',
    photo: null as File | null,
  });
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  
  // Portfolio state
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const [showAddPortfolio, setShowAddPortfolio] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Categories from database
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  
  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    
    fetchCategories();
  }, []);

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handlePlatformToggle = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const handleLanguageToggle = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Molimo izaberite sliku');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Slika je prevelika. Maksimalna veličina je 10MB.');
      return;
    }

    // Store original and open cropper
    const imageUrl = URL.createObjectURL(file);
    setOriginalPhoto(imageUrl);
    setShowCropper(true);
    
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setPhotoPreview(croppedImage);
    setShowCropper(false);
    // Clean up original URL
    if (originalPhoto) {
      URL.revokeObjectURL(originalPhoto);
      setOriginalPhoto(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    // Clean up original URL
    if (originalPhoto) {
      URL.revokeObjectURL(originalPhoto);
      setOriginalPhoto(null);
    }
  };

  // Handle portfolio file upload
  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Video se dodaje preko linka, ne kao fajl
    if (file.type.startsWith('video/')) {
      setPortfolioError(VIDEO_USE_LINK_MSG);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPortfolioError('Molimo izaberite sliku.');
      return;
    }

    // Limit slike dolazi iz src/lib/upload-limits.ts (jedno mesto za izmenu)
    if (file.size > MAX_IMAGE_BYTES) {
      setPortfolioError(IMAGE_TOO_LARGE_MSG);
      return;
    }

    // Kompresuj sliku pre uploada (manji storage trošak, brže učitavanje)
    const compressed = await compressImage(file);
    const dataUrl: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(compressed);
    });

    const newItem: PortfolioItem = {
      id: `upload-${Date.now()}`,
      type: 'upload',
      url: dataUrl,
      thumbnail: dataUrl,
      description: portfolioDescription,
      platform: 'other',
      file: compressed, // kompresovan fajl za direktan upload u Storage
    };
    setPortfolioItems((prev) => [...prev, newItem]);
    setPortfolioDescription('');
    setPortfolioError('');
    setShowAddPortfolio(false);
  };

  // Handle portfolio URL add
  const handleAddPortfolioUrl = () => {
    if (!portfolioUrl.trim()) {
      setPortfolioError('Molimo unesite URL');
      return;
    }

    let type: 'youtube' | 'tiktok' | 'instagram' = 'youtube';
    let platform: 'instagram' | 'tiktok' | 'youtube' = 'youtube';
    
    if (portfolioUrl.includes('youtube.com') || portfolioUrl.includes('youtu.be')) {
      type = 'youtube';
      platform = 'youtube';
    } else if (portfolioUrl.includes('tiktok.com')) {
      type = 'tiktok';
      platform = 'tiktok';
    } else if (portfolioUrl.includes('instagram.com')) {
      type = 'instagram';
      platform = 'instagram';
    } else {
      setPortfolioError('URL mora biti sa YouTube, TikTok ili Instagram');
      return;
    }

    // Za YouTube izvuci pravi thumbnail snimka; za TikTok/Instagram placeholder
    let thumbnail = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=300&h=400&fit=crop';
    if (type === 'youtube') {
      let videoId = '';
      if (portfolioUrl.includes('youtu.be/')) {
        videoId = portfolioUrl.split('youtu.be/')[1]?.split(/[?&]/)[0] || '';
      } else if (portfolioUrl.includes('/shorts/')) {
        videoId = portfolioUrl.split('/shorts/')[1]?.split(/[?&]/)[0] || '';
      } else if (portfolioUrl.includes('v=')) {
        videoId = portfolioUrl.split('v=')[1]?.split('&')[0] || '';
      }
      if (videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    const newItem: PortfolioItem = {
      id: `url-${Date.now()}`,
      type,
      url: portfolioUrl,
      thumbnail,
      description: portfolioDescription,
      platform,
    };
    
    setPortfolioItems([...portfolioItems, newItem]);
    setPortfolioUrl('');
    setPortfolioDescription('');
    setPortfolioError('');
    setShowAddPortfolio(false);
  };

  // Remove portfolio item
  const handleRemovePortfolioItem = (id: string) => {
    setPortfolioItems(portfolioItems.filter(item => item.id !== id));
  };

  // Drag and drop state for profile photo
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  const handlePhotoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Molimo prevucite sliku');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert('Slika je prevelika. Maksimalna veličina je 10MB.');
      return;
    }

    // Isti put kao klik-za-izbor: otvori cropper da bi photoPreview postao
    // data:image base64 (obavezno za FAZA 2 upload - blob: URL se tiho preskače).
    const imageUrl = URL.createObjectURL(file);
    setOriginalPhoto(imageUrl);
    setShowCropper(true);
  };

  const handlePhotoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhoto(true);
  };

  const handlePhotoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    
    // Validate step 1: Basic info
    if (step === 1) {
      if (!formData.email.trim()) {
        alert('Molimo unesite email adresu');
        return;
      }
      if (!formData.email.includes('@')) {
        alert('Molimo unesite validnu email adresu');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        alert('Lozinka mora imati najmanje 8 karaktera');
        return;
      }
      if (!formData.name.trim()) {
        alert('Molimo unesite ime i prezime');
        return;
      }
    }
    
    // Validate step 2: Bio, categories, platforms, languages
    if (step === 2) {
      if (!formData.bio.trim()) {
        alert('Molimo unesite kratki opis');
        return;
      }
      if (formData.categories.length === 0) {
        alert('Molimo izaberite bar jednu kategoriju');
        return;
      }
      if (formData.platforms.length === 0) {
        alert('Molimo izaberite bar jednu platformu');
        return;
      }
      if (formData.languages.length === 0) {
        alert('Molimo izaberite bar jedan jezik');
        return;
      }
    }
    
    // Validate step 3: Price, location, phone
    if (step === 3) {
      if (!formData.priceFrom || parseInt(formData.priceFrom) < 1) {
        alert('Molimo unesite početnu cenu');
        return;
      }
      if (!selectedCity) {
        alert('Molimo izaberite grad iz liste');
        return;
      }
      if (!formData.phone.trim()) {
        alert('Molimo unesite broj telefona');
        return;
      }
    }
    
    // Validate step 4: Photo and portfolio
    if (step === 4) {
      if (!photoPreview) {
        alert('Molimo dodajte profilnu sliku');
        return;
      }
      if (portfolioItems.length === 0) {
        setPortfolioError('Molimo dodajte bar jednu stavku u portfolio');
        return;
      }
      if (!acceptTerms) {
        alert('Morate prihvatiti uslove korišćenja i politiku privatnosti');
        return;
      }
    }
    
    if (step < 4) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final submit - pozovi API
      setIsSubmitting(true);
      
      try {
        // Razdvoj portfolio: URL stavke (lagane) salju se odmah u registraciju,
        // a fajl uploadi (slike/video) idu DIREKTNO u Storage POSLE kreiranja
        // naloga - da telo zahteva ne pređe Vercel 4.5MB limit (uzrok bivseg
        // "Unexpected token R" / 413 Request Entity Too Large buga).
        const urlItems = portfolioItems
          .filter(item => item.type !== 'upload')
          .map(item => ({
            id: item.id,
            type: item.type,
            url: item.url,
            thumbnail: item.thumbnail,
            description: item.description,
            platform: item.platform,
          }));
        const fileItems = portfolioItems.filter(item => item.type === 'upload' && item.file);

        // FAZA 1: Registracija BEZ base64 foto (Zod/Vercel limit) — samo URL portfolio.
        // Profilna slika ide u FAZI 2 preko /api/creators/[id]/photo posle logina.
        const response = await fetch('/api/auth/register/creator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            bio: formData.bio,
            location: formData.location,
            cityId: selectedCity?.id ?? null,
            lat: selectedCity?.lat ?? null,
            lng: selectedCity?.lng ?? null,
            priceFrom: formData.priceFrom,
            categories: formData.categories,
            platforms: formData.platforms,
            languages: formData.languages,
            instagram: formData.instagram || null,
            tiktok: formData.tiktok || null,
            youtube: formData.youtube || null,
            phone: formData.phone || null,
            photo: null,
            portfolio: urlItems,
          }),
        });

        const data = await safeJson(response);

        if (!response.ok) {
          throw new Error(data.error || 'Greška pri registraciji');
        }

        const creatorId: string | undefined = data.creatorId;

        // FAZA 2: login + upload profilne slike + portfolio fajlova (nalog već postoji)
        let uploadFailed = false;
        if (creatorId && (photoPreview || fileItems.length > 0)) {
          try {
            const supabase = createClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: formData.email,
              password: formData.password,
            });
            if (signInError) throw signInError;

            if (photoPreview?.startsWith('data:image')) {
              const photoRes = await fetch(`/api/creators/${creatorId}/photo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: photoPreview }),
              });
              if (!photoRes.ok) {
                const photoData = await safeJson(photoRes);
                throw new Error(photoData.error || 'Greška pri otpremanju profilne slike');
              }
            }

            if (fileItems.length > 0) {
              const uploadedItems = [];
              for (const item of fileItems) {
                const result = await uploadPortfolioFileToR2(item.file!, creatorId);
                uploadedItems.push({
                  id: item.id,
                  type: 'upload',
                  url: result.url,
                  thumbnail: result.isVideo ? '/video-thumbnail.jpg' : result.url,
                  description: item.description,
                  platform: item.platform || 'other',
                });
              }

              const putRes = await fetch(`/api/creators/${creatorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio: [...urlItems, ...uploadedItems] }),
              });
              if (!putRes.ok) {
                const putData = await safeJson(putRes);
                throw new Error(putData.error || 'Greška pri čuvanju portfolija');
              }
            }
          } catch (uploadErr) {
            // Nalog postoji - ne blokiraj registraciju zbog neuspelog uploada,
            // ali NE preusmeravaj automatski da korisnik stigne da pročita poruku
            // i sam odluči kad da nastavi (inače je tiho ostajao bez slike).
            console.error('Post-registration upload error:', uploadErr);
            setApiError(
              'Nalog je kreiran, ali otpremanje slike/fajlova nije uspelo. ' +
              'Možeš ih dodati kasnije iz svog profila.'
            );
            uploadFailed = true;
            setPhotoUploadFailed(true);
          }
        }

        console.log('Registration successful:', data);

        if (!uploadFailed) {
          // Redirect na stranicu čekanja
          router.push('/register/kreator/cekanje');
        }

      } catch (error) {
        console.error('Registration error:', error);
        setApiError(error instanceof Error ? error.message : 'Greška pri registraciji');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] py-12 lg:py-16">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-light mb-3">Postani UGC kreator</h1>
          <p className="text-muted">Registracija je besplatna</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm sm:text-base ${
                  s <= step ? 'bg-primary text-white' : 'bg-secondary text-muted'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 4 && (
                <div className={`w-8 sm:w-12 h-0.5 ${s < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-white border border-border rounded-3xl p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-medium mb-6">Osnovne informacije</h2>
              
              <div>
                <label className="text-sm text-muted mb-2 block">Ime i prezime *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Tvoje ime"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Email adresa *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tvoj@email.com"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                  required
                />
                <p className="text-xs text-muted mt-2">Koristi email na koji imaš pristup</p>
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Lozinka *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 karaktera"
                    className="w-full px-5 py-4 pr-12 border border-border rounded-xl focus:outline-none focus:border-muted"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Grad *</label>
                <CityAutocomplete
                  value={selectedCity}
                  onChange={(c) => {
                    setSelectedCity(c);
                    setFormData({ ...formData, location: c ? cityLabel(c) : '' });
                  }}
                  placeholder="Beograd, Novi Sad, Zagreb..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <h2 className="text-xl font-medium mb-6">Tvoj profil</h2>
              
              <div>
                <label className="text-sm text-muted mb-2 block">O tebi (bio) *</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Opiši sebe i svoje iskustvo..."
                  rows={4}
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-3 block">Kategorije (izaberi do 5) *</label>
                {isLoadingCategories ? (
                  <div className="flex items-center gap-2 text-muted text-sm">
                    <div className="w-4 h-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin"></div>
                    Učitavanje kategorija...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleCategoryToggle(category)}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          formData.categories.includes(category)
                            ? 'bg-primary text-white'
                            : 'bg-secondary hover:bg-accent'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-muted mb-3 block">Platforme *</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handlePlatformToggle(platform)}
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${
                        formData.platforms.includes(platform)
                          ? 'bg-primary text-white'
                          : 'bg-secondary hover:bg-accent'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted mb-3 block">Jezici *</label>
                <div className="flex flex-wrap gap-2">
                  {languages.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => handleLanguageToggle(language)}
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${
                        formData.languages.includes(language)
                          ? 'bg-primary text-white'
                          : 'bg-secondary hover:bg-accent'
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-medium mb-6">Kontakt i cene</h2>
              
              <div>
                <label className="text-sm text-muted mb-2 block">Početna cena po videu (€) *</label>
                <input
                  type="number"
                  value={formData.priceFrom}
                  onChange={(e) => setFormData({ ...formData, priceFrom: e.target.value })}
                  placeholder="100"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                  required
                  min={1}
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Instagram</label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="@"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">TikTok</label>
                <input
                  type="text"
                  value={formData.tiktok}
                  onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                  placeholder="@"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">YouTube</label>
                <input
                  type="text"
                  value={formData.youtube}
                  onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                  placeholder="@"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Broj telefona *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+381 61 123 4567"
                  className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-muted"
                  required
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-medium mb-2">Profilna slika i portfolio</h2>
              <p className="text-sm text-muted mb-6">
                Dodaj profilnu sliku i bar jednu stavku u portfolio.
              </p>

              {/* Profile Photo Upload with Drag & Drop */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-3 block">Profilna slika *</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handlePhotoDrop}
                  onDragOver={handlePhotoDragOver}
                  onDragLeave={handlePhotoDragLeave}
                  className={`relative w-32 h-32 mx-auto rounded-full overflow-hidden border-3 transition-all duration-200 cursor-pointer ${
                    isDraggingPhoto 
                      ? 'border-primary border-dashed scale-105 bg-primary/5' 
                      : photoPreview 
                        ? 'border-success border-solid' 
                        : 'border-border border-dashed hover:border-primary hover:bg-secondary/50'
                  }`}
                >
                  {photoPreview ? (
                    <>
                      <Image
                        src={photoPreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Promeni</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-muted gap-2">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs">Dodaj sliku</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted">
                    Klikni ili prevuci sliku • Max 10MB
                  </p>
                  <p className="text-xs text-primary/70 mt-1">
                    💡 Nakon izbora slike moći ćeš da je crop-uješ
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Portfolio radovi</h3>
                  <span className="text-xs text-muted">odaberi jednu od opcija</span>
                </div>
              </div>

              {/* Portfolio items display */}
              {portfolioItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {portfolioItems.map((item) => (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.url && (item.type === 'youtube' || item.type === 'tiktok' || item.type === 'instagram' || /youtube|youtu\.be|tiktok|instagram/.test(item.url))) {
                            window.open(item.url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary relative w-full text-left"
                        title={item.url ? 'Otvori link' : undefined}
                      >
                        {item.type === 'upload' && item.url.startsWith('data:video') ? (
                          <video src={item.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <Image
                            src={item.thumbnail}
                            alt="Portfolio"
                            fill
                            className="object-cover"
                            unoptimized={item.thumbnail.startsWith('data:')}
                          />
                        )}
                      </button>
                      <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {item.platform === 'instagram' ? 'Instagram' : 
                         item.platform === 'tiktok' ? 'TikTok' : 
                         item.platform === 'youtube' ? 'YouTube' : 'Upload'}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePortfolioItem(item.id)}
                        className="absolute bottom-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Portfolio add section - show when no items or accordion is open */}
              {(portfolioItems.length === 0 || showAddPortfolio) && (
                <div className="space-y-5">
                  {/* Option 1: Add from URL */}
                  <div>
                    <p className="text-sm text-muted mb-3">Dodaj link sa društvenih mreža</p>
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={portfolioUrl}
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=... ili tiktok.com/..."
                          className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm"
                        />
                        <input
                          type="text"
                          value={portfolioDescription}
                          onChange={(e) => setPortfolioDescription(e.target.value)}
                          placeholder="Opis projekta (opciono)"
                          className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddPortfolioUrl}
                          className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm"
                        >
                          + Dodaj link
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-sm text-muted">Ili dodaj sliku</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  {/* Option 2: Upload file */}
                  <div 
                    className="flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-secondary/30 transition-colors cursor-pointer bg-white"
                    onClick={() => portfolioInputRef.current?.click()}
                  >
                    <svg className="w-10 h-10 text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm font-medium">Klikni za upload</span>
                    <span className="text-xs text-muted mt-1">{UPLOAD_HINT}</span>
                  </div>
                  <input
                    ref={portfolioInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePortfolioUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Error message */}
              {portfolioError && (
                <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-sm text-error">
                  {portfolioError}
                </div>
              )}

              {/* Success indicator with accordion */}
              {portfolioItems.length > 0 && !showAddPortfolio && (
                <div className="space-y-3">
                  <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-success">
                      {portfolioItems.length} {portfolioItems.length === 1 ? 'stavka dodana' : 'stavke dodane'} u portfolio
                    </span>
                  </div>
                  
                  {/* Add more button */}
                  <button
                    type="button"
                    onClick={() => setShowAddPortfolio(true)}
                    className="w-full py-3 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Dodaj još
                  </button>
                </div>
              )}

              <div className="bg-secondary rounded-xl p-5 mt-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">ℹ️</span>
                  <div>
                    <h4 className="font-medium mb-1">Šta sledi?</h4>
                    <p className="text-sm text-muted">
                      Nakon registracije, naš tim će pregledati tvoj profil. 
                      Kada bude odobren, postaće vidljiv brendovima na platformi.
                    </p>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 mt-6 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary" 
                />
                <span className="text-sm text-muted">
                  Slažem se sa{' '}
                  <Link href="/uslovi-koriscenja" className="underline hover:text-foreground" target="_blank">uslovima korišćenja</Link>
                  {' '}i{' '}
                  <Link href="/politika-privatnosti" className="underline hover:text-foreground" target="_blank">politikom privatnosti</Link>
                  <span className="text-error ml-1">*</span>
                </span>
              </label>
            </div>
          )}

          {/* API Error */}
          {apiError && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-4 mt-6">
              <p className="text-sm text-error">{apiError}</p>
              {photoUploadFailed && (
                <button
                  type="button"
                  onClick={() => router.push('/register/kreator/cekanje')}
                  className="mt-3 text-sm font-medium text-foreground underline hover:no-underline"
                >
                  Nastavi bez slike →
                </button>
              )}
            </div>
          )}

          <div className="flex justify-between mt-10">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setStep(step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-6 py-3 text-sm text-muted hover:text-foreground"
                disabled={isSubmitting}
              >
                ← Nazad
              </button>
            ) : (
              <div />
            )}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Registracija...
                </>
              ) : step < 4 ? 'Nastavi' : 'Završi registraciju'}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-muted mt-10">
          Već imaš nalog?{' '}
          <Link href="/login" className="text-foreground hover:underline">
            Prijavi se
          </Link>
        </p>

        <p className="text-center text-sm text-muted mt-4">
          Registruješ brend?{' '}
          <Link href="/register/biznis" className="text-foreground hover:underline">
            Registruj se kao brend
          </Link>
        </p>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && originalPhoto && (
        <ImageCropper
          image={originalPhoto}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={3/4}
        />
      )}

    </div>
  );
}


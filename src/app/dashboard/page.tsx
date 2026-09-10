'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/context/DemoContext';
import Link from 'next/link';
import Image from 'next/image';
import ReviewCard from '@/components/ReviewCard';
import { AverageRating } from '@/components/StarRating';
import { generateReviewStats, Review } from '@/types/review';
import PortfolioModal, { PortfolioItem } from '@/components/PortfolioModal';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import ImageCropper from '@/components/ImageCropper';
import ChatModal from '@/components/ChatModal';
import { getPortfolioVideoType, isPortfolioVideo } from '@/lib/portfolio-media';
import { PAYMENTS_REQUIRED } from '@/lib/payments-config';

export default function DashboardPage() {
  const { currentUser, updateCreator } = useDemo();

  // Redirect logic would go here in real app
  if (currentUser.type === 'guest') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Nisi prijavljen</h1>
          <Link href="/login" className="text-primary hover:underline">
            Prijavi se
          </Link>
        </div>
      </div>
    );
  }

  if (currentUser.type === 'creator') {
    return <CreatorDashboard />;
  }

  // All business users have active subscription (payment required to access)
  return <BusinessDashboard />;
}

function CreatorDashboard() {
  const { updateCreator, isHydrated, currentUser } = useDemo();
  
  // ALL HOOKS MUST BE AT TOP - before any conditional returns
  const [creator, setCreator] = useState<any>(null);
  const [isLoadingCreator, setIsLoadingCreator] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'poslovi' | 'poruke'>('overview');
  
  // Sub-filter state for Poslovi tab (must be here with other hooks)
  const [creatorJobsFilter, setCreatorJobsFilter] = useState<'prijave' | 'pozivi' | 'angazovan' | 'zavrseno' | 'odbijeno' | 'sacuvano'>('prijave');
  
  // Saved jobs state
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [isLoadingSavedJobs, setIsLoadingSavedJobs] = useState(false);
  
  // Fetch saved jobs on mount
  useEffect(() => {
    const fetchSavedJobs = async () => {
      if (!isHydrated || !currentUser.creatorId) return;
      
      try {
        const response = await fetch(`/api/saved-jobs?creatorId=${currentUser.creatorId}`);
        if (response.ok) {
          const data = await response.json();
          setSavedJobs(data.savedJobs || []);
        }
      } catch (error) {
        console.error('Error fetching saved jobs:', error);
      }
    };
    
    fetchSavedJobs();
  }, [currentUser.creatorId, isHydrated]);
  
  // Read tab and subtab from URL on mount and mark as seen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      const subtab = urlParams.get('subtab');
      
      if (tab === 'reviews' || tab === 'poslovi' || tab === 'poruke') {
        setActiveTab(tab);
        // Also mark as viewed if coming directly to this tab
        const now = new Date().toISOString();
        if (tab === 'reviews' && currentUser.creatorId) {
          localStorage.setItem(`lastViewed_reviews_${currentUser.creatorId}`, now);
        } else if (tab === 'poslovi' && currentUser.creatorId) {
          localStorage.setItem(`lastViewed_applications_${currentUser.creatorId}`, now);
          localStorage.setItem(`lastViewed_invitations_${currentUser.creatorId}`, now);
          
          // Restore subtab
          if (subtab && ['prijave', 'pozivi', 'angazovan', 'zavrseno', 'odbijeno', 'sacuvano'].includes(subtab)) {
            setCreatorJobsFilter(subtab as any);
          }
        }
      }
    }
  }, [currentUser.creatorId]);
  
  // Wrapper to update URL when subtab changes
  const handleCreatorJobsFilterChange = (filter: 'prijave' | 'pozivi' | 'angazovan' | 'zavrseno' | 'odbijeno' | 'sacuvano') => {
    setCreatorJobsFilter(filter);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('subtab', filter);
      window.history.replaceState({}, '', url.toString());
    }
  };
  
  // State to track pending invitations count for badge clearing
  const [pendingInvitationsNewCount, setPendingInvitationsNewCount] = useState(0);
  
  // Update URL when tab changes and mark as "seen"
  const handleTabChange = (tab: 'overview' | 'reviews' | 'poslovi' | 'poruke') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'overview') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }
      window.history.replaceState({}, '', url.toString());
      
      // Mark tab as viewed - clear "new" badge
      const now = new Date().toISOString();
      if (tab === 'reviews' && currentUser.creatorId) {
        localStorage.setItem(`lastViewed_reviews_${currentUser.creatorId}`, now);
        setNewReviewsCount(0);
      } else if (tab === 'poslovi' && currentUser.creatorId) {
        // Mark both applications and invitations as viewed
        localStorage.setItem(`lastViewed_applications_${currentUser.creatorId}`, now);
        localStorage.setItem(`lastViewed_invitations_${currentUser.creatorId}`, now);
        setNewApplicationsCount(0);
        setPendingInvitationsNewCount(0);
        // Notify Header to clear notification badge
        window.dispatchEvent(new Event('notificationsCleared'));
      } else if (tab === 'poruke' && currentUser.creatorId) {
        localStorage.setItem(`lastViewed_messages_${currentUser.creatorId}`, now);
        setUnreadMessagesCount(0);
        // Notify Header to clear notification badge
        window.dispatchEvent(new Event('notificationsCleared'));
      }
    }
  };
  
  // Job applications state
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  
  // Job invitations state (Ponude)
  const [myInvitations, setMyInvitations] = useState<any[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  
  // Messages/Chat state
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  
  // "New items" tracking - counts items not yet seen
  const [newReviewsCount, setNewReviewsCount] = useState(0);
  const [newApplicationsCount, setNewApplicationsCount] = useState(0);
  
  // Inline editing states
  const [editingBio, setEditingBio] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [editingPlatforms, setEditingPlatforms] = useState(false);
  const [editingLanguages, setEditingLanguages] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Portfolio state
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<PortfolioItem | null>(null);
  const [activeImage, setActiveImage] = useState<PortfolioItem | null>(null);
  const [detailItem, setDetailItem] = useState<PortfolioItem | null>(null);
  const [deletePortfolioConfirm, setDeletePortfolioConfirm] = useState<PortfolioItem | null>(null);
  
  // Profile photo state
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [rawPhotoForCrop, setRawPhotoForCrop] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  
  // Editable form values
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [contactInfo, setContactInfo] = useState({
    email: '',
    phone: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    priceFrom: 0,
  });
  
  // Available options for multi-select (categories fetched from database)
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const availablePlatforms = ['Instagram', 'TikTok', 'YouTube'];
  const availableLanguages = ['Srpski', 'Engleski', 'Nemački', 'Francuski', 'Španski', 'Italijanski'];
  
  // Fetch creator data from Supabase - with caching for instant display
  useEffect(() => {
    const fetchCreator = async () => {
      // Wait for hydration before making decisions
      if (!isHydrated) {
        return;
      }
      
      if (!currentUser.creatorId) {
        setIsLoadingCreator(false);
        return;
      }
      
      // Try to load from cache first for instant display
      const cacheKey = `dashboard_creator_${currentUser.creatorId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setCreator(cachedData);
          setIsLoadingCreator(false); // Show cached data immediately
        } catch (e) {
          // Invalid cache, ignore
        }
      }
      
      // Fetch fresh data in background
      try {
        const response = await fetch(`/api/creators/${currentUser.creatorId}`);
        if (response.ok) {
          const data = await response.json();
          setCreator(data.creator);
          // Update cache (with try/catch to avoid QuotaExceededError)
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.creator));
          } catch (e) {
            // Quota exceeded, clear old items
            sessionStorage.clear();
          }
        }
      } catch (error) {
        console.error('Error fetching creator:', error);
      } finally {
        setIsLoadingCreator(false);
      }
    };
    
    fetchCreator();
  }, [isHydrated, currentUser.creatorId]);
  
  // Update form values when creator data is loaded
  useEffect(() => {
    if (creator) {
      setBio(creator.bio || '');
      setCategories(creator.categories || []);
      setPlatforms(creator.platforms || []);
      setLanguages(creator.languages || []);
      setContactInfo({
        email: creator.email || '',
        phone: creator.phone || '',
        instagram: creator.instagram || '',
        tiktok: creator.tiktok || '',
        youtube: creator.youtube || '',
        priceFrom: creator.priceFrom || 0,
      });
      setPortfolioItems(
        (creator.portfolio || []).map((item: any, index: number) => ({
          id: `existing-${index}`,
          type: item.type,
          url: item.url,
          thumbnail: item.thumbnail,
          description: item.description,
          platform: item.platform,
          originalUrl: item.originalUrl,
        }))
      );
    }
  }, [creator]);
  
  // Fetch reviews from Supabase
  useEffect(() => {
    const fetchReviews = async () => {
      if (!currentUser.creatorId) {
        setIsLoadingReviews(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/reviews?creatorId=${currentUser.creatorId}`);
        if (response.ok) {
          const data = await response.json();
          const fetchedReviews = data.reviews || [];
          setReviews(fetchedReviews);
          
          // Calculate new reviews count (since last viewed)
          const lastViewedKey = `lastViewed_reviews_${currentUser.creatorId}`;
          const lastViewed = localStorage.getItem(lastViewedKey);
          if (lastViewed) {
            const lastViewedDate = new Date(lastViewed);
            const newCount = fetchedReviews.filter((r: any) => new Date(r.createdAt) > lastViewedDate).length;
            setNewReviewsCount(newCount);
          } else {
            // First time - show all as new if there are any
            setNewReviewsCount(fetchedReviews.length > 0 ? fetchedReviews.length : 0);
          }
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setIsLoadingReviews(false);
      }
    };
    
    fetchReviews();
  }, [currentUser.creatorId]);
  
  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);
  
  // Fetch job applications on mount and poll every 30 seconds for badge counts
  useEffect(() => {
    let isFirstLoad = true;

    const fetchApplications = async () => {
      if (!isHydrated || !currentUser.creatorId) return;
      
      if (isFirstLoad) setIsLoadingApplications(true);
      try {
        const response = await fetch(`/api/job-applications?creatorId=${currentUser.creatorId}`);
        if (response.ok) {
          const data = await response.json();
          const fetchedApps = data.applications || [];
          setMyApplications(fetchedApps);
          
          const lastViewedKey = `lastViewed_applications_${currentUser.creatorId}`;
          const lastViewed = localStorage.getItem(lastViewedKey);
          if (lastViewed) {
            const lastViewedDate = new Date(lastViewed);
            const newCount = fetchedApps.filter((a: any) => 
              a.updatedAt && new Date(a.updatedAt) > lastViewedDate && 
              ['accepted', 'rejected', 'engaged', 'completed'].includes(a.status)
            ).length;
            setNewApplicationsCount(newCount);
          } else {
            const pendingResponses = fetchedApps.filter((a: any) => 
              ['accepted', 'rejected', 'engaged'].includes(a.status)
            ).length;
            setNewApplicationsCount(pendingResponses > 0 ? pendingResponses : 0);
          }
        }
        
        const unreadResponse = await fetch(`/api/job-messages?countUnread=true&recipientType=creator&recipientId=${currentUser.creatorId}`);
        if (unreadResponse.ok) {
          const unreadData = await unreadResponse.json();
          setUnreadMessagesCount(unreadData.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
      } finally {
        if (isFirstLoad) {
          setIsLoadingApplications(false);
          isFirstLoad = false;
        }
      }
    };
    
    fetchApplications();

    const interval = setInterval(fetchApplications, 30000);

    return () => clearInterval(interval);
  }, [currentUser.creatorId, isHydrated]);
  
  // Fetch job invitations (Ponude) on mount and poll every 30 seconds
  useEffect(() => {
    let isFirstLoad = true;
    
    const fetchInvitations = async () => {
      if (!isHydrated || !currentUser.creatorId) return;
      
      if (isFirstLoad) setIsLoadingInvitations(true);
      try {
        const response = await fetch(`/api/job-invitations?creatorId=${currentUser.creatorId}`);
        if (response.ok) {
          const data = await response.json();
          const invitations = data.invitations || [];
          setMyInvitations(invitations);
          
          // Calculate NEW pending invitations (created after last viewed)
          const lastViewedKey = `lastViewed_invitations_${currentUser.creatorId}`;
          const lastViewed = localStorage.getItem(lastViewedKey);
          const pendingInvs = invitations.filter((inv: any) => inv.status === 'pending');
          
          if (lastViewed) {
            const lastViewedDate = new Date(lastViewed);
            const newInvs = pendingInvs.filter((inv: any) => new Date(inv.createdAt) > lastViewedDate);
            setPendingInvitationsNewCount(newInvs.length);
          } else {
            // First time - all pending are "new"
            setPendingInvitationsNewCount(pendingInvs.length);
          }
        }
      } catch (error) {
        console.error('Error fetching invitations:', error);
      } finally {
        if (isFirstLoad) {
          setIsLoadingInvitations(false);
          isFirstLoad = false;
        }
      }
    };
    
    fetchInvitations();
    
    // Poll for new invitations every 30 seconds
    const interval = setInterval(fetchInvitations, 30000);
    
    return () => clearInterval(interval);
  }, [currentUser.creatorId, isHydrated]);
  
  // Show loading state
  if (!isHydrated || isLoadingCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Učitavanje...</p>
        </div>
      </div>
    );
  }
  
  // If no creator profile found, show error
  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Profil nije pronađen</h1>
          <p className="text-muted mb-6">Nismo pronašli vaš kreator profil.</p>
          <Link href="/" className="text-primary hover:underline">
            Nazad na početnu
          </Link>
        </div>
      </div>
    );
  }
  
  // Check creator status for pending/rejected
  if (creator.status === 'pending') {
    return <CreatorPendingScreen />;
  }
  
  if (creator.status === 'rejected') {
    return <CreatorRejectedScreen rejectionReason={creator.rejectionReason} />;
  }
  
  // Sačuvaj portfolio u bazu (PUT /api/creators/[id])
  const persistPortfolio = async (items: PortfolioItem[]) => {
    if (!creator?.id) return;
    try {
      await fetch(`/api/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio: items.map((i) => ({
            type: i.type,
            url: i.url,
            thumbnail: i.thumbnail,
            description: i.description,
            platform: i.platform,
            originalUrl: i.originalUrl,
          })),
        }),
      });
    } catch (e) {
      console.error('Greška pri čuvanju portfolija:', e);
    }
  };

  // Portfolio handlers
  const handleAddPortfolioItem = (item: PortfolioItem) => {
    const updated = [...portfolioItems, item];
    setPortfolioItems(updated);
    persistPortfolio(updated);
  };
  
  const handleRemovePortfolioItem = (item: PortfolioItem) => {
    setDeletePortfolioConfirm(item);
  };
  
  const confirmDeletePortfolioItem = () => {
    if (deletePortfolioConfirm) {
      const updated = portfolioItems.filter(item => item.id !== deletePortfolioConfirm.id);
      setPortfolioItems(updated);
      setDeletePortfolioConfirm(null);
      persistPortfolio(updated);
    }
  };
  
  
  // Use fetched reviews from Supabase
  const allReviews = reviews;
  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const pendingReviews = reviews.filter(r => r.status === 'pending');
  // Statistika se računa samo na osnovu odobrenih recenzija
  const stats = generateReviewStats(approvedReviews);

  // Pencil icon component
  const PencilButton = ({ onClick, editing }: { onClick: () => void; editing?: boolean }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${editing ? 'bg-primary text-white' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
      title="Uredi"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
      </svg>
    </button>
  );

  const handleSaveSection = async (section: string) => {
    setIsSaving(true);
    
    try {
      let updateData: any = {};
      
      if (section === 'bio') {
        updateData = { bio };
      } else if (section === 'categories') {
        updateData = { categories };
      } else if (section === 'platforms') {
        updateData = { platforms };
      } else if (section === 'languages') {
        updateData = { languages };
      } else if (section === 'contact') {
        updateData = {
          email: contactInfo.email,
          phone: contactInfo.phone || null,
          instagram: contactInfo.instagram || null,
          tiktok: contactInfo.tiktok || null,
          youtube: contactInfo.youtube || null,
          price_from: contactInfo.priceFrom,
        };
      }
      
      // Save to Supabase
      const response = await fetch(`/api/creators/${creator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      
      // Update local state
      setCreator({ ...creator, ...updateData });
      
      // Close editing mode
      if (section === 'bio') setEditingBio(false);
      else if (section === 'categories') setEditingCategories(false);
      else if (section === 'platforms') setEditingPlatforms(false);
      else if (section === 'languages') setEditingLanguages(false);
      else if (section === 'contact') setEditingContact(false);
      
    } catch (error) {
      console.error('Save error:', error);
      alert('Greška prilikom čuvanja. Pokušajte ponovo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    // Validation
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Sva polja su obavezna');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Nova lozinka mora imati minimum 8 karaktera');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Nove lozinke se ne poklapaju');
      return;
    }

    try {
      // Import supabase client
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      // Success
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordSuccess(false);
        setEditingPassword(false);
      }, 2000);
    } catch (error: any) {
      setPasswordError('Greška prilikom promene lozinke');
      console.error('Password change error:', error);
    }
  };

  const toggleArrayItem = (arr: string[], item: string, setArr: (arr: string[]) => void) => {
    if (arr.includes(item)) {
      setArr(arr.filter(i => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Molimo izaberite sliku');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Slika je prevelika. Maksimalna veličina je 5MB.');
      return;
    }

    setSelectedPhoto(file);

    // Create preview and open cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawPhotoForCrop(e.target?.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImage: string) => {
    setShowCropper(false);
    setPhotoPreview(croppedImage);
    setEditingPhoto(true);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawPhotoForCrop(null);
    setSelectedPhoto(null);
  };

  const handleSavePhoto = async () => {
    if (!photoPreview || !creator) return;

    setIsUploadingPhoto(true);

    try {
      const response = await fetch(`/api/creators/${creator.id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoPreview }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local creator data with new photo
        setCreator((prev: any) => prev ? { ...prev, photo: data.data.photoUrl } : prev);
        setEditingPhoto(false);
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setRawPhotoForCrop(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Greška pri uploadu slike');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Greška pri uploadu slike');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Count conversations (accepted + engaged applications)
  const conversationsCount = myApplications.filter(a => a.status === 'accepted' || a.status === 'engaged').length;
  
  const pendingInvitationsCount = myInvitations.filter(inv => inv.status === 'pending').length;
  
  // Combined count for Poslovi tab (new applications + new invitations)
  const totalJobsCount = (newApplicationsCount > 0 ? newApplicationsCount : 0) + (pendingInvitationsNewCount > 0 ? pendingInvitationsNewCount : 0);
  
  const tabs = [
    { id: 'overview' as const, label: 'Pregled', count: null },
    { id: 'reviews' as const, label: 'Statistika', count: newReviewsCount > 0 ? newReviewsCount : null }, // New reviews
    { id: 'poslovi' as const, label: 'Poslovi', count: totalJobsCount > 0 ? totalJobsCount : null }, // Combined jobs tab
    { id: 'poruke' as const, label: 'Poruke', count: null, unread: unreadMessagesCount }, // Unread messages
  ];
  
  // Handle opening chat from applications tab
  const handleOpenChat = (app: any) => {
    setActiveChat(app);
    handleTabChange('poruke');
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-light mb-2">Dashboard</h1>
            <p className="text-muted">Zdravo, {creator.name}</p>
          </div>
          <Link 
            href={`/kreator/${creator.id}`}
            className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-primary text-white rounded-full text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <svg className="hidden sm:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Pogledaj profil
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-border w-fit overflow-x-auto">
          {tabs.map((tab) => {
            const hasUnread = 'unread' in tab && (tab.unread ?? 0) > 0;
            const hasNewItems = tab.count !== null && tab.count > 0;
            const hasNotification = hasUnread || hasNewItems;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : hasNotification 
                      ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-400/50 hover:bg-amber-100' 
                      : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="relative">
                  {tab.label}
                  {/* Unread messages badge (red) - superscript */}
                  {hasUnread && (
                    <span className="absolute -top-2 -right-3 px-1.5 py-0.5 rounded-full text-[10px] bg-error text-white font-medium animate-pulse min-w-[18px] text-center shadow-lg">
                      {tab.unread}
                    </span>
                  )}
                  {/* New items badge - superscript */}
                  {!hasUnread && hasNewItems && (
                    <span className={`absolute -top-2 -right-3 px-1.5 py-0.5 rounded-full text-[10px] font-medium animate-pulse min-w-[18px] text-center shadow-lg ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Profile status */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium">Status profila</h2>
                  <span className="px-4 py-1.5 bg-success/10 text-success rounded-full text-sm">
                    Odobren
                  </span>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden relative border-2 border-border">
                      <Image 
                        src={photoPreview || creator.photo} 
                        alt={creator.name} 
                        fill 
                        className="object-cover"
                        unoptimized={!!photoPreview}
                      />
                    </div>
                    {editingPhoto ? (
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border-2 border-border">
                        <button
                          onClick={() => {
                            setEditingPhoto(false);
                            setPhotoPreview(null);
                            setSelectedPhoto(null);
                          }}
                          className="p-1 hover:bg-secondary rounded-full transition-colors"
                          title="Otkaži"
                        >
                          <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPhoto(true);
                          photoInputRef.current?.click();
                        }}
                        className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1.5 hover:bg-primary/90 transition-colors shadow-lg"
                        title="Promeni sliku"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-lg">{creator.name}</h3>
                    <p className="text-sm text-muted">{creator.location}</p>
                    <p className="text-sm text-muted mt-1">Od €{creator.priceFrom} po projektu</p>
                  </div>
                </div>
                
                {editingPhoto && photoPreview && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <p className="text-sm text-muted">Nova profilna slika</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingPhoto(false);
                          setPhotoPreview(null);
                          setSelectedPhoto(null);
                          setRawPhotoForCrop(null);
                        }}
                        disabled={isUploadingPhoto}
                        className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={handleSavePhoto}
                        disabled={isUploadingPhoto}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isUploadingPhoto ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Čuvam...
                          </>
                        ) : (
                          'Sačuvaj'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bio section with inline edit */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">O meni</h2>
                  <PencilButton onClick={() => setEditingBio(!editingBio)} editing={editingBio} />
                </div>
                
                {editingBio ? (
                  <div className="space-y-4">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary resize-none"
                      placeholder="Napiši nešto o sebi..."
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">{bio.length} karaktera</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setBio(creator.bio); setEditingBio(false); }}
                          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
                        >
                          Otkaži
                        </button>
                        <button
                          onClick={() => handleSaveSection('bio')}
                          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          Sačuvaj
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted leading-relaxed">{bio}</p>
                )}
              </div>

              {/* Categories section with inline edit */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Kategorije</h2>
                  <PencilButton onClick={() => setEditingCategories(!editingCategories)} editing={editingCategories} />
                </div>
                
                {editingCategories ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => toggleArrayItem(categories, cat, setCategories)}
                          className={`px-4 py-2 rounded-full text-sm transition-colors ${
                            categories.includes(cat)
                              ? 'bg-primary text-white'
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => { setCategories(creator.categories); setEditingCategories(false); }}
                        className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={() => handleSaveSection('categories')}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat, i) => (
                      <span key={i} className="px-4 py-2 bg-secondary rounded-full text-sm">{cat}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Platforms section with inline edit */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Platforme</h2>
                  <PencilButton onClick={() => setEditingPlatforms(!editingPlatforms)} editing={editingPlatforms} />
                </div>
                
                {editingPlatforms ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {availablePlatforms.map((plat) => (
                        <button
                          key={plat}
                          onClick={() => toggleArrayItem(platforms, plat, setPlatforms)}
                          className={`px-4 py-2 rounded-full text-sm transition-colors ${
                            platforms.includes(plat)
                              ? 'bg-primary text-white'
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          {plat}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => { setPlatforms(creator.platforms); setEditingPlatforms(false); }}
                        className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={() => handleSaveSection('platforms')}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((plat, i) => (
                      <span key={i} className="px-4 py-2 bg-secondary rounded-full text-sm">{plat}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Languages section with inline edit */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">Jezici</h2>
                  <PencilButton onClick={() => setEditingLanguages(!editingLanguages)} editing={editingLanguages} />
                </div>
                
                {editingLanguages ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => toggleArrayItem(languages, lang, setLanguages)}
                          className={`px-4 py-2 rounded-full text-sm transition-colors ${
                            languages.includes(lang)
                              ? 'bg-primary text-white'
                              : 'bg-secondary hover:bg-accent'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => { setLanguages(creator.languages); setEditingLanguages(false); }}
                        className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={() => handleSaveSection('languages')}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang, i) => (
                      <span key={i} className="px-4 py-2 bg-secondary rounded-full text-sm">{lang}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Portfolio */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium">Portfolio</h2>
                  <button 
                    onClick={() => setShowPortfolioModal(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    + Dodaj novu stavku
                  </button>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {portfolioItems.map((item) => {
                    // Get display platform
                    const displayPlatform = item.platform || item.type;
                    const platformLabels: Record<string, string> = {
                      instagram: 'Instagram',
                      tiktok: 'TikTok',
                      youtube: 'YouTube',
                      upload: 'Upload',
                      other: 'Ostalo'
                    };
                    
                    const isVideo = isPortfolioVideo(item);
                    const isImage = !isVideo;
                    
                    return (
                      <div key={item.id} className="flex flex-col">
                        <div 
                          className={`aspect-square relative rounded-xl overflow-hidden group cursor-pointer ${isImage ? 'hover:scale-105 transition-transform duration-300' : ''}`}
                          onClick={() => {
                            if (isVideo) {
                              setActiveVideo(item);
                            } else {
                              setActiveImage(item);
                            }
                          }}
                        >
                          {isVideo && item.type === 'upload' && item.url.startsWith('data:video') ? (
                            <video
                              src={item.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <Image 
                              src={item.thumbnail} 
                              alt="" 
                              fill 
                              className={`object-cover ${isImage ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
                              unoptimized={item.thumbnail.startsWith('data:')}
                            />
                          )}
                          {/* Hover overlay - different for video vs image */}
                          {isVideo ? (
                            // Play button for videos
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-foreground ml-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            // Zoom indicator for images
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                </svg>
                              </div>
                            </div>
                          )}
                          {/* Platform badge - text only */}
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-medium">
                            {platformLabels[displayPlatform] || displayPlatform}
                          </div>
                          {/* Delete button on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePortfolioItem(item);
                            }}
                            className="absolute bottom-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Obriši"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {/* Details button below image */}
                        {item.description && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailItem(item);
                            }}
                            className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 justify-center"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Detaljnije
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button 
                    onClick={() => setShowPortfolioModal(true)}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-primary hover:text-primary transition-colors"
                  >
                    <span className="text-3xl mb-2">+</span>
                    <span className="text-xs">Dodaj</span>
                  </button>
                </div>
              </div>
              
              {/* Portfolio Modal */}
              <PortfolioModal
                isOpen={showPortfolioModal}
                onClose={() => setShowPortfolioModal(false)}
                onAdd={handleAddPortfolioItem}
                creatorId={creator?.id}
              />

              {/* Video Player Modal */}
              <VideoPlayerModal
                isOpen={!!activeVideo}
                onClose={() => setActiveVideo(null)}
                videoUrl={activeVideo?.url || ''}
                videoType={getPortfolioVideoType(activeVideo || {})}
                originalUrl={activeVideo?.originalUrl || activeVideo?.url}
                description={activeVideo?.description}
              />

              {/* Image Zoom Modal */}
              {activeImage && (
                <div 
                  className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
                  onClick={() => setActiveImage(null)}
                  onKeyDown={(e) => e.key === 'Escape' && setActiveImage(null)}
                  tabIndex={0}
                  ref={(el) => el?.focus()}
                >
                  {/* Close button - fixed position, always visible */}
                  <button
                    onClick={() => setActiveImage(null)}
                    className="absolute top-6 right-6 z-10 bg-white text-black p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  <div 
                    className="relative w-full h-full flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Image container */}
                    <div className="relative max-w-5xl max-h-[85vh] w-full h-full">
                      <Image
                        src={activeImage.thumbnail}
                        alt={activeImage.description || 'Portfolio image'}
                        fill
                        className="object-contain"
                        unoptimized={activeImage.thumbnail.startsWith('data:')}
                      />
                      {/* Description overlay - inside image area */}
                      {activeImage.description && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-6 pt-12">
                          <p className="text-white text-sm whitespace-pre-wrap max-w-2xl">{activeImage.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* ESC hint - hidden on mobile */}
                  <div className="hidden sm:block absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs">
                    Pritisni ESC za zatvaranje
                  </div>
                </div>
              )}

              {/* Detail Popup Modal */}
              {detailItem && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setDetailItem(null)}
                >
                  <div 
                    className="bg-white rounded-xl max-w-md w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium">O projektu</h3>
                      <button 
                        onClick={() => setDetailItem(null)}
                        className="p-1 hover:bg-secondary rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Platform */}
                    <div className="mb-3">
                      <span className="text-xs text-muted uppercase tracking-wider">Platforma</span>
                      <p className="font-medium mt-1">
                        {detailItem.platform === 'instagram' ? 'Instagram' : 
                         detailItem.platform === 'tiktok' ? 'TikTok' : 
                         detailItem.platform === 'youtube' ? 'YouTube' : 
                         detailItem.type === 'upload' ? 'Upload' : 'Ostalo'}
                      </p>
                    </div>
                    
                    {/* Description */}
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wider">Opis projekta</span>
                      <p className="mt-1 text-foreground leading-relaxed">
                        {detailItem.description || 'Nema opisa'}
                      </p>
                    </div>

                    {/* Show button only for videos, not for images */}
                    {(() => {
                      const isVideo = isPortfolioVideo(detailItem);
                      const isImage = !isVideo && (
                        detailItem.type === 'upload' ||
                        !!detailItem.thumbnail?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                        !!detailItem.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                      );
                      
                      if (isVideo) {
                        return (
                          <button
                            onClick={() => {
                              setDetailItem(null);
                              setActiveVideo(detailItem);
                            }}
                            className="mt-6 w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Pusti video
                          </button>
                        );
                      } else if (isImage) {
                        return (
                          <button
                            onClick={() => {
                              setDetailItem(null);
                              setActiveImage(detailItem);
                            }}
                            className="mt-6 w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                            Pogledaj sliku
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Delete Portfolio Confirmation Modal */}
              {deletePortfolioConfirm && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setDeletePortfolioConfirm(null)}
                >
                  <div 
                    className="bg-white rounded-xl max-w-sm w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-center">
                      {/* Warning Icon */}
                      <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                      
                      <h3 className="text-lg font-semibold mb-2">Obriši portfolio stavku?</h3>
                      <p className="text-muted text-sm mb-6">
                        Da li ste sigurni da želite da obrišete ovu stavku iz portfolia? Ova akcija se ne može poništiti.
                      </p>
                      
                      {/* Thumbnail preview */}
                      {deletePortfolioConfirm.thumbnail && (
                        <div className="mb-6 rounded-lg overflow-hidden border border-border">
                          <img 
                            src={deletePortfolioConfirm.thumbnail} 
                            alt="Portfolio stavka"
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeletePortfolioConfirm(null)}
                          className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors"
                        >
                          Odustani
                        </button>
                        <button
                          onClick={confirmDeletePortfolioItem}
                          className="flex-1 py-2.5 bg-error text-white rounded-lg font-medium hover:bg-error/90 transition-colors"
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact info with inline edit */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Tvoje informacije</h3>
                  <PencilButton onClick={() => setEditingContact(!editingContact)} editing={editingContact} />
                </div>
                
                {editingContact ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-muted mb-1">Email</label>
                      <input
                        type="email"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="+381..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Instagram</label>
                      <input
                        type="text"
                        value={contactInfo.instagram}
                        onChange={(e) => setContactInfo({ ...contactInfo, instagram: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="@username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">TikTok</label>
                      <input
                        type="text"
                        value={contactInfo.tiktok}
                        onChange={(e) => setContactInfo({ ...contactInfo, tiktok: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="@username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">YouTube</label>
                      <input
                        type="text"
                        value={contactInfo.youtube}
                        onChange={(e) => setContactInfo({ ...contactInfo, youtube: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="@username ili URL kanala"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Cena od (€)</label>
                      <input
                        type="number"
                        value={contactInfo.priceFrom}
                        onChange={(e) => setContactInfo({ ...contactInfo, priceFrom: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        min="0"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => { 
                          setContactInfo({ 
                            email: creator.email, 
                            phone: creator.phone || '', 
                            instagram: creator.instagram || '', 
                            tiktok: creator.tiktok || '',
                            youtube: creator.youtube || '',
                            priceFrom: creator.priceFrom 
                          }); 
                          setEditingContact(false); 
                        }}
                        className="flex-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={() => handleSaveSection('contact')}
                        className="flex-1 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Email</span>
                      <span className="truncate ml-2">{contactInfo.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Telefon</span>
                      <span>{contactInfo.phone || '—'}</span>
                    </div>
                    {contactInfo.instagram && (
                      <div className="flex justify-between">
                        <span className="text-muted">Instagram</span>
                        <span>{contactInfo.instagram}</span>
                      </div>
                    )}
                    {contactInfo.tiktok && (
                      <div className="flex justify-between">
                        <span className="text-muted">TikTok</span>
                        <span>{contactInfo.tiktok}</span>
                      </div>
                    )}
                    {contactInfo.youtube && (
                      <div className="flex justify-between">
                        <span className="text-muted">YouTube</span>
                        <span>{contactInfo.youtube}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted">Cena od</span>
                      <span>€{contactInfo.priceFrom}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Change Password Section */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Promena lozinke</h3>
                  <PencilButton onClick={() => setEditingPassword(!editingPassword)} editing={editingPassword} />
                </div>
                
                {editingPassword ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-muted mb-1">Trenutna lozinka</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Nova lozinka</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-muted mt-1">Minimum 8 karaktera</p>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Potvrdi novu lozinku</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                        placeholder="••••••••"
                      />
                    </div>
                    
                    {passwordError && (
                      <div className="bg-error/10 border border-error/20 rounded-lg p-2">
                        <p className="text-xs text-error">{passwordError}</p>
                      </div>
                    )}
                    
                    {passwordSuccess && (
                      <div className="bg-success/10 border border-success/20 rounded-lg p-2">
                        <p className="text-xs text-success">Lozinka je uspešno promenjena!</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordError('');
                          setPasswordSuccess(false);
                          setEditingPassword(false);
                        }}
                        className="flex-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={handleChangePassword}
                        className="flex-1 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Sačuvaj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted">
                    <p>Klikni na olovku da promeniš lozinku</p>
                  </div>
                )}
              </div>

              {/* Reviews summary */}
              <div className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Recenzije</h3>
                  <button 
                    onClick={() => handleTabChange('reviews')}
                    className="text-sm text-primary hover:underline"
                  >
                    Vidi sve →
                  </button>
                </div>
                {stats.totalReviews > 0 ? (
                  <AverageRating 
                    rating={stats.averageRating} 
                    totalReviews={stats.totalReviews} 
                    size="sm"
                  />
                ) : (
                  <p className="text-sm text-muted">Još uvek nemate recenzija.</p>
                )}
                {pendingReviews.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-warning flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning"></span>
                      {pendingReviews.length} recenzija čeka odobrenje
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-8">
            {/* Profile Statistics section */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-medium mb-6">Statistika profila</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-secondary/30 rounded-xl">
                  <div className="text-3xl font-light mb-1">{creator.profileViews || 0}</div>
                  <div className="text-sm text-muted">Pregleda profila</div>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-xl">
                  <div className="text-3xl font-light mb-1">{stats.averageRating.toFixed(1)}</div>
                  <div className="text-sm text-muted">Prosečna ocena</div>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-xl">
                  <div className="text-3xl font-light mb-1">{approvedReviews.length}</div>
                  <div className="text-sm text-muted">Ukupno recenzija</div>
                </div>
              </div>
            </div>
            
            {/* Jobs Statistics section */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-medium mb-6">Pregled saradnji</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-3xl font-light mb-1 text-emerald-600">
                    {myApplications.filter(a => a.status === 'completed').length}
                  </div>
                  <div className="text-sm text-emerald-600">Završenih</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-3xl font-light mb-1 text-blue-600">
                    {myApplications.filter(a => a.status === 'engaged').length}
                  </div>
                  <div className="text-sm text-blue-600">U toku</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-3xl font-light mb-1 text-amber-600">
                    {myApplications.filter(a => a.status === 'pending').length}
                  </div>
                  <div className="text-sm text-amber-600">Čeka odgovor</div>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-xl">
                  <div className="text-3xl font-light mb-1">
                    {myApplications.length}
                  </div>
                  <div className="text-sm text-muted">Ukupno prijava</div>
                </div>
              </div>
              
              {/* Success rate */}
              {myApplications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted">
                    Stopa prihvatanja: <span className="font-medium text-success">{Math.round((myApplications.filter(a => ['accepted', 'engaged', 'completed'].includes(a.status)).length / myApplications.length) * 100)}%</span>
                  </p>
                </div>
              )}
            </div>
            
            {/* Invitations Statistics section */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-medium mb-6">Pozivi za saradnju</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="text-3xl font-light mb-1 text-purple-600">
                    {myInvitations.length}
                  </div>
                  <div className="text-sm text-purple-600">Primljeno poziva</div>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-xl border border-success/20">
                  <div className="text-3xl font-light mb-1 text-success">
                    {myInvitations.filter(inv => inv.status === 'accepted').length}
                  </div>
                  <div className="text-sm text-success">Prihvaćeno</div>
                </div>
                <div className="text-center p-4 bg-error/10 rounded-xl border border-error/20">
                  <div className="text-3xl font-light mb-1 text-error">
                    {myInvitations.filter(inv => inv.status === 'rejected').length}
                  </div>
                  <div className="text-sm text-error">Odbijeno</div>
                </div>
              </div>
              
              {/* Pending invitations notice */}
              {myInvitations.filter(inv => inv.status === 'pending').length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    {myInvitations.filter(inv => inv.status === 'pending').length} poziva čeka tvoj odgovor
                  </div>
                </div>
              )}
            </div>

            {/* Reviews header */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h2 className="text-lg font-medium mb-1">Tvoje recenzije</h2>
              <p className="text-sm text-muted">
                Ocene koje su ti ostavili brendovi
              </p>
            </div>

            {/* Pending reviews notice */}
            {pendingReviews.length > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-warning">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <p className="text-sm">
                    <strong>{pendingReviews.length} recenzija</strong> čeka odobrenje od strane administratora. 
                    Ove recenzije još uvek nisu vidljive na tvom profilu.
                  </p>
                </div>
              </div>
            )}

            {/* Reviews list - samo odobrene recenzije */}
            {approvedReviews.length > 0 ? (
              <div className="space-y-4">
                {approvedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    showStatus={true}
                    canReply={review.status === 'approved' && !review.creatorReply}
                    canEditReply={!!review.creatorReply}
                    canDeleteReply={!!review.creatorReply}
                    onReply={async (reviewId, reply) => {
                      try {
                        const res = await fetch(`/api/reviews/${reviewId}/reply`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reply }),
                        });
                        if (res.ok) {
                          // Update local state
                          setReviews(prev => prev.map(r => 
                            r.id === reviewId 
                              ? { ...r, creatorReply: reply, replyDate: new Date().toISOString().split('T')[0] }
                              : r
                          ));
                          return true;
                        }
                        return false;
                      } catch (error) {
                        console.error('Error adding reply:', error);
                        return false;
                      }
                    }}
                    onEditReply={async (reviewId, reply) => {
                      try {
                        const res = await fetch(`/api/reviews/${reviewId}/reply`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reply }),
                        });
                        if (res.ok) {
                          setReviews(prev => prev.map(r => 
                            r.id === reviewId 
                              ? { ...r, creatorReply: reply, replyDate: new Date().toISOString().split('T')[0] }
                              : r
                          ));
                          return true;
                        }
                        return false;
                      } catch (error) {
                        console.error('Error updating reply:', error);
                        return false;
                      }
                    }}
                    onDeleteReply={async (reviewId) => {
                      try {
                        const res = await fetch(`/api/reviews/${reviewId}/reply`, {
                          method: 'DELETE',
                        });
                        if (res.ok) {
                          setReviews(prev => prev.map(r => 
                            r.id === reviewId 
                              ? { ...r, creatorReply: undefined, replyDate: undefined }
                              : r
                          ));
                          return true;
                        }
                        return false;
                      } catch (error) {
                        console.error('Error deleting reply:', error);
                        return false;
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-border">
                <div className="text-5xl mb-4">📝</div>
                <h3 className="text-lg font-medium mb-2">Još uvek nemaš recenzija</h3>
                <p className="text-muted">
                  Kada brendovi ostave recenzije za tvoj rad, one će se pojaviti ovde.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Poslovi tab - Combined view with filters */}
        {activeTab === 'poslovi' && (
          <div>
            {/* Sub-filter buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => handleCreatorJobsFilterChange('prijave')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'prijave'
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Prijave
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'prijave' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {myApplications.filter(a => a.status === 'pending' || a.status === 'accepted').length}
                </span>
              </button>
              <button
                onClick={() => handleCreatorJobsFilterChange('pozivi')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'pozivi'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Pozivi
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'pozivi' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {myInvitations.filter(inv => inv.status === 'pending').length}
                </span>
              </button>
              <button
                onClick={() => handleCreatorJobsFilterChange('angazovan')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'angazovan'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Angažovan
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'angazovan' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {myApplications.filter(a => a.status === 'engaged').length}
                </span>
              </button>
              <button
                onClick={() => handleCreatorJobsFilterChange('zavrseno')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'zavrseno'
                    ? 'bg-success text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Završeno
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'zavrseno' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {myApplications.filter(a => a.status === 'completed').length}
                </span>
              </button>
              <button
                onClick={() => handleCreatorJobsFilterChange('odbijeno')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'odbijeno'
                    ? 'bg-slate-600 text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Odbijeno
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'odbijeno' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {myApplications.filter(a => a.status === 'rejected').length + myInvitations.filter(inv => inv.status === 'rejected').length}
                </span>
              </button>
              <button
                onClick={() => handleCreatorJobsFilterChange('sacuvano')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  creatorJobsFilter === 'sacuvano'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-border text-muted hover:bg-secondary'
                }`}
              >
                Sačuvano
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  creatorJobsFilter === 'sacuvano' ? 'bg-white/20' : 'bg-secondary'
                }`}>
                  {savedJobs.length}
                </span>
              </button>
            </div>

            {/* Content based on filter */}
            {creatorJobsFilter === 'prijave' && (
              <CreatorApplicationsTab 
                applications={myApplications.filter(a => a.status === 'pending' || a.status === 'accepted')}
                setApplications={setMyApplications}
                isLoading={isLoadingApplications}
                creatorId={currentUser.creatorId || ''}
                onOpenChat={handleOpenChat}
                filterMode="prijave"
              />
            )}
            
            {creatorJobsFilter === 'pozivi' && (
              <CreatorInvitationsTab
                invitations={myInvitations.filter(inv => inv.status === 'pending')}
                setInvitations={setMyInvitations}
                applications={myApplications}
                setApplications={setMyApplications}
                isLoading={isLoadingInvitations}
                creatorId={currentUser.creatorId || ''}
                onOpenChat={(app) => {
                  setActiveChat(app);
                  handleTabChange('poruke');
                }}
                hideStats={true}
              />
            )}
            
            {creatorJobsFilter === 'angazovan' && (
              <CreatorApplicationsTab 
                applications={myApplications.filter(a => a.status === 'engaged')}
                setApplications={setMyApplications}
                isLoading={isLoadingApplications}
                creatorId={currentUser.creatorId || ''}
                onOpenChat={handleOpenChat}
                filterMode="angazovan"
              />
            )}
            
            {creatorJobsFilter === 'zavrseno' && (
              <CreatorApplicationsTab 
                applications={myApplications.filter(a => a.status === 'completed')}
                setApplications={setMyApplications}
                isLoading={isLoadingApplications}
                creatorId={currentUser.creatorId || ''}
                onOpenChat={handleOpenChat}
                filterMode="zavrseno"
              />
            )}
            
            {creatorJobsFilter === 'odbijeno' && (
              <div>
                {/* Rejected applications */}
                {myApplications.filter(a => a.status === 'rejected').length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted mb-3">Odbijene prijave</h3>
                    <CreatorApplicationsTab 
                      applications={myApplications.filter(a => a.status === 'rejected')}
                      setApplications={setMyApplications}
                      isLoading={isLoadingApplications}
                      creatorId={currentUser.creatorId || ''}
                      onOpenChat={handleOpenChat}
                      filterMode="odbijeno"
                    />
                  </div>
                )}
                {/* Rejected invitations */}
                {myInvitations.filter(inv => inv.status === 'rejected').length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted mb-3">Odbijeni pozivi</h3>
                    <CreatorInvitationsTab
                      invitations={myInvitations.filter(inv => inv.status === 'rejected')}
                      setInvitations={setMyInvitations}
                      applications={myApplications}
                      setApplications={setMyApplications}
                      isLoading={isLoadingInvitations}
                      creatorId={currentUser.creatorId || ''}
                      onOpenChat={(app) => {
                        setActiveChat(app);
                        handleTabChange('poruke');
                      }}
                      hideStats={true}
                    />
                  </div>
                )}
                {/* Empty state */}
                {myApplications.filter(a => a.status === 'rejected').length === 0 && 
                 myInvitations.filter(inv => inv.status === 'rejected').length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="font-medium mb-2">Nema odbijenih</h3>
                    <p className="text-sm text-muted">Sve tvoje prijave i pozivi su još uvek aktivni.</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Saved jobs */}
            {creatorJobsFilter === 'sacuvano' && (
              <div>
                <h2 className="text-lg font-medium mb-4">Sačuvani poslovi</h2>
                
                {isLoadingSavedJobs ? (
                  <div className="text-center py-16">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted">Učitavanje sačuvanih poslova...</p>
                  </div>
                ) : savedJobs.length > 0 ? (
                  <div className="space-y-4">
                    {savedJobs.map((saved) => (
                      <div key={saved.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <Link 
                                href={`/poslovi/${saved.job?.id}`}
                                className="font-medium hover:text-primary transition-colors truncate"
                              >
                                {saved.job?.title || 'Posao'}
                              </Link>
                              <span className={`px-3 py-1 text-xs rounded-full ${
                                saved.job?.status === 'open' 
                                  ? 'bg-success/10 text-success' 
                                  : 'bg-muted/20 text-muted'
                              }`}>
                                {saved.job?.status === 'open' ? 'Otvoren' : 'Zatvoren'}
                              </span>
                            </div>
                            <p className="text-sm text-muted">{saved.job?.businessName} • <span className="text-[10px] uppercase tracking-wide">Kategorija:</span> {saved.job?.category}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {saved.job?.budgetMin || saved.job?.budgetMax ? (
                              <div className="font-medium">
                                {saved.job?.budgetMin && saved.job?.budgetMax 
                                  ? `€${saved.job.budgetMin} - €${saved.job.budgetMax}`
                                  : saved.job?.budgetMin 
                                    ? `Od €${saved.job.budgetMin}`
                                    : `Do €${saved.job.budgetMax}`
                                }
                              </div>
                            ) : (
                              <div className="font-medium">Po dogovoru</div>
                            )}
                            <div className="text-xs text-muted">
                              {saved.job?.budgetType === 'hourly' ? 'po satu' : 'fiksno'}
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted line-clamp-2 mb-4">
                          {saved.job?.description}
                        </p>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <span className="text-xs text-muted">
                            Sačuvano: {new Date(saved.savedAt).toLocaleDateString('sr-RS')}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await fetch(`/api/saved-jobs?creatorId=${currentUser.creatorId}&jobId=${saved.job?.id}`, {
                                    method: 'DELETE',
                                  });
                                  setSavedJobs(savedJobs.filter(s => s.id !== saved.id));
                                } catch (error) {
                                  console.error('Error unsaving:', error);
                                }
                              }}
                              className="px-3 py-1.5 text-xs text-error border border-error/30 rounded-lg hover:bg-error/10 transition-colors"
                            >
                              Ukloni
                            </button>
                            <Link
                              href={`/poslovi/${saved.job?.id}`}
                              className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Pogledaj
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border">
                    <div className="text-5xl mb-4">🔖</div>
                    <h3 className="text-lg font-medium mb-2">Nemaš sačuvanih poslova</h3>
                    <p className="text-sm text-muted mb-6">
                      Sačuvaj poslove koji te interesuju da ih lako pronađeš kasnije
                    </p>
                    <Link
                      href="/poslovi"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                    >
                      Pregledaj poslove
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Poruke tab */}
        {activeTab === 'poruke' && (
          <CreatorMessagesTab
            applications={myApplications.filter(a => a.status === 'accepted' || a.status === 'engaged')}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            creatorId={currentUser.creatorId || ''}
          />
        )}

      </div>

      {/* Image Cropper Modal */}
      {showCropper && rawPhotoForCrop && (
        <ImageCropper
          image={rawPhotoForCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1} // Square for profile photo
        />
      )}

    </div>
  );
}

// Note: All business users must have active subscription to access the app
// Pricing/payment page will be shown during registration (via Stripe integration)
function BusinessDashboard() {
  const { currentUser, isHydrated } = useDemo();
  const [showPortalMessage, setShowPortalMessage] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [changePlanError, setChangePlanError] = useState<string | null>(null);
  const [changePlanSuccess, setChangePlanSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [visibleReviews, setVisibleReviews] = useState(3);
  const [viewingReview, setViewingReview] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Tab state - default to 'pregled', check URL for 'poslovi'
  const [activeTab, setActiveTab] = useState<'pregled' | 'poslovi' | 'poruke'>('pregled');
  
  // Real business data from Supabase
  const [businessData, setBusinessData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  
  // Real data from Supabase
  const [recentCreators, setRecentCreators] = useState<any[]>([]);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  
  // Jobs data
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  
  // Messages state
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  
  // Pending applications count for badge (total pending)
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  // NEW pending applications (created after last viewed) - for header notification
  const [newPendingApplicationsCount, setNewPendingApplicationsCount] = useState(0);
  // Track NEW applications per job (for yellow border highlight)
  const [jobsWithNewApplications, setJobsWithNewApplications] = useState<Set<string>>(new Set());
  
  // Unread messages count for badge
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  
  // Global toast state
  const [globalToast, setGlobalToast] = useState<string | null>(null);
  
  // Company info editing state
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoCropImage, setLogoCropImage] = useState<string | null>(null);
  const [showLogoCropper, setShowLogoCropper] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Check URL for tab parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      const action = urlParams.get('action');
      if (tab === 'poslovi') {
        setActiveTab('poslovi');
        if (action === 'new') {
          setShowAddJobModal(true);
        }
      } else if (tab === 'poruke') {
        setActiveTab('poruke');
      }
    }
  }, []);
  
  // Update URL when tab changes and mark as viewed
  const handleTabChange = (tab: 'pregled' | 'poslovi' | 'poruke') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'pregled') {
        url.searchParams.delete('tab');
        url.searchParams.delete('action');
      } else {
        url.searchParams.set('tab', tab);
        url.searchParams.delete('action');
      }
      window.history.replaceState({}, '', url.toString());
      
      // Mark tab as viewed - clear header notification
      if (tab === 'poslovi' && currentUser.businessId) {
        const now = new Date().toISOString();
        localStorage.setItem(`lastViewed_jobs_${currentUser.businessId}`, now);
        setNewPendingApplicationsCount(0);
        // Notify Header to clear notification badge
        window.dispatchEvent(new Event('notificationsCleared'));
      } else if (tab === 'poruke' && currentUser.businessId) {
        const now = new Date().toISOString();
        localStorage.setItem(`lastViewed_messages_${currentUser.businessId}`, now);
        setUnreadMessagesCount(0);
        // Notify Header to clear notification badge
        window.dispatchEvent(new Event('notificationsCleared'));
      }
    }
  };
  
  // Fetch all applications for messages tab and pending count — poll every 30s
  useEffect(() => {
    const fetchApplications = async () => {
      if (!currentUser.businessId) return;
      
      try {
        const response = await fetch(`/api/job-applications?businessId=${currentUser.businessId}`);
        if (response.ok) {
          const data = await response.json();
          const allApps = data.applications || [];
          
          const pendingApps = allApps.filter((app: any) => app.status === 'pending');
          const pendingCount = pendingApps.length;
          setPendingApplicationsCount(pendingCount);
          
          const lastViewedKey = `lastViewed_jobs_${currentUser.businessId}`;
          const lastViewed = localStorage.getItem(lastViewedKey);
          if (lastViewed) {
            const lastViewedDate = new Date(lastViewed);
            const newApps = pendingApps.filter((app: any) => new Date(app.createdAt) > lastViewedDate);
            setNewPendingApplicationsCount(newApps.length);
            
            const jobsWithNew = new Set<string>();
            newApps.forEach((app: any) => {
              if (app.jobId) jobsWithNew.add(app.jobId);
            });
            setJobsWithNewApplications(jobsWithNew);
          } else {
            setNewPendingApplicationsCount(pendingCount);
            const jobsWithNew = new Set<string>();
            pendingApps.forEach((app: any) => {
              if (app.jobId) jobsWithNew.add(app.jobId);
            });
            setJobsWithNewApplications(jobsWithNew);
          }
          
          const activeApps = allApps.filter(
            (app: any) => app.status === 'accepted' || app.status === 'engaged'
          );
          setAllApplications(activeApps);
        }
        
        const unreadResponse = await fetch(`/api/job-messages?countUnread=true&recipientType=business&recipientId=${currentUser.businessId}`);
        if (unreadResponse.ok) {
          const unreadData = await unreadResponse.json();
          setUnreadMessagesCount(unreadData.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
      }
    };
    
    fetchApplications();

    const interval = setInterval(fetchApplications, 30000);

    return () => clearInterval(interval);
  }, [currentUser.businessId]);

  // Fetch real business data from Supabase - with caching and parallel fetching
  useEffect(() => {
    const fetchBusinessData = async () => {
      // Wait for hydration before making decisions
      if (!isHydrated) {
        return;
      }
      
      if (!currentUser.businessId) {
        setIsLoading(false);
        return;
      }
      
      // Try to load from cache first for instant display
      const cacheKey = `dashboard_business_${currentUser.businessId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (cachedData.profile) {
            setBusinessData(cachedData.profile);
            setCompanyName(cachedData.profile.company_name || '');
            setWebsite(cachedData.profile.website || '');
            setIndustry(cachedData.profile.industry || '');
            setDescription(cachedData.profile.description || '');
            setCompanyLogo(cachedData.profile.logo || null);
          }
          if (cachedData.subscription) setSubscriptionData(cachedData.subscription);
          if (cachedData.recentCreators) setRecentCreators(cachedData.recentCreators);
          if (cachedData.reviews) setMyReviews(cachedData.reviews);
          setIsLoading(false); // Show cached data immediately
        } catch (e) {
          // Invalid cache, ignore
        }
      }
      
      try {
        // Fetch ALL data in PARALLEL for speed
        const [profileRes, subRes, viewsRes, reviewsRes] = await Promise.all([
          fetch(`/api/business/profile?businessId=${currentUser.businessId}&t=${Date.now()}`),
          fetch(`/api/stripe/subscription-status?businessId=${currentUser.businessId}&t=${Date.now()}`),
          fetch(`/api/creator-views?businessId=${currentUser.businessId}&limit=3`),
          fetch(`/api/reviews?businessId=${currentUser.businessId}`)
        ]);
        
        const cacheData: any = {};
        
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setBusinessData(profile);
          setCompanyName(profile.company_name || '');
          setWebsite(profile.website || '');
          setIndustry(profile.industry || '');
          setDescription(profile.description || '');
          setCompanyLogo(profile.logo || null);
          cacheData.profile = profile;
        }
        
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscriptionData(subData);
          cacheData.subscription = subData;
        }
        
        if (viewsRes.ok) {
          const viewsData = await viewsRes.json();
          setRecentCreators(viewsData.creators || []);
          cacheData.recentCreators = viewsData.creators || [];
        } else {
          console.log('Failed to fetch recent creators:', viewsRes.status);
        }
        
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setMyReviews(reviewsData.reviews || []);
          cacheData.reviews = reviewsData.reviews || [];
        }
        
        // Update cache (with try/catch to avoid QuotaExceededError)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          // Quota exceeded, clear old items
          sessionStorage.clear();
        }
      } catch (error) {
        console.error('Error fetching business data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBusinessData();
  }, [isHydrated, currentUser.businessId, currentUser.subscriptionStatus]);

  // Function to fetch jobs - can be called for refresh
  const refreshJobs = async () => {
    if (!currentUser.businessId) return;
    
    // Fetch jobs for business dashboard
    setIsLoadingJobs(true);
    try {
      const response = await fetch(`/api/jobs?businessId=${currentUser.businessId}`);
      console.log('Business Dashboard: Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        setMyJobs(data.jobs || []);
      } else {
        const errorText = await response.text();
        console.error('Business Dashboard: Failed to fetch jobs:', errorText);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };
  
  // Fetch jobs when tab is active and poll every 30 seconds
  useEffect(() => {
    if (activeTab === 'poslovi') {
      refreshJobs();
      
      // Poll for updates every 30 seconds
      const interval = setInterval(refreshJobs, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, currentUser.businessId]);
  
  // Handle review delete
  const handleDeleteReview = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/reviews?reviewId=${reviewId}`, { method: 'DELETE' });
      if (res.ok) {
        setMyReviews(prev => prev.filter(r => r.id !== reviewId));
        setShowDeleteSuccess(true);
        setTimeout(() => setShowDeleteSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };
  
  // Handle show more reviews
  const handleShowMoreReviews = () => {
    setVisibleReviews(prev => Math.min(prev + 3, myReviews.length));
  };
  
  const hasMoreReviews = visibleReviews < myReviews.length;
  
  // Real subscription data from Supabase/Stripe
  // Prioritet: Supabase (businessData) jer se odmah ažurira pri obnovi
  const subscription = useMemo(() => {
    const status = businessData?.subscription_status || subscriptionData?.status || 'active';
    const expiresAt = businessData?.expires_at || subscriptionData?.currentPeriodEnd || new Date().toISOString();
    const plan = businessData?.subscription_type || subscriptionData?.plan || 'monthly';
    
    // Check if user still has access based on expires_at
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const hasAccessUntilExpiry = expiryDate > now;
    
    // Effective status: if expired but still has access, show as "active until X"
    const effectivelyActive = status === 'active' || (status === 'expired' && hasAccessUntilExpiry);
    
    return {
      plan,
      status,
      expiresAt,
      price: plan === 'monthly' ? '$99/mesec' : '$948/godina',
      cancelAtPeriodEnd: subscriptionData?.cancelAtPeriodEnd || false,
      hasAccessUntilExpiry,
      effectivelyActive,
    };
  }, [businessData, subscriptionData]);

  const handleManageSubscription = async () => {
    if (!currentUser.businessId) {
      setShowPortalMessage(true);
      setTimeout(() => setShowPortalMessage(false), 3000);
      return;
    }
    
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: currentUser.businessId }),
      });
      
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        // Fallback to message if no Stripe customer
        setShowPortalMessage(true);
        setTimeout(() => setShowPortalMessage(false), 3000);
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      setShowPortalMessage(true);
      setTimeout(() => setShowPortalMessage(false), 3000);
    }
  };

  // Promena plana (mesečni <-> godišnji) direktno iz aplikacije.
  // Stripe automatski obračunava prorata; status se odmah refetch-uje.
  const handleChangePlan = async () => {
    if (!currentUser.businessId || isChangingPlan) return;
    const targetPlan = subscription.plan === 'yearly' ? 'monthly' : 'yearly';
    setIsChangingPlan(true);
    setChangePlanError(null);
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: currentUser.businessId, newPlan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Promena plana nije uspela.');

      // Očisti keš pa povuci sveže podatke o pretplati
      try { sessionStorage.removeItem(`dashboard_business_${currentUser.businessId}`); } catch {}
      const [profileRes, subRes] = await Promise.all([
        fetch(`/api/business/profile?businessId=${currentUser.businessId}&t=${Date.now()}`),
        fetch(`/api/stripe/subscription-status?businessId=${currentUser.businessId}&t=${Date.now()}`),
      ]);
      if (profileRes.ok) setBusinessData(await profileRes.json());
      if (subRes.ok) setSubscriptionData(await subRes.json());

      setShowChangePlanModal(false);
      setChangePlanSuccess(true);
      setTimeout(() => setChangePlanSuccess(false), 4000);
    } catch (error: any) {
      setChangePlanError(error?.message || 'Greška pri promeni plana.');
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Pencil icon component for editing
  const PencilButton = ({ onClick, editing }: { onClick: () => void; editing?: boolean }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${editing ? 'bg-primary text-white' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
      title="Uredi"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );

  // Handle logo file select for business
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Slika mora biti manja od 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setLogoCropImage(evt.target?.result as string);
        setShowLogoCropper(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (e.target) e.target.value = '';
  };
  
  // Handle logo crop complete
  const handleLogoCropComplete = async (croppedImage: string) => {
    setShowLogoCropper(false);
    setLogoCropImage(null);
    
    if (!currentUser.businessId) return;
    
    // Upload immediately
    try {
      const response = await fetch(`/api/business/${currentUser.businessId}/logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: croppedImage }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCompanyLogo(data.data?.logoUrl || croppedImage);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      // Still show preview locally
      setCompanyLogo(croppedImage);
    }
  };
  
  // Handle save company info - saves to Supabase
  const handleSaveCompanyInfo = async () => {
    if (!currentUser.businessId) {
      setEditingCompany(false);
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: currentUser.businessId,
          companyName,
          website,
          industry,
          description,
        }),
      });
      
      if (response.ok) {
        const { business } = await response.json();
        setBusinessData(business);
      }
    } catch (error) {
      console.error('Error saving company info:', error);
    } finally {
      setIsSaving(false);
      setEditingCompany(false);
    }
  };
  
  // Loading state
  // Show loading while hydrating or fetching data
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Učitavanje podataka...</p>
        </div>
      </div>
    );
  }

  // Paywall za biznise koji nikad nisu platili
  // (isključeno dok je PAYMENTS_REQUIRED false - vidi src/lib/payments-config.ts)
  const hasNeverPaid = PAYMENTS_REQUIRED && !businessData?.subscription_type &&
                       (!businessData?.subscription_status || businessData?.subscription_status === 'none');

  if (hasNeverPaid) {
    return <BusinessPaywallScreen companyName={businessData?.company_name || currentUser.companyName} />;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        <h1 className="text-3xl font-light mb-2">Dashboard</h1>
        <p className="text-muted mb-6">Zdravo, {businessData?.company_name || companyName || currentUser.companyName}</p>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-border">
          <button
            onClick={() => handleTabChange('pregled')}
            className={`px-6 py-3 text-sm font-medium transition-all relative rounded-t-lg ${
              activeTab === 'pregled' 
                ? 'text-primary bg-white' 
                : 'text-muted hover:text-foreground'
            }`}
          >
            Pregled
            {activeTab === 'pregled' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('poslovi')}
            className={`px-6 py-3 text-sm font-medium transition-all relative rounded-t-lg ${
              activeTab === 'poslovi' 
                ? 'text-primary bg-white' 
                : pendingApplicationsCount > 0
                  ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-400/50'
                  : 'text-muted hover:text-foreground'
            }`}
          >
            <span className="relative">
              Tvoji poslovi
              {myJobs.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  {myJobs.length}
                </span>
              )}
              {pendingApplicationsCount > 0 && (
                <span className="absolute -top-3 -right-4 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-medium animate-pulse shadow-lg">
                  {pendingApplicationsCount}
                </span>
              )}
            </span>
            {activeTab === 'poslovi' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('poruke')}
            className={`px-6 py-3 text-sm font-medium transition-all relative rounded-t-lg ${
              activeTab === 'poruke' 
                ? 'text-primary bg-white' 
                : unreadMessagesCount > 0
                  ? 'bg-red-50 text-red-700 ring-2 ring-red-400/50'
                  : 'text-muted hover:text-foreground'
            }`}
          >
            <span className="relative">
              Poruke
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-3 -right-4 px-1.5 py-0.5 text-[10px] rounded-full bg-error text-white font-medium animate-pulse shadow-lg">
                  {unreadMessagesCount}
                </span>
              )}
            </span>
            {activeTab === 'poruke' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Global Toast */}
        {globalToast && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div className="bg-success text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in-95 fade-in duration-200 max-w-sm sm:max-w-md text-center pointer-events-auto">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm sm:text-base">{globalToast}</span>
              <button 
                onClick={() => setGlobalToast(null)}
                className="ml-2 hover:bg-white/20 rounded-full p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Portal message - prikazuje se ako Stripe portal nije dostupan */}
        {showPortalMessage && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-amber-600">⚠️</span>
            <p className="text-sm text-amber-800">
              Upravljanje pretplatom trenutno nije dostupno. Pokušajte ponovo kasnije.
            </p>
          </div>
        )}

        {/* Pregled Tab Content */}
        {activeTab === 'pregled' && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Subscription status (isključeno dok je PAYMENTS_REQUIRED false - vidi src/lib/payments-config.ts) */}
            {PAYMENTS_REQUIRED && (
            <div className={`rounded-2xl p-6 border ${
              subscription.status === 'active' 
                ? subscription.cancelAtPeriodEnd 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-white border-border'
                : 'bg-error/5 border-error/20'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium mb-1">Tvoja pretplata</h2>
                  {subscription.status === 'none' || !subscription.plan ? (
                    <p className="text-sm text-muted">Još uvek nemate aktivnu pretplatu</p>
                  ) : (
                    <p className="text-sm text-muted">
                      {subscription.plan === 'yearly' ? 'Godišnji' : 'Mesečni'} plan • {subscription.price}
                    </p>
                  )}
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm flex items-center gap-2 ${
                  subscription.effectivelyActive 
                    ? subscription.cancelAtPeriodEnd || (subscription.status === 'expired' && subscription.hasAccessUntilExpiry)
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-success/10 text-success'
                    : subscription.status === 'none' || !subscription.plan
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-error/10 text-error'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    subscription.effectivelyActive 
                      ? subscription.cancelAtPeriodEnd || (subscription.status === 'expired' && subscription.hasAccessUntilExpiry)
                        ? 'bg-amber-500' 
                        : 'bg-success'
                      : subscription.status === 'none' || !subscription.plan
                      ? 'bg-gray-400'
                      : 'bg-error'
                  }`}></span>
                  {subscription.effectivelyActive 
                    ? subscription.cancelAtPeriodEnd 
                      ? 'Otkazana' 
                      : subscription.status === 'expired' && subscription.hasAccessUntilExpiry
                        ? 'Pristup do isteka'
                        : 'Aktivna'
                    : subscription.status === 'none' || !subscription.plan
                    ? 'Neaktivna'
                    : 'Istekla'}
                </span>
              </div>
              
              {/* Show warning for users who NEVER paid (none status) */}
              {(subscription.status === 'none' || (!subscription.plan && subscription.status !== 'active')) && (
                <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Završite registraciju</p>
                      <p className="text-sm text-muted mt-1">
                        Kreirali ste nalog, ali još uvek niste aktivirali pretplatu. Pretplatom dobijate pristup svim kreatorima, njihovim kontakt informacijama i mogućnost ostavljanja recenzija.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/pricing"
                    className="mt-4 w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Aktiviraj pretplatu
                  </Link>
                </div>
              )}
              
              {/* Show info for expired but still accessible subscriptions */}
              {subscription.status === 'expired' && subscription.hasAccessUntilExpiry && subscription.plan && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Pristup do {new Date(subscription.expiresAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Vaša pretplata je otkazana, ali i dalje imate pristup do kraja plaćenog perioda.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    className="mt-4 w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Obnovi pretplatu
                  </button>
                </div>
              )}
              
              {/* Show warning for truly EXPIRED subscriptions (no access) */}
              {subscription.status === 'expired' && !subscription.hasAccessUntilExpiry && subscription.plan && (
                <div className="mt-4 p-4 bg-error/10 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-error">Pretplata je istekla</p>
                      <p className="text-sm text-error/80 mt-1">
                        Vaša pretplata je istekla. Obnovite je da biste ponovo imali pristup kreatorima i svim funkcionalnostima platforme.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    className="mt-4 w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Obnovi pretplatu
                  </button>
                </div>
              )}
              
              {/* Show cancellation notice for active but cancelled subscriptions */}
              {subscription.status === 'active' && subscription.cancelAtPeriodEnd && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Pretplata je otkazana</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Otkazali ste pretplatu. Imate pristup do{' '}
                        <strong>
                          {new Date(subscription.expiresAt).toLocaleDateString('sr-Latn-RS', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </strong>
                        . Nakon toga gubite pristup kreatorima.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    className="mt-4 w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Ponovo aktiviraj pretplatu
                  </button>
                </div>
              )}
              
              {/* Show normal info if subscription is active and NOT cancelled */}
              {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                <div className="mt-6 pt-6 border-t border-border grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted">Sledeće plaćanje</p>
                    <p className="font-medium">
                      {new Date(subscription.expiresAt).toLocaleDateString('sr-Latn-RS', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="sm:text-right flex flex-col sm:items-end gap-2">
                    <button
                      onClick={() => { setChangePlanError(null); setShowChangePlanModal(true); }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {subscription.plan === 'yearly'
                        ? 'Pređi na mesečni plan'
                        : 'Pređi na godišnji plan (uštedi 20%)'}
                    </button>
                    <button 
                      onClick={handleManageSubscription}
                      className="text-sm text-muted hover:text-foreground hover:underline"
                    >
                      Upravljaj pretplatom →
                    </button>
                  </div>
                </div>
              )}

            </div>
            )}

            {/* Toast: uspešna promena plana */}
            {changePlanSuccess && (
              <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-success text-white rounded-xl shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Plan je uspešno promenjen.</span>
              </div>
            )}

            {/* Modal: potvrda promene plana */}
            {showChangePlanModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isChangingPlan && setShowChangePlanModal(false)}>
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-medium mb-2">
                    {subscription.plan === 'yearly' ? 'Prelazak na mesečni plan' : 'Prelazak na godišnji plan'}
                  </h3>
                  <p className="text-sm text-muted mb-4">
                    {subscription.plan === 'yearly'
                      ? 'Prelaziš sa godišnjeg ($948/god) na mesečni plan ($99/mesec).'
                      : 'Prelaziš sa mesečnog ($99/mesec) na godišnji plan ($948/god) i štediš 20%.'}
                    {' '}Stripe će automatski obračunati razliku (prorata) na osnovu preostalog perioda.
                  </p>

                  {changePlanError && (
                    <div className="mb-4 p-3 bg-error/10 text-error text-sm rounded-lg">
                      {changePlanError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowChangePlanModal(false)}
                      disabled={isChangingPlan}
                      className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      Odustani
                    </button>
                    <button
                      onClick={handleChangePlan}
                      disabled={isChangingPlan}
                      className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isChangingPlan ? (
                        <>
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Menjam...
                        </>
                      ) : (
                        'Potvrdi promenu'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Company Information */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Informacije o kompaniji</h2>
                <PencilButton onClick={() => setEditingCompany(!editingCompany)} editing={editingCompany} />
              </div>
              
              {editingCompany ? (
                <div className="space-y-4">
                  {/* Logo upload */}
                  <div>
                    <label className="text-sm text-muted mb-3 block">Logo kompanije</label>
                    <div className="flex items-center gap-4">
                      <div 
                        onClick={() => logoInputRef.current?.click()}
                        className="w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors flex items-center justify-center overflow-hidden bg-secondary/30 group"
                      >
                        {companyLogo ? (
                          <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <svg className="w-6 h-6 text-muted group-hover:text-primary transition-colors mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="text-sm text-primary hover:underline font-medium"
                        >
                          {companyLogo ? 'Promeni logo' : 'Dodaj logo'}
                        </button>
                        <p className="text-xs text-muted mt-1">PNG, JPG do 5MB</p>
                        {companyLogo && (
                          <button
                            type="button"
                            onClick={() => setCompanyLogo(null)}
                            className="text-xs text-error hover:underline mt-1"
                          >
                            Ukloni logo
                          </button>
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted mb-2 block">Ime kompanije</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted mb-2 block">Website</label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://www.example.com"
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted mb-2 block">Industrija</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary bg-white"
                    >
                      <option value="">Izaberi industriju</option>
                      <option value="beauty">Beauty & Kozmetika</option>
                      <option value="fashion">Moda</option>
                      <option value="tech">Tehnologija</option>
                      <option value="food">Hrana & Piće</option>
                      <option value="fitness">Fitness & Zdravlje</option>
                      <option value="travel">Putovanja</option>
                      <option value="finance">Finansije</option>
                      <option value="other">Drugo</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted mb-2 block">O kompaniji</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary resize-none"
                      placeholder="Napiši nešto o svojoj kompaniji..."
                    />
                    <p className="text-xs text-muted mt-1 text-right">{description.length} karaktera</p>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setCompanyName(currentUser.companyName || '');
                        setWebsite(currentUser.website || '');
                        setIndustry(currentUser.industry || '');
                        setDescription(currentUser.description || '');
                        setEditingCompany(false);
                      }}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
                    >
                      Otkaži
                    </button>
                    <button
                      onClick={handleSaveCompanyInfo}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Čuvam...
                        </>
                      ) : (
                        'Sačuvaj'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Logo section - always visible */}
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div 
                      onClick={() => logoInputRef.current?.click()}
                      className={`w-16 h-16 rounded-full overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                        companyLogo 
                          ? 'bg-secondary hover:opacity-80' 
                          : 'border-2 border-dashed border-border hover:border-primary bg-secondary/30'
                      } flex items-center justify-center`}
                    >
                      {companyLogo ? (
                        <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-lg">{companyName || currentUser.companyName}</p>
                      {(industry || currentUser.industry) && (
                        <p className="text-sm text-muted capitalize">{industry || currentUser.industry}</p>
                      )}
                      {!companyLogo && (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          Dodaj logo
                        </button>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </div>
                  
                  {(website || currentUser.website) && (
                    <div>
                      <p className="text-sm text-muted">Website</p>
                      <a 
                        href={website || currentUser.website || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:underline"
                      >
                        {website || currentUser.website}
                      </a>
                    </div>
                  )}
                  
                  {(industry || currentUser.industry) && (
                    <div>
                      <p className="text-sm text-muted">Industrija</p>
                      <p className="font-medium capitalize">
                        {industry || currentUser.industry}
                      </p>
                    </div>
                  )}
                  
                  {(description || currentUser.description) && (
                    <div>
                      <p className="text-sm text-muted mb-2">O kompaniji</p>
                      <p className="text-muted leading-relaxed">{description || currentUser.description}</p>
                    </div>
                  )}
                  
                  {!description && !currentUser.description && !website && !currentUser.website && !industry && !currentUser.industry && (
                    <p className="text-muted text-sm italic">Nema dodatnih informacija o kompaniji.</p>
                  )}
                </div>
              )}
            </div>

            {/* Recent creators */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">Nedavno pregledani</h2>
                <Link href="/kreatori" className="text-sm text-muted hover:text-foreground">
                  Vidi sve →
                </Link>
              </div>
              
              {recentCreators.length > 0 ? (
                <div className="space-y-4">
                  {recentCreators.map((creator) => (
                    <Link 
                      key={creator.id} 
                      href={`/kreator/${creator.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden relative flex-shrink-0 bg-secondary">
                        {creator.photo ? (
                          <Image src={creator.photo} alt={creator.name || ''} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">
                            {creator.name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{creator.name}</h3>
                        <p className="text-sm text-muted">
                          {creator.categories?.length > 0 ? creator.categories.join(', ') : 'Kreator'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted">{creator.location || 'Srbija'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted">
                  <div className="text-3xl mb-2">👀</div>
                  <p className="text-sm">Još uvek nisi pregledao nijednog kreatora.</p>
                  <Link href="/kreatori" className="text-sm text-primary hover:underline mt-2 inline-block">
                    Pretraži kreatore →
                  </Link>
                </div>
              )}
            </div>

            {/* My Reviews Section */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-border">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg font-medium">Moje recenzije</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">{myReviews.length} recenzija</span>
                  {myReviews.length > 3 && (
                    <Link 
                      href="/dashboard/reviews"
                      scroll={true}
                      className="text-xs text-primary hover:underline hidden sm:inline"
                    >
                      Vidi sve →
                    </Link>
                  )}
                </div>
              </div>
              
              {/* Delete success message */}
              {showDeleteSuccess && (
                <div className="mb-4 bg-success/10 text-success rounded-lg p-3 text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Recenzija je uspešno obrisana.
                </div>
              )}
              
              {myReviews.length > 0 ? (
                <div className="space-y-3">
                  {/* Scrollable container with max height for many reviews */}
                  <div className={`space-y-3 ${visibleReviews > 6 ? 'max-h-[600px] overflow-y-auto pr-2 scrollbar-thin' : ''}`}>
                    {myReviews.slice(0, visibleReviews).map((review) => {
                      return (
                        <div key={review.id} className="p-3 sm:p-4 border border-border rounded-xl">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <Link 
                                href={`/kreator/${review.creator?.id}`}
                                className="font-medium text-primary hover:underline text-sm sm:text-base truncate block"
                              >
                                {review.creator?.name || 'Nepoznat kreator'}
                              </Link>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <svg
                                      key={star}
                                      viewBox="0 0 24 24"
                                      fill={star <= review.rating ? '#f59e0b' : 'none'}
                                      stroke={star <= review.rating ? '#f59e0b' : '#e5e5e5'}
                                      strokeWidth={2}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                      />
                                    </svg>
                                  ))}
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  review.status === 'approved' 
                                    ? 'bg-success/10 text-success' 
                                    : review.status === 'pending'
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-error/10 text-error'
                                }`}>
                                  {review.status === 'approved' ? 'Odobrena' : review.status === 'pending' ? 'Na čekanju' : 'Odbijena'}
                                </span>
                              </div>
                              {/* Show rejection reason hint */}
                              {review.status === 'rejected' && review.rejectionReason && (
                                <p className="text-xs text-error mt-1 line-clamp-1">
                                  Razlog: {review.rejectionReason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setViewingReview(review)}
                                className="text-muted hover:text-primary transition-colors p-1 flex-shrink-0"
                                title="Pogledaj celu recenziju"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteReview(review.id)}
                                className="text-muted hover:text-error transition-colors p-1 flex-shrink-0"
                                title="Obriši recenziju"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-muted line-clamp-2 break-words">{review.comment}</p>
                          <p className="text-xs text-muted mt-2">
                            {new Date(review.createdAt).toLocaleDateString('sr-RS', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Show more / Show all actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2 border-t border-border">
                    {hasMoreReviews && (
                      <button
                        onClick={handleShowMoreReviews}
                        className="text-sm text-muted hover:text-foreground transition-colors py-2"
                      >
                        Prikaži još ({Math.min(3, myReviews.length - visibleReviews)})
                      </button>
                    )}
                    {myReviews.length > 3 && (
                      <Link 
                        href="/dashboard/reviews"
                        scroll={true}
                        className="text-sm text-primary hover:underline py-2"
                      >
                        Vidi sve recenzije ({myReviews.length}) →
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted">
                  <div className="text-3xl mb-2">⭐</div>
                  <p className="text-sm">Još uvek nisi ostavio nijednu recenziju.</p>
                  <Link href="/kreatori" className="text-sm text-primary hover:underline mt-2 inline-block">
                    Pretraži kreatore i ostavi recenziju →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h3 className="font-medium mb-4">Brze akcije</h3>
              <div className="space-y-3">
                <Link 
                  href="/kreatori"
                  className="block w-full text-left px-4 py-3 rounded-xl bg-secondary hover:bg-accent transition-colors text-sm"
                >
                  Pretraži kreatore
                </Link>
                <Link 
                  href="/dashboard/favorites"
                  className="block w-full text-left px-4 py-3 rounded-xl bg-secondary hover:bg-accent transition-colors text-sm"
                >
                  Sačuvani kreatori
                </Link>
                <Link 
                  href="/dashboard/settings"
                  className="block w-full text-left px-4 py-3 rounded-xl bg-secondary hover:bg-accent transition-colors text-sm"
                >
                  Podešavanja naloga
                </Link>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Poslovi Tab Content */}
        {activeTab === 'poslovi' && (
          <BusinessJobsTab 
            businessId={currentUser.businessId}
            jobs={myJobs}
            setJobs={setMyJobs}
            isLoading={isLoadingJobs}
            showAddModal={showAddJobModal}
            setShowAddModal={setShowAddJobModal}
            jobsWithNewApplications={jobsWithNewApplications}
            onOpenChat={(app) => {
              // Show toast first - centered on screen for 3 seconds
              setGlobalToast(`Prihvatili ste kreatora ${app.creator?.name || 'Kreator'}! Bićete preusmereni u poruke.`);
              setTimeout(() => setGlobalToast(null), 3000);
              
              // Then switch to messages tab
              setActiveChat(app);
              handleTabChange('poruke');
              // Also refresh applications for messages tab
              setAllApplications(prev => {
                const exists = prev.find(a => a.id === app.id);
                if (!exists && (app.status === 'accepted' || app.status === 'engaged')) {
                  return [...prev, app];
                }
                return prev;
              });
            }}
          />
        )}
        
        {/* Poruke Tab Content */}
        {activeTab === 'poruke' && (
          <BusinessMessagesTab
            applications={allApplications}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            businessId={currentUser.businessId || ''}
            jobs={myJobs}
            setApplications={setAllApplications}
            onRefresh={refreshJobs}
          />
        )}

      </div>

      {/* Review Detail Modal */}
      {viewingReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Tvoja recenzija</h3>
                  <Link 
                    href={`/kreator/${viewingReview.creator?.id}`}
                    className="text-sm text-primary hover:underline"
                    onClick={() => setViewingReview(null)}
                  >
                    {viewingReview.creator?.name || 'Kreator'}
                  </Link>
                </div>
                <button
                  onClick={() => setViewingReview(null)}
                  className="p-2 hover:bg-secondary rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Rating and Status */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      viewBox="0 0 24 24"
                      fill={star <= viewingReview.rating ? '#f59e0b' : 'none'}
                      stroke={star <= viewingReview.rating ? '#f59e0b' : '#e5e5e5'}
                      strokeWidth={2}
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                  ))}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  viewingReview.status === 'approved' 
                    ? 'bg-success/10 text-success' 
                    : viewingReview.status === 'pending'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-error/10 text-error'
                }`}>
                  {viewingReview.status === 'approved' ? 'Odobrena' : viewingReview.status === 'pending' ? 'Na čekanju' : 'Odbijena'}
                </span>
              </div>

              {/* Rejection Reason */}
              {viewingReview.status === 'rejected' && viewingReview.rejectionReason && (
                <div className="bg-error/5 border border-error/20 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-error flex-shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-error mb-1">Razlog odbijanja</p>
                      <p className="text-sm text-foreground">{viewingReview.rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Comment */}
              <div className="bg-secondary/50 rounded-xl p-4 mb-4 overflow-hidden">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{viewingReview.comment}</p>
              </div>

              {/* Creator Reply */}
              {viewingReview.creatorReply && (
                <div className="border-l-4 border-primary/30 pl-4 mb-4">
                  <p className="text-sm font-medium text-primary mb-1">Odgovor kreatora</p>
                  <p className="text-sm text-muted">{viewingReview.creatorReply}</p>
                  {viewingReview.creatorReplyAt && (
                    <p className="text-xs text-muted mt-1">
                      {new Date(viewingReview.creatorReplyAt).toLocaleDateString('sr-RS', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-muted">
                Objavljeno: {new Date(viewingReview.createdAt).toLocaleDateString('sr-RS', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-border">
                <Link
                  href={`/kreator/${viewingReview.creatorId}`}
                  onClick={() => setViewingReview(null)}
                  className="flex-1 py-3 text-center border border-border rounded-xl font-medium hover:bg-secondary transition-colors text-sm"
                >
                  Pogledaj profil kreatora
                </Link>
                <button
                  onClick={() => {
                    handleDeleteReview(viewingReview.id);
                    setViewingReview(null);
                  }}
                  className="py-3 px-4 text-error border border-error/20 rounded-xl font-medium hover:bg-error/10 transition-colors text-sm"
                >
                  Obriši
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Logo Cropper Modal */}
      {showLogoCropper && logoCropImage && (
        <ImageCropper
          image={logoCropImage}
          onCropComplete={handleLogoCropComplete}
          onCancel={() => {
            setShowLogoCropper(false);
            setLogoCropImage(null);
          }}
          aspectRatio={1}
          cropShape="round"
        />
      )}

    </div>
  );
}

// ============================================
// CREATOR PENDING SCREEN
// ============================================
function CreatorPendingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-amber-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          {/* Animated pulse ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-amber-200/50 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-light mb-4 text-foreground">
          Vaš profil čeka odobrenje
        </h1>

        {/* Description */}
        <p className="text-muted text-lg mb-8 leading-relaxed">
          Hvala vam što ste se registrovali na UGC Executive! <br />
          Naš tim trenutno pregleda vaš profil i uskoro ćete dobiti obaveštenje.
        </p>

        {/* Info box */}
        <div className="bg-white rounded-2xl border border-amber-200 p-6 mb-8">
          <h3 className="font-medium text-foreground mb-3 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Šta dalje?
          </h3>
          <ul className="text-sm text-muted space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">✓</span>
              <span>Admin će pregledati vaš profil u najkraćem roku</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">✓</span>
              <span>Dobićete email obaveštenje o statusu profila</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">✓</span>
              <span>Proces odobrenja obično traje do 24 sata</span>
            </li>
          </ul>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-5 py-3 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          Na čekanju
        </div>

        {/* Home link */}
        <div className="mt-8">
          <Link href="/" className="text-muted hover:text-foreground transition-colors text-sm">
            ← Nazad na početnu
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CREATOR REJECTED SCREEN
// ============================================
function CreatorRejectedScreen({ rejectionReason }: { rejectionReason?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50/50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-32 h-32 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-red-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-light mb-4 text-foreground">
          Vaš profil nije odobren
        </h1>

        {/* Description */}
        <p className="text-muted text-lg mb-6 leading-relaxed">
          Nažalost, vaš profil nije prošao proces verifikacije.
        </p>

        {/* Rejection reason box */}
        {rejectionReason && (
          <div className="bg-white rounded-2xl border border-red-200 p-6 mb-8 text-left">
            <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Razlog odbijanja
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              {rejectionReason}
            </p>
          </div>
        )}

        {/* What to do next */}
        <div className="bg-white rounded-2xl border border-border p-6 mb-8">
          <h3 className="font-medium text-foreground mb-3">Šta možete uraditi?</h3>
          <ul className="text-sm text-muted space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              <span>Pročitajte pažljivo razlog odbijanja</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              <span>Kreirajte novi profil sa ispravnim podacima</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              <span>
                Za pitanja nas kontaktirajte na{' '}
                <a href="mailto:hello@ugcexecutive.com" className="text-primary hover:underline font-medium">
                  hello@ugcexecutive.com
                </a>
              </span>
            </li>
          </ul>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-5 py-3 bg-red-100 text-red-800 rounded-full text-sm font-medium mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Odbijeno
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link 
            href="/register/kreator" 
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Registruj se ponovo
          </Link>
          <Link 
            href="/" 
            className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-secondary transition-colors"
          >
            Nazad na početnu
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============== BUSINESS PAYWALL SCREEN ==============
function BusinessPaywallScreen({ companyName }: { companyName: string }) {
  const router = useRouter();
  const { logout } = useDemo();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleActivateSubscription = async () => {
    setIsLoading(true);
    try {
      // Redirect to pricing page with business context
      router.push('/pricing?from=dashboard');
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };
  
  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-white to-primary/5 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-light text-foreground mb-2">
            Dobrodošli, {companyName}!
          </h1>
          <p className="text-muted text-lg">
            Završite registraciju aktiviranjem pretplate
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-border p-8 mb-8 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-foreground">
              Pretplata nije aktivirana
            </h2>
          </div>
          
          <p className="text-muted mb-8 max-w-md mx-auto">
            Da biste pristupili platformi i pronašli idealne kreatore za vaš biznis, potrebno je da aktivirate pretplatu.
          </p>

          {/* Features List */}
          <div className="grid sm:grid-cols-2 gap-4 text-left mb-8">
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Pristup kreatorima</p>
                <p className="text-xs text-muted">Pregledajte profile svih kreatora</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Postavljanje poslova</p>
                <p className="text-xs text-muted">Objavite oglase za UGC projekte</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Direktna komunikacija</p>
                <p className="text-xs text-muted">Komunicirajte sa kreatorima</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Recenzije i ocene</p>
                <p className="text-xs text-muted">Ostavite povratnu informaciju</p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleActivateSubscription}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Učitavanje...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Aktiviraj pretplatu
              </>
            )}
          </button>
        </div>

        {/* Pricing preview */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <div className="bg-white rounded-xl border border-border px-6 py-4 text-center">
            <p className="text-sm text-muted mb-1">Mesečna pretplata</p>
            <p className="text-2xl font-bold text-foreground">$99<span className="text-sm font-normal text-muted">/mesec</span></p>
          </div>
          <div className="bg-primary/5 rounded-xl border border-primary/20 px-6 py-4 text-center relative">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">Ušteda 17%</span>
            <p className="text-sm text-muted mb-1">Godišnja pretplata</p>
            <p className="text-2xl font-bold text-foreground">$948<span className="text-sm font-normal text-muted">/godina</span></p>
          </div>
        </div>

        {/* Logout option */}
        <button
          onClick={handleLogout}
          className="text-muted hover:text-foreground transition-colors text-sm underline underline-offset-4"
        >
          Odjavi se
        </button>
      </div>
    </div>
  );
}

// ============================================
// BUSINESS JOBS TAB
// ============================================
interface BusinessJobsTabProps {
  businessId?: string;
  jobs: any[];
  setJobs: (jobs: any[]) => void;
  isLoading: boolean;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  onOpenChat?: (app: any) => void;
  jobsWithNewApplications?: Set<string>;
}

function BusinessJobsTab({ businessId, jobs, setJobs, isLoading, showAddModal, setShowAddModal, onOpenChat, jobsWithNewApplications = new Set() }: BusinessJobsTabProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Sub-tab state: 'active', 'in_progress', or 'archive'
  const [jobsFilter, setJobsFilter] = useState<'active' | 'in_progress' | 'archive'>('active');
  
  // Archive sub-filter: all, completed, withdrawn, closed
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'completed' | 'withdrawn' | 'closed'>('all');
  
  // Sorting state
  const [jobsSort, setJobsSort] = useState<'newest' | 'oldest'>('newest');
  
  // Application counts per job
  const [applicationCounts, setApplicationCounts] = useState<{[key: string]: number}>({});
  
  // Success message state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Applications state
  const [viewingJobApplications, setViewingJobApplications] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  
  // Invitations state (Pozivi za posao)
  const [viewingJobInvitations, setViewingJobInvitations] = useState<string | null>(null);
  const [jobInvitations, setJobInvitations] = useState<any[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [invitationCounts, setInvitationCounts] = useState<{[key: string]: number}>({});
  
  // Track engaged creators per job
  const [engagedCreators, setEngagedCreators] = useState<{[jobId: string]: {id: string, name: string, applicationId: string} | null}>({});
  
  // Track jobs where creator withdrew
  const [withdrawnJobs, setWithdrawnJobs] = useState<Set<string>>(new Set());
  
  // Reopen job confirmation
  const [reopenConfirmJob, setReopenConfirmJob] = useState<any | null>(null);
  
  // Review modal state
  const [reviewModal, setReviewModal] = useState<{jobId: string, creatorId: string, creatorName: string} | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [duplicateReviewModal, setDuplicateReviewModal] = useState<{creatorName: string, message: string} | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [submittedReviews, setSubmittedReviews] = useState<{[jobId: string]: boolean}>({});
  
  // Complete job confirmation modal
  const [completeJobModal, setCompleteJobModal] = useState<{jobId: string, jobTitle: string, creatorName: string, applicationId: string} | null>(null);
  const [isCompletingJob, setIsCompletingJob] = useState(false);
  
  // Extend deadline modal
  const [extendDeadlineModal, setExtendDeadlineModal] = useState<{jobId: string, jobTitle: string, currentDeadline: string | null} | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [isExtendingDeadline, setIsExtendingDeadline] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    platforms: [] as string[],
    budgetType: 'fixed',
    applicationDeadline: '',
    budgetMin: '',
    budgetMax: '',
    duration: '',
    experienceLevel: '',
  });
  
  // Fetch categories
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
      }
    };
    fetchCategories();
  }, []);
  
  // Fetch application counts and engaged creators for all jobs - OPTIMIZED (one API call)
  useEffect(() => {
    const fetchApplicationData = async () => {
      if (!jobs || jobs.length === 0 || !businessId) return;
      
      try {
        // Fetch ALL applications for this business in ONE call
        const response = await fetch(`/api/job-applications?businessId=${businessId}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const allApps = data.applications || [];
        
        const counts: {[key: string]: number} = {};
        const engaged: {[key: string]: {id: string, name: string, applicationId: string} | null} = {};
        
        // Initialize all jobs
        for (const job of jobs) {
          counts[job.id] = 0;
          engaged[job.id] = null;
        }
        
        // Process all applications
        const withdrawn = new Set<string>();
        
        for (const app of allApps) {
          const jobId = app.jobId;
          if (!jobId) continue;
          
          // Count pending applications for this job
          if (app.status === 'pending') {
            counts[jobId] = (counts[jobId] || 0) + 1;
          }
          
          // Find engaged creator
          if (app.status === 'engaged') {
            engaged[jobId] = {
              id: app.creatorId,
              name: app.creator?.name || 'Kreator',
              applicationId: app.id
            };
          }
          
          // Track withdrawn applications
          if (app.status === 'withdrawn') {
            withdrawn.add(jobId);
          }
        }
        
        setApplicationCounts(counts);
        setEngagedCreators(engaged);
        setWithdrawnJobs(withdrawn);
      } catch (error) {
        console.error('Error fetching application data:', error);
      }
    };
    
    fetchApplicationData();
  }, [jobs, businessId]);
  
  // Fetch invitation counts and accepted invitations for all jobs - OPTIMIZED (one API call)
  useEffect(() => {
    const fetchInvitationData = async () => {
      if (!jobs || jobs.length === 0 || !businessId) return;
      
      try {
        // Fetch ALL invitations for this business in ONE call
        const response = await fetch(`/api/job-invitations?businessId=${businessId}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const allInvitations = data.invitations || [];
        
        const counts: {[key: string]: number} = {};
        
        // Initialize all jobs
        for (const job of jobs) {
          counts[job.id] = 0;
        }
        
        // Count invitations per job AND track accepted invitations as engaged
        for (const inv of allInvitations) {
          const jobId = inv.jobId;
          if (jobId) {
            counts[jobId] = (counts[jobId] || 0) + 1;
            
            // If invitation is accepted, add to engagedCreators (if not already from applications)
            if (inv.status === 'accepted') {
              setEngagedCreators(prev => {
                if (!prev[jobId]) {
                  return {
                    ...prev,
                    [jobId]: {
                      id: inv.creatorId,
                      name: inv.creator?.name || inv.creatorName || 'Kreator',
                      applicationId: '' // Will be filled from applications
                    }
                  };
                }
                return prev;
              });
            }
          }
        }
        
        setInvitationCounts(counts);
      } catch (error) {
        console.error('Error fetching invitation counts:', error);
      }
    };
    
    fetchInvitationData();
  }, [jobs, businessId]);
  
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      platforms: [],
      budgetType: 'fixed',
      applicationDeadline: '',
      budgetMin: '',
      budgetMax: '',
      duration: '',
      experienceLevel: '',
    });
    setEditingJob(null);
  };
  
  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleEditJob = (job: any) => {
    setFormData({
      title: job.title,
      description: job.description,
      category: job.category,
      platforms: job.platforms || [],
      budgetType: job.budgetType || 'fixed',
      applicationDeadline: job.applicationDeadline || '',
      budgetMin: job.budgetMin?.toString() || '',
      budgetMax: job.budgetMax?.toString() || '',
      duration: job.duration || '',
      experienceLevel: job.experienceLevel || '',
    });
    setEditingJob(job);
    setShowAddModal(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    
    // Validate budget values (max PostgreSQL integer is ~2.1 billion)
    const MAX_BUDGET = 1000000; // Max €1,000,000
    const budgetMinNum = formData.budgetMin ? parseInt(formData.budgetMin) : 0;
    const budgetMaxNum = formData.budgetMax ? parseInt(formData.budgetMax) : 0;
    
    if (budgetMinNum > MAX_BUDGET || budgetMaxNum > MAX_BUDGET) {
      setErrorMessage(`Maksimalni budžet je €${MAX_BUDGET.toLocaleString()}`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    
    if (budgetMinNum < 0 || budgetMaxNum < 0) {
      setErrorMessage('Budžet ne može biti negativan');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    
    if (budgetMinNum > budgetMaxNum && budgetMaxNum > 0) {
      setErrorMessage('Minimalni budžet ne može biti veći od maksimalnog');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        businessId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        platforms: formData.platforms,
        budgetType: formData.budgetType,
        budgetMin: formData.budgetMin ? parseInt(formData.budgetMin) : null,
        budgetMax: formData.budgetMax ? parseInt(formData.budgetMax) : null,
        duration: formData.duration || null,
        experienceLevel: formData.experienceLevel || null,
        applicationDeadline: formData.applicationDeadline || null,
      };
      
      if (editingJob) {
        // Update existing job
        const response = await fetch('/api/jobs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: editingJob.id, ...payload }),
        });
        
        if (response.ok) {
          const { job } = await response.json();
          setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, ...payload } : j));
        }
      } else {
        // Create new job - business jobs need admin approval
        const response = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, isAdmin: false }),
        });
        
        if (response.ok) {
          const responseData = await response.json();
          const { needsApproval } = responseData;
          
          const refreshRes = await fetch(`/api/jobs?businessId=${businessId}`);
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setJobs(data.jobs || []);
          } else {
            console.error('Failed to fetch jobs:', await refreshRes.text());
          }
          
          // Show styled message that job needs approval
          if (needsApproval) {
            setSuccessMessage('Posao je uspešno kreiran i čeka odobrenje admina.');
            setTimeout(() => setSuccessMessage(null), 2000);
          }
        } else {
          const errorData = await response.json();
          console.error('Failed to create job:', errorData);
          setErrorMessage(errorData.error || 'Neuspešno kreiranje posla');
          setTimeout(() => setErrorMessage(null), 4000);
          return; // Don't close modal on error
        }
      }
      
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving job:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs?jobId=${jobId}`, { method: 'DELETE' });
      if (response.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
    setDeleteConfirmId(null);
  };
  
  const handleCloseJob = async (jobId: string) => {
    try {
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'closed' }),
      });
      if (response.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'closed' } : j));
      }
    } catch (error) {
      console.error('Error closing job:', error);
    }
  };
  
  // Open completion confirmation modal
  const handleCompleteJob = (jobId: string, jobTitle: string) => {
    const engagedCreator = engagedCreators[jobId];
    if (engagedCreator) {
      setCompleteJobModal({
        jobId,
        jobTitle,
        creatorName: engagedCreator.name,
        applicationId: engagedCreator.applicationId
      });
    }
  };
  
  // Confirm job completion
  const confirmCompleteJob = async () => {
    if (!completeJobModal) return;
    
    setIsCompletingJob(true);
    try {
      // 1. Update job status to completed
      const jobResponse = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: completeJobModal.jobId, status: 'completed' }),
      });
      
      if (jobResponse.ok) {
        // 2. Update application status to completed
        await fetch('/api/job-applications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            applicationId: completeJobModal.applicationId, 
            status: 'completed' 
          }),
        });
        
        setJobs(jobs.map(j => j.id === completeJobModal.jobId ? { ...j, status: 'completed' } : j));
        setSuccessMessage(`Posao "${completeJobModal.jobTitle}" je uspešno završen sa kreatorom ${completeJobModal.creatorName}!`);
        setTimeout(() => setSuccessMessage(null), 3000); // Auto-hide after 3 seconds
        setCompleteJobModal(null);
      }
    } catch (error) {
      console.error('Error completing job:', error);
    }
    setIsCompletingJob(false);
  };
  
  // Extend deadline
  const handleExtendDeadline = async () => {
    if (!extendDeadlineModal || !newDeadline) return;
    
    setIsExtendingDeadline(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId: extendDeadlineModal.jobId, 
          applicationDeadline: newDeadline 
        }),
      });
      
      if (response.ok) {
        // Update local state
        setJobs(jobs.map(j => 
          j.id === extendDeadlineModal.jobId 
            ? { ...j, applicationDeadline: newDeadline, isExpired: false } 
            : j
        ));
        setSuccessMessage(`Rok za prijave je produžen do ${new Date(newDeadline).toLocaleDateString('sr-RS')}!`);
        setExtendDeadlineModal(null);
        setNewDeadline('');
      }
    } catch (error) {
      console.error('Error extending deadline:', error);
    }
    setIsExtendingDeadline(false);
  };
  
  // Submit review for engaged creator
  const handleSubmitReview = async () => {
    if (!reviewModal || !businessId) return;
    
    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          creatorId: reviewModal.creatorId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      
      if (response.ok) {
        setSubmittedReviews(prev => ({ ...prev, [reviewModal.jobId]: true }));
        setSuccessMessage(`Recenzija za ${reviewModal.creatorName} je poslata na odobrenje!`);
        setTimeout(() => setSuccessMessage(null), 2000);
        setReviewModal(null);
        setReviewRating(5);
        setReviewComment('');
      } else {
        const data = await response.json();
        // Check for duplicate review (409 Conflict)
        if (response.status === 409) {
          setReviewModal(null);
          setReviewRating(5);
          setReviewComment('');
          // Show duplicate review modal
          setDuplicateReviewModal({
            creatorName: reviewModal.creatorName,
            message: 'Već ste ostavili recenziju za ovog kreatora. Kako bismo osigurali autentičnost i fer ocenjivanje, svaki biznis može ostaviti samo jednu recenziju po kreatoru.'
          });
        } else {
          alert(data.error || 'Greška pri slanju recenzije');
        }
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Greška pri slanju recenzije');
    } finally {
      setIsSubmittingReview(false);
    }
  };
  
  // Reopen a closed job
  const handleReopenJob = async (jobId: string, rejectEngagedCreator: boolean = false) => {
    try {
      // If there's an engaged creator, reject their application first
      if (rejectEngagedCreator && engagedCreators[jobId]) {
        await fetch('/api/job-applications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            applicationId: engagedCreators[jobId]!.applicationId, 
            status: 'rejected' 
          }),
        });
      }
      
      // Reopen the job
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'open' }),
      });
      
      if (response.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'open' } : j));
        // Clear engaged creator for this job
        if (rejectEngagedCreator) {
          setEngagedCreators(prev => ({ ...prev, [jobId]: null }));
        }
      }
    } catch (error) {
      console.error('Error reopening job:', error);
    }
  };
  
  // View applications for a job
  const handleViewApplications = async (jobId: string) => {
    setViewingJobApplications(jobId);
    setIsLoadingApplications(true);
    try {
      const response = await fetch(`/api/job-applications?jobId=${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJobApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoadingApplications(false);
    }
  };
  
  // View invitations for a job
  const handleViewInvitations = async (jobId: string) => {
    setViewingJobInvitations(jobId);
    setIsLoadingInvitations(true);
    try {
      const response = await fetch(`/api/job-invitations?jobId=${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJobInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoadingInvitations(false);
    }
  };
  
  // Cancel invitation
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/job-invitations?invitationId=${invitationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setJobInvitations(jobInvitations.filter(inv => inv.id !== invitationId));
        // Update count
        if (viewingJobInvitations) {
          setInvitationCounts(prev => ({
            ...prev,
            [viewingJobInvitations]: (prev[viewingJobInvitations] || 1) - 1
          }));
        }
      }
    } catch (error) {
      console.error('Error canceling invitation:', error);
    }
  };
  
  // Accept or reject application
  const handleApplicationAction = async (applicationId: string, action: 'accepted' | 'rejected') => {
    try {
      const response = await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status: action }),
      });
      
      if (response.ok) {
        // Update application status in state
        const updatedApplications = jobApplications.map(app => 
          app.id === applicationId ? { ...app, status: action } : app
        );
        setJobApplications(updatedApplications);
        
        // If accepted, show notification and open chat
        if (action === 'accepted') {
          const acceptedApp = updatedApplications.find(app => app.id === applicationId);
          if (acceptedApp) {
            setSuccessMessage(`Prihvatili ste kreatora ${acceptedApp.creator?.name || 'Kreator'}! Bićete preusmereni u poruke.`);
            
            // Navigate to Poruke tab after 3 seconds (matching toast duration)
            if (onOpenChat) {
              setTimeout(() => {
                onOpenChat(acceptedApp);
                setSuccessMessage(null);
              }, 3000);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };
  
  // Engage creator - closes job and rejects other applications
  const handleEngageCreator = async (applicationId: string, jobId: string) => {
    try {
      // Find the application to get creator info
      const engagedApp = jobApplications.find(app => app.id === applicationId);
      
      // 1. Update application status to 'engaged'
      const engageResponse = await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status: 'engaged' }),
      });
      
      if (!engageResponse.ok) {
        throw new Error('Failed to engage creator');
      }
      
      // 2. Close the job
      const closeJobResponse = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'closed' }),
      });
      
      if (!closeJobResponse.ok) {
        throw new Error('Failed to close job');
      }
      
      // 3. Reject all other pending and accepted applications for this job
      const otherApplications = jobApplications.filter(app => app.id !== applicationId && (app.status === 'pending' || app.status === 'accepted'));
      for (const app of otherApplications) {
        await fetch('/api/job-applications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: app.id, status: 'rejected' }),
        });
      }
      
      // 4. Update local state
      setJobApplications(prev => prev.map(app => {
        if (app.id === applicationId) return { ...app, status: 'engaged' };
        if (app.status === 'pending' || app.status === 'accepted') return { ...app, status: 'rejected' };
        return app;
      }));
      
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'closed' } : j));
      
      // 5. Update engagedCreators state immediately
      if (engagedApp) {
        setEngagedCreators(prev => ({
          ...prev,
          [jobId]: {
            id: engagedApp.creatorId,
            name: engagedApp.creator?.name || 'Kreator',
            applicationId: applicationId
          }
        }));
      }
      
      // Show success message
      setSuccessMessage('Kreator je angažovan! Posao je zatvoren.');
      setTimeout(() => setSuccessMessage(null), 2000);
      
    } catch (error) {
      console.error('Error engaging creator:', error);
    }
  };
  
  const handleTogglePlatform = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const formatBudget = (job: any) => {
    if (!job.budgetMin && !job.budgetMax) return 'Po dogovoru';
    if (job.budgetMin && job.budgetMax) {
      if (job.budgetMin === job.budgetMax) return `€${job.budgetMin}`;
      return `€${job.budgetMin} - €${job.budgetMax}`;
    }
    if (job.budgetMin) return `Od €${job.budgetMin}`;
    if (job.budgetMax) return `Do €${job.budgetMax}`;
    return 'Po dogovoru';
  };
  
  const getStatusBadge = (status: string, jobId?: string) => {
    // Check if job has engaged creator
    const hasEngaged = jobId && engagedCreators[jobId];
    
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Čeka odobrenje</span>;
      case 'open':
        return <span className="px-3 py-1.5 text-xs font-medium bg-success/10 text-success rounded-full">Aktivan</span>;
      case 'in_progress':
        return <span className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">U toku</span>;
      case 'completed':
        return <span className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">Završen</span>;
      case 'closed':
        if (hasEngaged) {
          return <span className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">U toku</span>;
        }
        return <span className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">Zatvoren</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted">Učitavanje poslova...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
          <div className="bg-success text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in-95 fade-in duration-200 max-w-sm sm:max-w-md text-center pointer-events-auto">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm sm:text-base">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
          <div className="bg-error text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in-95 fade-in duration-200 max-w-sm sm:max-w-md text-center pointer-events-auto">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-sm sm:text-base">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium">Moji poslovi</h2>
          <p className="text-sm text-muted">{jobs.length} poslova ukupno</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Dodaj posao
        </button>
      </div>
      
      {/* Sub-tabs: Aktivni / U toku / Završeni */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setJobsFilter('active')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap relative ${
            jobsFilter === 'active'
              ? 'bg-primary text-white'
              : 'bg-white border border-border text-muted hover:bg-secondary'
          }`}
        >
          {/* Pulsing dot when there are new applications */}
          {Array.from(jobsWithNewApplications).some(jobId => {
            const job = jobs.find(j => j.id === jobId);
            return job && (job.status === 'open' || job.status === 'pending');
          }) && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          )}
          Aktivni
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            jobsFilter === 'active' ? 'bg-white/20' : 'bg-secondary'
          }`}>
            {jobs.filter(j => j.status === 'open' || j.status === 'pending').length}
          </span>
        </button>
        <button
          onClick={() => setJobsFilter('in_progress')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            jobsFilter === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-border text-muted hover:bg-secondary'
          }`}
        >
          U toku
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            jobsFilter === 'in_progress' ? 'bg-white/20' : 'bg-secondary'
          }`}>
            {jobs.filter(j => j.status === 'closed' && engagedCreators[j.id]).length}
          </span>
        </button>
        <button
          onClick={() => setJobsFilter('archive')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            jobsFilter === 'archive'
              ? 'bg-slate-600 text-white'
              : 'bg-white border border-border text-muted hover:bg-secondary'
          }`}
        >
          Arhiva
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            jobsFilter === 'archive' ? 'bg-white/20' : 'bg-secondary'
          }`}>
            {jobs.filter(j => j.status === 'completed' || (j.status === 'closed' && !engagedCreators[j.id])).length}
          </span>
        </button>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-3">
          {/* Archive sub-filter - only show when in archive tab */}
          {jobsFilter === 'archive' && (
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value as 'all' | 'completed' | 'withdrawn' | 'closed')}
              className="px-3 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="all">Sve</option>
              <option value="withdrawn">Kreator odustao</option>
              <option value="completed">Uspešno završeni</option>
              <option value="closed">Zatvoreni</option>
            </select>
          )}

          {/* Sorting dropdown */}
          <select
            value={jobsSort}
            onChange={(e) => setJobsSort(e.target.value as 'newest' | 'oldest')}
            className="px-3 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none focus:border-primary"
          >
            <option value="newest">Najnoviji</option>
            <option value="oldest">Najstariji</option>
          </select>
        </div>
      </div>

      {/* Jobs List */}
      {(() => {
        let filteredJobs: typeof jobs = [];
        if (jobsFilter === 'active') {
          // Aktivni = open ili pending
          filteredJobs = jobs.filter(j => j.status === 'open' || j.status === 'pending');
        } else if (jobsFilter === 'in_progress') {
          // U toku = closed sa angažovanim kreatorom
          filteredJobs = jobs.filter(j => j.status === 'closed' && engagedCreators[j.id]);
        } else {
          // Arhiva = completed ili closed bez angažovanog kreatora
          let archiveJobs = jobs.filter(j => j.status === 'completed' || (j.status === 'closed' && !engagedCreators[j.id]));
          
          // Apply archive sub-filter
          if (archiveFilter === 'withdrawn') {
            filteredJobs = archiveJobs.filter(j => withdrawnJobs.has(j.id));
          } else if (archiveFilter === 'completed') {
            filteredJobs = archiveJobs.filter(j => j.status === 'completed');
          } else if (archiveFilter === 'closed') {
            filteredJobs = archiveJobs.filter(j => j.status === 'closed' && !withdrawnJobs.has(j.id));
          } else {
            filteredJobs = archiveJobs;
          }
        }
        
        // Sort based on jobsSort state, with priority for jobs with activity
        filteredJobs = filteredJobs.sort((a, b) => {
          // In active filter, jobs with new applications come FIRST
          if (jobsFilter === 'active') {
            const aHasNew = jobsWithNewApplications.has(a.id);
            const bHasNew = jobsWithNewApplications.has(b.id);
            if (aHasNew && !bHasNew) return -1;
            if (!aHasNew && bHasNew) return 1;
            // If both have or both don't have, sort by number of pending applications
            const aCount = applicationCounts[a.id] || 0;
            const bCount = applicationCounts[b.id] || 0;
            if (aCount !== bCount) return bCount - aCount;
          }
          
          // In archive, always sort by most recent change (updatedAt) first
          // This ensures withdrawn jobs and completed jobs appear at the top when they happen
          if (jobsFilter === 'archive') {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA; // Always newest first in archive
          }
          
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return jobsSort === 'newest' ? dateB - dateA : dateA - dateB;
        });
        
        return filteredJobs.length > 0 ? (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className={`bg-white rounded-2xl border p-4 sm:p-6 hover:shadow-md transition-shadow ${
              withdrawnJobs.has(job.id)
                ? 'border-orange-400 border-2 ring-2 ring-orange-100'
                : jobsWithNewApplications.has(job.id)
                ? 'border-amber-400 border-2 ring-2 ring-amber-100' 
                : 'border-border'
            }`}>
              {/* Banner for new applications */}
              {jobsWithNewApplications.has(job.id) && jobsFilter === 'active' && (applicationCounts[job.id] || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2 animate-pulse">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <span className="text-sm text-amber-700 font-medium">
                    {applicationCounts[job.id] === 1 
                      ? '1 nova prijava čeka tvoj odgovor!' 
                      : `${applicationCounts[job.id]} nove prijave čekaju tvoj odgovor!`}
                  </span>
                  <button 
                    onClick={() => setViewingJobApplications(job.id)}
                    className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                  >
                    Pogledaj →
                  </button>
                </div>
              )}
              
              {/* Warning banner for withdrawn */}
              {withdrawnJobs.has(job.id) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-orange-700 font-medium">Kreator je odustao od ovog posla</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 sm:gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                    <h3 className="font-medium text-base sm:text-lg truncate">{job.title}</h3>
                    {getStatusBadge(job.status, job.id)}
                  </div>
                  <p className="text-xs sm:text-sm text-muted">{job.businessName} • {job.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium text-sm sm:text-base">{formatBudget(job)}</div>
                  <div className="text-xs text-muted">{job.budgetType === 'hourly' ? 'po satu' : 'fiksno'}</div>
                  {/* Application Deadline - shown on mobile in header */}
                  {job.applicationDeadline && (
                    <span className={`mt-1 text-[10px] sm:hidden px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      job.isExpired 
                        ? 'bg-error/10 text-error' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {job.isExpired ? 'Istekao' : new Date(job.applicationDeadline).toLocaleDateString('sr-RS')}
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-xs sm:text-sm text-muted mb-4 line-clamp-2">{job.description}</p>
              
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                {job.platforms?.map((platform: string) => (
                  <span key={platform} className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 bg-secondary rounded-full">{platform}</span>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-border gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-[10px] sm:text-xs text-muted">Kreirano: {formatDate(job.createdAt)}</span>
                  {/* Application Deadline - hidden on mobile, shown on desktop */}
                  {job.applicationDeadline && (
                    <span className={`hidden sm:flex text-xs px-2 py-1 rounded-full items-center gap-1 ${
                      job.isExpired 
                        ? 'bg-error/10 text-error' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {job.isExpired ? 'Rok istekao' : `Rok: ${new Date(job.applicationDeadline).toLocaleDateString('sr-RS')}`}
                    </span>
                  )}
                  {/* Prijave badge - highlighted when has new applications */}
                  <button
                    onClick={() => handleViewApplications(job.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      jobsWithNewApplications.has(job.id) && (applicationCounts[job.id] || 0) > 0
                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {/* Pulsing dot for new applications */}
                    {jobsWithNewApplications.has(job.id) && (applicationCounts[job.id] || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    )}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Prijave
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      jobsWithNewApplications.has(job.id) && (applicationCounts[job.id] || 0) > 0
                        ? 'bg-white/30'
                        : 'bg-white/20'
                    }`}>
                      {applicationCounts[job.id] !== undefined ? applicationCounts[job.id] : '...'}
                    </span>
                  </button>
                  {/* Pozivi badge */}
                  {invitationCounts[job.id] > 0 && (
                    <button
                      onClick={() => handleViewInvitations(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 text-primary rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Pozivi
                      <span className="px-1.5 py-0.5 bg-primary/10 rounded text-[10px]">
                        {invitationCounts[job.id]}
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                  {/* Extend deadline button for expired jobs */}
                  {job.isExpired && job.status === 'open' && (
                    <button
                      onClick={() => {
                        setExtendDeadlineModal({ 
                          jobId: job.id, 
                          jobTitle: job.title,
                          currentDeadline: job.applicationDeadline 
                        });
                        setNewDeadline('');
                      }}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden sm:inline">Produži rok</span>
                      <span className="sm:hidden">Produži</span>
                    </button>
                  )}
                  {job.status === 'open' && (
                    <button
                      onClick={() => handleCloseJob(job.id)}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 text-muted hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
                    >
                      Zatvori
                    </button>
                  )}
                  {/* Završi posao - samo za poslove u toku (closed + engaged) */}
                  {job.status === 'closed' && engagedCreators[job.id] && (
                    <button
                      onClick={() => handleCompleteJob(job.id, job.title)}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Završi
                    </button>
                  )}
                  {(job.status === 'closed' || job.status === 'completed') && engagedCreators[job.id] && !submittedReviews[job.id] && (
                    <button
                      onClick={() => setReviewModal({
                        jobId: job.id,
                        creatorId: engagedCreators[job.id]!.id,
                        creatorName: engagedCreators[job.id]!.name
                      })}
                      className="text-xs px-3 py-1.5 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      Oceni
                    </button>
                  )}
                  {(job.status === 'closed' || job.status === 'completed') && engagedCreators[job.id] && submittedReviews[job.id] && (
                    <span className="text-xs px-3 py-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ocenjeno
                    </span>
                  )}
                  {(job.status === 'closed' || job.status === 'completed') && (
                    <button
                      onClick={() => {
                        // Check if has engaged creator
                        if (engagedCreators[job.id]) {
                          setReopenConfirmJob(job);
                        } else {
                          handleReopenJob(job.id);
                        }
                      }}
                      className="text-xs px-3 py-1.5 text-success hover:bg-success/10 border border-success/20 rounded-lg transition-colors"
                    >
                      Otvori
                    </button>
                  )}
                  {job.status !== 'closed' && job.status !== 'completed' && (
                    <button
                      onClick={() => handleEditJob(job)}
                      className="text-xs px-3 py-1.5 text-primary hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
                    >
                      Uredi
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(job.id)}
                    className="text-xs px-3 py-1.5 text-error hover:bg-error/10 border border-error/20 rounded-lg transition-colors"
                  >
                    Obriši
                  </button>
                </div>
              </div>
              
              {/* Delete confirmation */}
              {deleteConfirmId === job.id && (
                <div className="mt-4 p-4 bg-error/5 border border-error/20 rounded-xl">
                  <p className="text-sm text-foreground mb-3">Da li si siguran da želiš da obrišeš ovaj posao?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 transition-colors"
                    >
                      Da, obriši
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors"
                    >
                      Otkaži
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <div className="text-5xl mb-4">
            {jobsFilter === 'active' ? '📋' : jobsFilter === 'in_progress' ? '🔄' : '✅'}
          </div>
          <h3 className="text-lg font-medium mb-2">
            {jobsFilter === 'active' 
              ? 'Nemate aktivnih poslova' 
              : jobsFilter === 'in_progress'
                ? 'Nemate poslova u toku'
                : 'Nemate završenih poslova'}
          </h3>
          <p className="text-sm text-muted mb-4">
            {jobsFilter === 'active' 
              ? 'Kreirajte novi posao i pronađite savršenog kreatora' 
              : jobsFilter === 'in_progress'
                ? 'Kada angažujete kreatora, posao će se pojaviti ovde'
                : 'Ovde će se pojaviti poslovi koje označite kao završene'}
          </p>
          {jobsFilter === 'active' && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Dodaj posao
            </button>
          )}
        </div>
      );
      })()}

      {/* Add/Edit Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium">
                    {editingJob ? 'Uredi posao' : 'Dodaj novi posao'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="p-2 hover:bg-secondary rounded-xl transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Naziv posla *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="npr. UGC video za lansiranje novog proizvoda"
                    className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Opis posla *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Opišite detaljno šta tražite od kreatora..."
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary resize-none text-sm"
                  />
                </div>
                
                {/* Category & Platforms in one row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Kategorija *</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm appearance-none"
                    >
                      <option value="">Izaberi kategoriju</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Platforme</label>
                    <div className="flex gap-2 h-12 items-center">
                      {['Instagram', 'TikTok', 'YouTube'].map(platform => (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => handleTogglePlatform(platform)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
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
                </div>
                
                {/* Budget */}
                <div>
                  <label className="block text-sm font-medium mb-2">Budžet</label>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={formData.budgetType}
                      onChange={(e) => setFormData(prev => ({ ...prev, budgetType: e.target.value }))}
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm appearance-none"
                    >
                      <option value="fixed">Fiksno</option>
                      <option value="hourly">Po satu</option>
                    </select>
                    <input
                      type="number"
                      value={formData.budgetMin}
                      onChange={(e) => setFormData(prev => ({ ...prev, budgetMin: e.target.value }))}
                      placeholder="Min (€)"
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                    <input
                      type="number"
                      value={formData.budgetMax}
                      onChange={(e) => setFormData(prev => ({ ...prev, budgetMax: e.target.value }))}
                      placeholder="Max (€)"
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>
                
                {/* Duration & Experience */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Trajanje</label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm appearance-none"
                    >
                      <option value="">Izaberi trajanje</option>
                      <option value="Manje od nedelju dana">Manje od nedelju dana</option>
                      <option value="1-2 nedelje">1-2 nedelje</option>
                      <option value="2-4 nedelje">2-4 nedelje</option>
                      <option value="1-3 meseca">1-3 meseca</option>
                      <option value="3+ meseca">3+ meseca</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nivo iskustva</label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
                      className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm appearance-none"
                    >
                      <option value="">Bilo koji nivo</option>
                      <option value="beginner">Početnik</option>
                      <option value="intermediate">Srednji nivo</option>
                      <option value="expert">Ekspert</option>
                    </select>
                  </div>
                </div>
                
                {/* Application Deadline */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rok za prijave <span className="text-muted font-normal">(opciono)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.applicationDeadline}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicationDeadline: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 px-4 border border-border rounded-xl focus:outline-none focus:border-primary bg-white text-sm"
                  />
                  <p className="text-xs text-muted mt-1.5">
                    Nakon ovog datuma prijave će biti zatvorene. Ostavite prazno ako nema roka.
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-6 border-t border-border flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-6 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Čuvam...
                    </>
                  ) : (
                    editingJob ? 'Sačuvaj izmene' : 'Objavi posao'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applications Modal */}
      {viewingJobApplications && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-medium">Prijave za posao</h2>
                  <p className="text-sm text-muted mt-1">
                    {jobs.find(j => j.id === viewingJobApplications)?.title || 'Posao'}
                  </p>
                </div>
                <button
                  onClick={() => { setViewingJobApplications(null); setJobApplications([]); }}
                  className="p-2 hover:bg-secondary rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {isLoadingApplications ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted">Učitavanje prijava...</p>
                </div>
              ) : jobApplications.length > 0 ? (
                <div className="space-y-4">
                  {jobApplications.map((app) => (
                    <div key={app.id} className="border border-border rounded-xl p-4">
                      {/* Creator info */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-secondary flex-shrink-0 overflow-hidden relative">
                          {app.creator?.photo ? (
                            <Image src={app.creator.photo} alt={app.creator.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-medium">
                              {app.creator?.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link 
                              href={`/kreator/${app.creatorId}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {app.creator?.name || 'Kreator'}
                            </Link>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              app.status === 'accepted' ? 'bg-success/10 text-success' :
                              app.status === 'engaged' ? 'bg-primary/10 text-primary' :
                              app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              app.status === 'withdrawn' ? 'bg-orange-100 text-orange-700' :
                              'bg-error/10 text-error'
                            }`}>
                              {app.status === 'pending' ? 'Na čekanju' : 
                               app.status === 'accepted' ? 'Prihvaćeno' : 
                               app.status === 'engaged' ? 'Angažovan' :
                               app.status === 'completed' ? 'Završeno' :
                               app.status === 'withdrawn' ? '⚠️ Kreator odustao' : 'Odbijeno'}
                            </span>
                          </div>
                          <p className="text-sm text-muted">
                            {app.creator?.categories?.slice(0, 2).join(', ') || 'Kreator'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-medium text-primary">€{app.proposedPrice}</div>
                          <div className="text-xs text-muted">Ponuda</div>
                        </div>
                      </div>
                      
                      {/* Cover letter */}
                      <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-foreground">{app.coverLetter}</p>
                      </div>
                      
                      {/* Meta info */}
                      <div className="flex items-center justify-between text-xs text-muted mb-4">
                        <span>Prijavljeno: {formatDate(app.createdAt)}</span>
                        {app.estimatedDuration && (
                          <span>Procena: {app.estimatedDuration}</span>
                        )}
                      </div>
                      
                      {/* Actions */}
                      {app.status === 'pending' && (
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <button
                            onClick={() => handleApplicationAction(app.id, 'accepted')}
                            className="flex-1 py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Prihvati
                          </button>
                          <button
                            onClick={() => handleApplicationAction(app.id, 'rejected')}
                            className="flex-1 py-2.5 border border-error/30 text-error rounded-lg text-sm font-medium hover:bg-error/10 transition-colors"
                          >
                            Odbij
                          </button>
                        </div>
                      )}
                      
                      {app.status === 'accepted' && (
                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          <span className="text-xs text-success flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Prihvaćeno
                          </span>
                          <button
                            onClick={() => onOpenChat && onOpenChat(app)}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Poruke
                          </button>
                        </div>
                      )}
                      
                      {app.status === 'engaged' && (
                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Angažovan
                          </span>
                          <button
                            onClick={() => onOpenChat && onOpenChat(app)}
                            className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Poruke
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📭</div>
                  <h3 className="font-medium mb-2">Nema prijava</h3>
                  <p className="text-sm text-muted">Još uvek niko nije aplicirao za ovaj posao</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Invitations Modal */}
      {viewingJobInvitations && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-medium">Poslati pozivi</h2>
                  <p className="text-sm text-muted mt-1">
                    {jobs.find(j => j.id === viewingJobInvitations)?.title || 'Posao'}
                  </p>
                </div>
                <button
                  onClick={() => { setViewingJobInvitations(null); setJobInvitations([]); }}
                  className="p-2 hover:bg-secondary rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {isLoadingInvitations ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted">Učitavanje poziva...</p>
                </div>
              ) : jobInvitations.length > 0 ? (
                <div className="space-y-4">
                  {jobInvitations.map((inv) => (
                    <div key={inv.id} className="border border-border rounded-xl p-4">
                      {/* Creator info */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-secondary flex-shrink-0 overflow-hidden relative">
                          {inv.creator?.photo ? (
                            <Image src={inv.creator.photo} alt={inv.creator.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-medium">
                              {inv.creator?.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link 
                              href={`/kreator/${inv.creatorId}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {inv.creatorName || 'Kreator'}
                            </Link>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              inv.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              inv.status === 'accepted' && withdrawnJobs.has(inv.jobId) ? 'bg-orange-100 text-orange-700' :
                              inv.status === 'accepted' ? 'bg-success/10 text-success' :
                              inv.status === 'rejected' ? 'bg-error/10 text-error' :
                              'bg-error/10 text-error'
                            }`}>
                              {inv.status === 'pending' ? 'Na čekanju' : 
                               inv.status === 'accepted' && withdrawnJobs.has(inv.jobId) ? 'Odustao' :
                               inv.status === 'accepted' ? 'Prihvaćeno' : 
                               inv.status === 'rejected' ? 'Odbijeno' : 'Odbijeno'}
                            </span>
                          </div>
                          <p className="text-sm text-muted">
                            {inv.creator?.location || ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 text-xs text-muted">
                          Poslato: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' }) : ''}
                        </div>
                      </div>
                      
                      {/* Message */}
                      {inv.message && (
                        <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                          <p className="text-sm text-foreground">{inv.message}</p>
                        </div>
                      )}
                      
                      {/* Actions */}
                      {inv.status === 'pending' && (
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <Link
                            href={`/kreator/${inv.creatorId}`}
                            className="flex-1 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors text-center"
                          >
                            Vidi profil
                          </Link>
                          <button
                            onClick={() => handleCancelInvitation(inv.id)}
                            className="flex-1 py-2.5 border border-error/30 text-error rounded-lg text-sm font-medium hover:bg-error/10 transition-colors"
                          >
                            Povuci poziv
                          </button>
                        </div>
                      )}
                      
                      {inv.status === 'accepted' && (
                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          {withdrawnJobs.has(inv.jobId) ? (
                            <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Kreator je odustao od posla
                            </span>
                          ) : (
                            <span className="text-xs text-success font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Kreator je prihvatio poziv
                            </span>
                          )}
                          <div className="flex gap-2">
                            <Link
                              href={`/kreator/${inv.creatorId}`}
                              className="px-3 py-1.5 border border-border text-foreground rounded-lg text-xs font-medium hover:bg-secondary transition-colors"
                            >
                              Profil
                            </Link>
                            {!withdrawnJobs.has(inv.jobId) && (
                              <button
                                onClick={async () => {
                                  // Find the engaged application for this invitation
                                  try {
                                    const response = await fetch(`/api/job-applications?jobId=${inv.jobId}&creatorId=${inv.creator_id}`);
                                    if (response.ok) {
                                      const data = await response.json();
                                      const app = (data.applications || []).find((a: any) => a.status === 'engaged');
                                      if (app) {
                                        setViewingJobInvitations(null);
                                        setJobInvitations([]);
                                        if (onOpenChat) onOpenChat(app);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error finding application:', error);
                                  }
                                }}
                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Poruke
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {inv.status === 'rejected' && (
                        <div className="pt-3 border-t border-border">
                          <span className="text-xs text-error flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Kreator je odbio poziv
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📬</div>
                  <h3 className="font-medium mb-2">Nema poslatih poziva</h3>
                  <p className="text-sm text-muted">Možete pozvati kreatore sa njihovog profila</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Reopen Job Confirmation Modal */}
      {reopenConfirmJob && engagedCreators[reopenConfirmJob.id] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              {/* Warning icon */}
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Pažnja!</h3>
              <p className="text-center text-muted mb-4">
                Ako ponovo otvorite ovu poziciju, kreator <strong className="text-foreground">{engagedCreators[reopenConfirmJob.id]?.name}</strong> više neće biti angažovan na ovom projektu.
              </p>
              <p className="text-center text-sm text-muted mb-6">
                Kreator će dobiti obaveštenje da je njegov angažman otkazan.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setReopenConfirmJob(null)}
                  className="flex-1 px-4 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={() => {
                    handleReopenJob(reopenConfirmJob.id, true);
                    setReopenConfirmJob(null);
                  }}
                  className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium"
                >
                  Da, otvori
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              {/* Star icon */}
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Oceni kreatora</h3>
              <p className="text-center text-muted mb-6">
                Kako ocenjuješ saradnju sa <strong className="text-foreground">{reviewModal.creatorName}</strong>?
              </p>
              
              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <svg 
                      className={`w-10 h-10 ${star <= reviewRating ? 'text-amber-400' : 'text-slate-200'}`}
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              
              {/* Comment */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Komentar (opciono)</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Opiši svoje iskustvo sa kreatorom..."
                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={4}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setReviewModal(null);
                    setReviewRating(5);
                    setReviewComment('');
                  }}
                  className="flex-1 px-4 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingReview ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Šaljem...
                    </>
                  ) : (
                    'Pošalji ocenu'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Duplicate Review Modal */}
      {duplicateReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-medium mb-2">Već ste ocenili {duplicateReviewModal.creatorName}</h3>
              
              <p className="text-muted mb-6">
                {duplicateReviewModal.message}
              </p>
              
              <button
                onClick={() => setDuplicateReviewModal(null)}
                className="w-full px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
              >
                Razumem
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Complete Job Confirmation Modal */}
      {completeJobModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              {/* Success icon */}
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Potvrdi završetak posla</h3>
              <p className="text-center text-muted mb-6">
                Da li potvrđujete da je kreator <strong className="text-foreground">{completeJobModal.creatorName}</strong> uspešno završio posao <strong className="text-foreground">"{completeJobModal.jobTitle}"</strong>?
              </p>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-700">
                    Nakon potvrde, posao će biti označen kao završen i kreator će dobiti badge "Uspešno završeno" na svom profilu.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setCompleteJobModal(null)}
                  disabled={isCompletingJob}
                  className="flex-1 px-4 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={confirmCompleteJob}
                  disabled={isCompletingJob}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCompletingJob ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Završavam...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Da, potvrđujem
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Extend Deadline Modal */}
      {extendDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              {/* Calendar icon */}
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Produži rok za prijave</h3>
              <p className="text-center text-muted mb-6">
                Posao: <strong className="text-foreground">"{extendDeadlineModal.jobTitle}"</strong>
              </p>
              
              {extendDeadlineModal.currentDeadline && (
                <div className="bg-error/10 border border-error/20 rounded-xl p-3 mb-4 text-center">
                  <p className="text-sm text-error">
                    Prethodni rok je istekao: {new Date(extendDeadlineModal.currentDeadline).toLocaleDateString('sr-RS')}
                  </p>
                </div>
              )}
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Novi rok za prijave</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary bg-white"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setExtendDeadlineModal(null);
                    setNewDeadline('');
                  }}
                  disabled={isExtendingDeadline}
                  className="flex-1 px-4 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={handleExtendDeadline}
                  disabled={isExtendingDeadline || !newDeadline}
                  className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isExtendingDeadline ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Čuvam...
                    </>
                  ) : (
                    'Produži rok'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// ============================================
// BUSINESS MESSAGES TAB
// ============================================
interface BusinessMessagesTabProps {
  applications: any[];
  activeChat: any | null;
  setActiveChat: (app: any | null) => void;
  businessId: string;
  jobs: any[];
  onEngageCreator?: (applicationId: string, jobId: string) => void;
  setApplications?: (apps: any[]) => void;
  onRefresh: () => void;
}

function BusinessMessagesTab({ applications, activeChat, setActiveChat, businessId, jobs, onEngageCreator, setApplications, onRefresh }: BusinessMessagesTabProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEngaging, setIsEngaging] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [engageSuccess, setEngageSuccess] = useState(false);
  const [rejectSuccess, setRejectSuccess] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Archive functionality
  const [messageTab, setMessageTab] = useState<'active' | 'archived'>('active');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Load archived IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`archived_chats_business_${businessId}`);
    if (saved) {
      try {
        setArchivedIds(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing archived chats:', e);
      }
    }
  }, [businessId]);
  
  // Save archived IDs to localStorage
  const saveArchivedIds = (ids: string[]) => {
    setArchivedIds(ids);
    localStorage.setItem(`archived_chats_business_${businessId}`, JSON.stringify(ids));
  };
  
  // Toggle archive status
  const toggleArchive = (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (archivedIds.includes(appId)) {
      saveArchivedIds(archivedIds.filter(id => id !== appId));
    } else {
      saveArchivedIds([...archivedIds, appId]);
      // If currently viewing this chat, close it
      if (activeChat?.id === appId) {
        setActiveChat(null);
      }
    }
  };
  
  // Fetch unread counts for all applications
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      if (!businessId || applications.length === 0) return;
      
      const counts: Record<string, number> = {};
      await Promise.all(
        applications.map(async (app) => {
          try {
            const res = await fetch(`/api/job-messages?applicationId=${app.id}&countUnread=true&recipientType=business&recipientId=${businessId}`);
            if (res.ok) {
              const data = await res.json();
              counts[app.id] = data.unreadCount || 0;
            }
          } catch (e) {
            console.error('Error fetching unread count:', e);
          }
        })
      );
      setUnreadCounts(counts);
    };
    
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [applications, businessId]);
  
  // Filter applications by archive status
  const activeApplications = applications.filter(app => !archivedIds.includes(app.id));
  const archivedApplications = applications.filter(app => archivedIds.includes(app.id));
  const displayedApplications = messageTab === 'active' ? activeApplications : archivedApplications;

  // Scroll to bottom - only within messages container
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };
  
  // Handle engage creator
  const handleEngage = async () => {
    if (!activeChat || isEngaging) return;
    
    setIsEngaging(true);
    try {
      // 1. Update application status to 'engaged'
      await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: activeChat.id, status: 'engaged' }),
      });
      
      // 2. Close the job
      await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeChat.jobId, status: 'closed' }),
      });
      
      // 3. Reject all other pending/accepted applications for this job
      const otherApps = applications.filter(app => app.id !== activeChat.id && app.jobId === activeChat.jobId && (app.status === 'pending' || app.status === 'accepted'));
      for (const app of otherApps) {
        await fetch('/api/job-applications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: app.id, status: 'rejected' }),
        });
      }

      // 4. Update local state
      if (setApplications) {
        setApplications(applications.map(app => {
          if (app.id === activeChat.id) return { ...app, status: 'engaged' };
          if (app.jobId === activeChat.jobId && (app.status === 'pending' || app.status === 'accepted')) return { ...app, status: 'rejected' };
          return app;
        }));
      }
      setActiveChat({ ...activeChat, status: 'engaged' });
      setEngageSuccess(true);
      setTimeout(() => setEngageSuccess(false), 3000);
      
    } catch (error) {
      console.error('Error engaging creator:', error);
    } finally {
      setIsEngaging(false);
    }
  };
  
  // Handle reject creator - check if engaged first
  const handleRejectClick = () => {
    if (!activeChat) return;
    
    // If this is an engaged creator, show confirmation modal
    if (activeChat.status === 'engaged') {
      setShowRejectConfirm(true);
    } else {
      // Regular rejection for accepted creators
      handleReject(false);
    }
  };
  
  // Handle actual rejection
  const handleReject = async (reopenJob: boolean) => {
    if (!activeChat || isRejecting) return;
    
    setIsRejecting(true);
    try {
      // Update application status to 'rejected'
      await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: activeChat.id, status: 'rejected' }),
      });
      
      // If this was an engaged creator, update job status
      if (activeChat.status === 'engaged') {
        const newStatus = reopenJob ? 'open' : 'closed';
        await fetch('/api/jobs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: activeChat.jobId, status: newStatus }),
        });
      }
      
      // Update local state - remove from active conversations
      if (setApplications) {
        setApplications(applications.filter(app => app.id !== activeChat.id));
      }
      
      setShowRejectConfirm(false);
      setRejectSuccess(true);
      setTimeout(() => {
        setRejectSuccess(false);
        setActiveChat(null); // Go back to conversation list
        // Refresh jobs
        onRefresh();
      }, 1500);
      
    } catch (error) {
      console.error('Error rejecting creator:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  // Track if this is first load for this chat
  const isFirstLoadRef = useRef(true);
  
  // Reset first load when chat changes
  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [activeChat?.id]);
  
  // Fetch messages on load + Realtime subscription for new messages
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      if (isFirstLoadRef.current) setIsLoading(true);

      try {
        const response = await fetch(`/api/job-messages?applicationId=${activeChat.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);

          if (isFirstLoadRef.current && businessId) {
            fetch('/api/job-messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                applicationId: activeChat.id,
                recipientType: 'business',
                recipientId: businessId,
              }),
            }).then(res => {
              if (res.ok) {
                window.dispatchEvent(new Event('notificationsCleared'));
              }
            }).catch(err => console.error('Error marking messages as read:', err));
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        if (isFirstLoadRef.current) {
          setIsLoading(false);
          isFirstLoadRef.current = false;
        }
      }
    };

    fetchMessages();

    let channel: any = null;
    (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      channel = supabase
        .channel(`biz-inline-msgs-${activeChat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'job_messages',
          filter: `application_id=eq.${activeChat.id}`,
        }, (payload: any) => {
          const row = payload.new;
          const newMsg = {
            id: row.id,
            applicationId: row.application_id,
            senderType: row.sender_type,
            senderId: row.sender_id,
            message: row.message,
            createdAt: row.created_at,
            isRead: row.is_read,
          };
          setMessages(prev => {
            if (prev.some((m: any) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (businessId && row.sender_type !== 'business') {
            fetch('/api/job-messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                applicationId: activeChat.id,
                recipientType: 'business',
                recipientId: businessId,
              }),
            }).catch(() => {});
          }
        })
        .subscribe();
    })();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [activeChat?.id, businessId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/job-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: activeChat.id,
          senderType: 'business',
          senderId: businessId,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
  };

  // Get job title for an application
  const getJobTitle = (app: any) => {
    const job = jobs.find(j => j.id === app.jobId);
    return job?.title || app.job?.title || 'Posao';
  };

  if (applications.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-border">
        <div className="text-5xl mb-4">💬</div>
        <h3 className="text-lg font-medium mb-2">Nemate aktivnih razgovora</h3>
        <p className="text-muted">Razgovori će se pojaviti kada prihvatite prijavu kreatora</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex h-[600px] lg:h-[650px]">
        {/* Conversations list */}
        <div className={`${activeChat ? 'hidden lg:block' : 'w-full'} lg:w-80 border-r border-border flex-shrink-0 flex flex-col`}>
          {/* Header with tabs */}
          <div className="p-3 border-b border-border">
            <h3 className="font-medium mb-2">Razgovori</h3>
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
              <button
                onClick={() => setMessageTab('active')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  messageTab === 'active' 
                    ? 'bg-white shadow-sm text-foreground' 
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Aktivni
                {activeApplications.length > 0 && (
                  <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {activeApplications.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMessageTab('archived')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  messageTab === 'archived' 
                    ? 'bg-white shadow-sm text-foreground' 
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Arhivirani
                {archivedApplications.length > 0 && (
                  <span className="ml-1 text-[10px] bg-muted/20 text-muted px-1.5 py-0.5 rounded-full">
                    {archivedApplications.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Conversations list */}
          <div className="overflow-y-auto flex-1">
            {displayedApplications.length === 0 ? (
              <div className="p-4 text-center text-muted text-sm">
                {messageTab === 'active' ? 'Nema aktivnih razgovora' : 'Nema arhiviranih razgovora'}
              </div>
            ) : (
              displayedApplications.map((app) => (
                <div
                  key={app.id}
                  className={`relative group border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer ${
                    activeChat?.id === app.id ? 'bg-secondary' : ''
                  }`}
                  onClick={() => {
                    setActiveChat(app);
                    setUnreadCounts(prev => ({ ...prev, [app.id]: 0 }));
                  }}
                >
                  <div className="w-full p-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {app.creator?.photo ? (
                            <Image src={app.creator.photo} alt="" width={40} height={40} className="object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-muted">
                              {app.creator?.name?.charAt(0) || 'K'}
                            </span>
                          )}
                        </div>
                        {/* Unread badge */}
                        {(unreadCounts[app.id] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                            {unreadCounts[app.id]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium text-sm truncate ${(unreadCounts[app.id] || 0) > 0 ? 'font-semibold' : ''}`}>
                            {app.creator?.name || 'Kreator'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            app.status === 'engaged' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                          }`}>
                            {app.status === 'engaged' ? 'Angažovan' : 'Aktivan'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted truncate flex-1">{getJobTitle(app)}</p>
                          {/* Archive button */}
                          <button
                            onClick={(e) => toggleArchive(app.id, e)}
                            className="ml-2 p-1 rounded hover:bg-secondary/80 transition-all opacity-60 hover:opacity-100"
                            title={archivedIds.includes(app.id) ? 'Vrati iz arhive' : 'Arhiviraj'}
                          >
                            <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${activeChat ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveChat(null);
                  }}
                  className="lg:hidden p-1.5 hover:bg-secondary rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {activeChat.creator?.photo ? (
                    <Image src={activeChat.creator.photo} alt="" width={40} height={40} className="object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-muted">
                      {activeChat.creator?.name?.charAt(0) || 'K'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{activeChat.creator?.name || 'Kreator'}</h4>
                  <p className="text-xs text-muted">{getJobTitle(activeChat)}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">
                    <p>Započnite razgovor!</p>
                    <p className="text-xs mt-1">Dogovorite detalje projekta sa kreatorom.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderType === 'business';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMe 
                            ? 'bg-primary text-white rounded-br-md' 
                            : 'bg-white text-foreground rounded-bl-md shadow-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/70' : 'text-muted'}`}>
                            <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                            {isMe && (
                              <span 
                                className={`text-[10px] ${msg.readAt ? 'text-blue-400' : ''}`} 
                                title={msg.readAt ? 'Pročitano' : 'Poslato'}
                              >
                                {msg.readAt ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action buttons - only for accepted applications */}
              {activeChat.status === 'accepted' && !rejectSuccess && (
                <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Da li želite saradnju?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEngage}
                      disabled={isEngaging || isRejecting}
                      className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:bg-success/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {isEngaging ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Angažuj
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRejectClick}
                      disabled={isRejecting || isEngaging}
                      className="px-3 py-1.5 text-error border border-error/30 rounded-lg text-xs font-medium hover:bg-error/5 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {isRejecting ? (
                        <div className="w-3 h-3 border-2 border-error border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Odbij
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Success messages */}
              {engageSuccess && (
                <div className="px-4 py-1.5 bg-success/10 text-success text-xs text-center">
                  ✓ Kreator je angažovan!
                </div>
              )}
              
              {rejectSuccess && (
                <div className="px-4 py-1.5 bg-error/10 text-error text-xs text-center">
                  ✓ Kreator je odbijen
                </div>
              )}
              
              {/* Engaged status with withdraw option */}
              {activeChat.status === 'engaged' && !engageSuccess && !rejectSuccess && (
                <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Angažovali ste ovog kreatora
                  </div>
                  <button
                    onClick={handleRejectClick}
                    disabled={isRejecting}
                    className="px-3 py-1.5 text-error border border-error/30 rounded-lg text-xs font-medium hover:bg-error/5 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {isRejecting ? (
                      <div className="w-3 h-3 border-2 border-error border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Odustani
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-border bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napišite poruku..."
                    className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-4xl mb-4">💬</div>
                <p className="text-muted">Izaberite razgovor sa leve strane</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal za potvrdu odbijanja angažovanog kreatora */}
      {showRejectConfirm && activeChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Odbiti angažovanog kreatora?</h3>
              <p className="text-muted text-sm">
                Kreator <span className="font-medium">{activeChat.creatorName}</span> je već angažovan za ovaj posao.
                Da li želite da posao ponovo bude aktivan ili da ga zatvorite?
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleReject(true)}
                disabled={isRejecting}
                className="w-full px-4 py-3 bg-success text-white rounded-xl hover:bg-success/90 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {isRejecting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Ponovo otvori posao
                  </>
                )}
              </button>
              <button
                onClick={() => handleReject(false)}
                disabled={isRejecting}
                className="w-full px-4 py-3 border border-border text-foreground rounded-xl hover:bg-secondary transition-colors font-medium"
              >
                Zatvori posao
              </button>
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="w-full px-4 py-3 text-muted hover:text-foreground transition-colors text-sm"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// CREATOR APPLICATIONS TAB
// ============================================
interface CreatorApplicationsTabProps {
  applications: any[];
  setApplications: (apps: any[]) => void;
  isLoading: boolean;
  creatorId: string;
  onOpenChat: (app: any) => void;
  filterMode?: 'prijave' | 'angazovan' | 'zavrseno' | 'odbijeno';
}

function CreatorApplicationsTab({ applications, setApplications, isLoading, creatorId, onOpenChat, filterMode }: CreatorApplicationsTabProps) {
  // Only show status filter if not in filterMode (old behavior)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'engaged' | 'completed' | 'withdrawn'>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [cancelEngagementId, setCancelEngagementId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const handleWithdraw = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/job-applications?applicationId=${applicationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setApplications(applications.filter(a => a.id !== applicationId));
      }
    } catch (error) {
      console.error('Error withdrawing application:', error);
    }
    setWithdrawingId(null);
  };
  
  // Cancel engagement (for engaged status)
  const handleCancelEngagement = async (applicationId: string, jobId: string) => {
    setIsCancelling(true);
    try {
      // Update application status to withdrawn
      const response = await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status: 'withdrawn' }),
      });
      
      if (response.ok) {
        // Reopen the job so business can find new creator
        await fetch('/api/jobs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, status: 'open' }),
        });
        
        // Update local state
        setApplications(applications.map(a => 
          a.id === applicationId ? { ...a, status: 'withdrawn' } : a
        ));
      }
    } catch (error) {
      console.error('Error cancelling engagement:', error);
    }
    setIsCancelling(false);
    setCancelEngagementId(null);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">Na čekanju</span>;
      case 'accepted':
        return <span className="px-3 py-1 text-xs bg-success/10 text-success rounded-full">Prihvaćeno</span>;
      case 'engaged':
        return <span className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-full font-medium">Angažovan</span>;
      case 'completed':
        return <span className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Uspešno završeno
        </span>;
      case 'rejected':
        return <span className="px-3 py-1 text-xs bg-error/10 text-error rounded-full">Odbijeno</span>;
      case 'withdrawn':
        return <span className="px-3 py-1 text-xs bg-muted/20 text-muted rounded-full">Povučeno</span>;
      case 'cancelled':
        return <span className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Posao obrisan
        </span>;
      default:
        return null;
    }
  };
  
  // When filterMode is set, just use all passed applications (already filtered)
  // When not in filterMode (old behavior), use statusFilter
  const filteredApplications = filterMode 
    ? applications 
    : applications.filter(app => {
        if (statusFilter === 'all') return true;
        return app.status === statusFilter;
      });
  
  // Stats - only needed when not in filterMode
  const stats = !filterMode ? {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    engaged: applications.filter(a => a.status === 'engaged').length,
    completed: applications.filter(a => a.status === 'completed').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    withdrawn: applications.filter(a => a.status === 'withdrawn').length,
    cancelled: applications.filter(a => a.status === 'cancelled').length,
  } : null;

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted">Učitavanje prijava...</p>
      </div>
    );
  }

  // Get title based on filterMode
  const getTitle = () => {
    switch (filterMode) {
      case 'prijave': return 'Poslovi na koje si aplicirao';
      case 'angazovan': return 'Trenutno si angažovan';
      case 'zavrseno': return 'Uspešno završeni poslovi';
      case 'odbijeno': return 'Odbijene prijave';
      default: return 'Moje prijave';
    }
  };

  return (
    <div>
      {/* Stats - only show when not in filterMode */}
      {!filterMode && stats && (
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium">{stats.total}</div>
            <div className="text-xs text-muted">Ukupno</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-amber-600">{stats.pending}</div>
            <div className="text-xs text-muted">Čeka</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-success">{stats.accepted}</div>
            <div className="text-xs text-muted">Prihvaćeno</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-primary">{stats.engaged}</div>
            <div className="text-xs text-muted">Angažovan</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-200 text-center min-w-[70px] bg-emerald-50">
            <div className="text-lg font-medium text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-emerald-600">Završeno</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-error">{stats.rejected}</div>
            <div className="text-xs text-muted">Odbijeno</div>
          </div>
          {stats.cancelled > 0 && (
            <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 text-center min-w-[70px]">
              <div className="text-lg font-medium text-slate-500">{stats.cancelled}</div>
              <div className="text-xs text-slate-500">Otkazano</div>
            </div>
          )}
        </div>
      )}

      {/* Filter - only show when not in filterMode */}
      {!filterMode && stats ? (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Moje prijave</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-primary text-sm bg-white"
          >
            <option value="all">Sve prijave ({stats.total})</option>
            <option value="pending">Na čekanju ({stats.pending})</option>
            <option value="accepted">Prihvaćeno ({stats.accepted})</option>
            <option value="engaged">Angažovan ({stats.engaged})</option>
            <option value="completed">Uspešno završeno ({stats.completed})</option>
            <option value="rejected">Odbijeno ({stats.rejected})</option>
            {stats.withdrawn > 0 && <option value="withdrawn">Odustao ({stats.withdrawn})</option>}
            {stats.cancelled > 0 && <option value="cancelled">Posao obrisan ({stats.cancelled})</option>}
          </select>
        </div>
      ) : filterMode && (
        <h2 className="text-lg font-medium mb-4">{getTitle()}</h2>
      )}

      {/* Applications List */}
      {filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <Link 
                      href={`/poslovi/${app.jobId}`}
                      className="font-medium hover:text-primary transition-colors truncate"
                    >
                      {app.job?.title || 'Posao'}
                    </Link>
                    {getStatusBadge(app.status)}
                  </div>
                  <p className="text-sm text-muted">{app.job?.businessName || 'Biznis'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium">€{app.proposedPrice}</div>
                  <div className="text-xs text-muted">Vaša ponuda</div>
                </div>
              </div>
              
              <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                <p className="text-sm text-muted line-clamp-2">{app.coverLetter}</p>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>Prijavljeno: {formatDate(app.createdAt)}</span>
                  {app.estimatedDuration && (
                    <span>• Procena: {app.estimatedDuration}</span>
                  )}
                </div>
                
                {app.status === 'pending' && (
                  <button
                    onClick={() => setWithdrawingId(app.id)}
                    className="text-xs text-error hover:underline"
                  >
                    Povuci prijavu
                  </button>
                )}
              </div>
              
              {/* Accepted - show chat link */}
              {app.status === 'accepted' && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-success flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Prihvaćeno
                  </span>
                  <button
                    onClick={() => onOpenChat(app)}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Poruke
                  </button>
                </div>
              )}
              
              {/* Engaged - show chat link and cancel option */}
              {app.status === 'engaged' && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Angažovan
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCancelEngagementId(app.id)}
                        className="text-xs text-error hover:underline"
                      >
                        Odustani
                      </button>
                      <button
                        onClick={() => onOpenChat(app)}
                        className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Poruke
                      </button>
                    </div>
                  </div>
                  
                  {/* Cancel engagement confirmation */}
                  {cancelEngagementId === app.id && (
                    <div className="mt-4 p-4 bg-error/5 border border-error/20 rounded-xl">
                      <p className="text-sm text-foreground mb-2 font-medium">Odustajanje od angažmana</p>
                      <p className="text-sm text-muted mb-3">
                        Da li ste sigurni da želite da odustanete od ovog posla? 
                        Biznis će biti obavešten i moći će da pronađe drugog kreatora.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancelEngagement(app.id, app.jobId)}
                          disabled={isCancelling}
                          className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isCancelling ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Obrađujem...
                            </>
                          ) : (
                            'Da, odustani'
                          )}
                        </button>
                        <button
                          onClick={() => setCancelEngagementId(null)}
                          className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors"
                        >
                          Otkaži
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Withdraw confirmation */}
              {withdrawingId === app.id && (
                <div className="mt-4 p-4 bg-error/5 border border-error/20 rounded-xl">
                  <p className="text-sm text-foreground mb-3">Da li ste sigurni da želite da povučete prijavu?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleWithdraw(app.id)}
                      className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 transition-colors"
                    >
                      Da, povuci
                    </button>
                    <button
                      onClick={() => setWithdrawingId(null)}
                      className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-secondary transition-colors"
                    >
                      Otkaži
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <div className="text-5xl mb-4">
            {filterMode === 'prijave' ? '📝' : 
             filterMode === 'angazovan' ? '🎯' :
             filterMode === 'zavrseno' ? '✅' :
             filterMode === 'odbijeno' ? '❌' : '💼'}
          </div>
          <h3 className="text-lg font-medium mb-2">
            {filterMode === 'prijave' ? 'Nemaš aktivnih prijava' : 
             filterMode === 'angazovan' ? 'Nisi trenutno angažovan' :
             filterMode === 'zavrseno' ? 'Nemaš završenih poslova' :
             filterMode === 'odbijeno' ? 'Nemaš odbijenih prijava' :
             statusFilter === 'all' ? 'Nemate prijava' : 'Nema prijava sa ovim filterom'}
          </h3>
          <p className="text-muted mb-6">
            {filterMode === 'prijave' ? 'Pregledaj otvorene poslove i prijavi se' : 
             filterMode === 'angazovan' ? 'Kada biznis te angažuje, posao će se pojaviti ovde' :
             filterMode === 'zavrseno' ? 'Kada završiš posao, pojaviće se ovde' :
             filterMode === 'odbijeno' ? 'Sve tvoje prijave su još uvek aktivne 🎉' :
             statusFilter === 'all' 
              ? 'Pregledajte otvorene poslove i prijavite se'
              : 'Pokušajte sa drugim filterom'}
          </p>
          {(filterMode === 'prijave' || (!filterMode && statusFilter === 'all')) && (
            <Link
              href="/poslovi"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              Pregledaj poslove
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// CREATOR INVITATIONS TAB (PONUDE)
// ============================================
interface CreatorInvitationsTabProps {
  invitations: any[];
  setInvitations: (inv: any[]) => void;
  applications: any[];
  setApplications: (apps: any[]) => void;
  isLoading: boolean;
  creatorId: string;
  onOpenChat: (app: any) => void;
  hideStats?: boolean; // Hide stats when used in combined Poslovi tab
}

function CreatorInvitationsTab({ invitations, setInvitations, applications, setApplications, isLoading, creatorId, onOpenChat, hideStats }: CreatorInvitationsTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const handleRespond = async (invitationId: string, status: 'accepted' | 'rejected') => {
    setRespondingId(invitationId);
    const invitation = invitations.find(inv => inv.id === invitationId);
    
    try {
      const response = await fetch('/api/job-invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, status }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setInvitations(invitations.map(inv => 
          inv.id === invitationId 
            ? { ...inv, status, responded_at: new Date().toISOString() }
            : inv
        ));
        setShowDetailsModal(false);
        setSelectedInvitation(null);
        
        // If accepted, show toast, refresh applications and open chat
        if (status === 'accepted' && invitation) {
          // Show toast notification - centered on screen for 3 seconds
          setToastMessage(`Prihvatili ste ponudu za "${invitation.jobTitle || 'posao'}"! Bićete preusmereni u poruke.`);
          setTimeout(() => setToastMessage(null), 3000);
          
          // Refresh applications list
          const appsResponse = await fetch(`/api/job-applications?creatorId=${creatorId}`);
          if (appsResponse.ok) {
            const appsData = await appsResponse.json();
            setApplications(appsData.applications || []);
            
            // Find the newly created application and open chat
            const newApp = (appsData.applications || []).find(
              (a: any) => a.jobId === invitation.jobId && a.status === 'engaged'
            );
            if (newApp) {
              onOpenChat(newApp);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
    }
    setRespondingId(null);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const getStatusBadge = (status: string, jobId?: string) => {
    // Check if there's a completed application for this job
    const completedApp = jobId && applications.find(app => app.jobId === jobId && app.status === 'completed');
    
    if (completedApp) {
      return <span className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Uspešno završeno
      </span>;
    }
    
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">Na čekanju</span>;
      case 'accepted':
        return <span className="px-3 py-1 text-xs bg-success/10 text-success rounded-full">Prihvaćeno</span>;
      case 'rejected':
        return <span className="px-3 py-1 text-xs bg-error/10 text-error rounded-full">Odbijeno</span>;
      case 'cancelled':
        return <span className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Posao obrisan
        </span>;
      default:
        return null;
    }
  };
  
  const filteredInvitations = invitations.filter(inv => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });
  
  // Stats
  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    rejected: invitations.filter(i => i.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted">Učitavanje ponuda...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
          <div className="bg-success text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in zoom-in-95 fade-in duration-200 max-w-sm sm:max-w-md text-center pointer-events-auto">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm sm:text-base">{toastMessage}</span>
          </div>
        </div>
      )}
      
      {/* Stats - only show when not hideStats */}
      {!hideStats && (
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium">{stats.total}</div>
            <div className="text-xs text-muted">Ukupno</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-amber-600">{stats.pending}</div>
            <div className="text-xs text-muted">Čeka</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-success">{stats.accepted}</div>
            <div className="text-xs text-muted">Prihvaćeno</div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-border text-center min-w-[70px]">
            <div className="text-lg font-medium text-error">{stats.rejected}</div>
            <div className="text-xs text-muted">Odbijeno</div>
          </div>
        </div>
      )}

      {/* Filter - only show when not hideStats */}
      {!hideStats && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Ponude za posao</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-primary text-sm bg-white"
          >
            <option value="all">Sve ponude ({stats.total})</option>
            <option value="pending">Na čekanju ({stats.pending})</option>
            <option value="accepted">Prihvaćeno ({stats.accepted})</option>
            <option value="rejected">Odbijeno ({stats.rejected})</option>
          </select>
        </div>
      )}
      
      {/* Title when hideStats - simple header */}
      {hideStats && (
        <h2 className="text-lg font-medium mb-4">Pozivi koje si dobio</h2>
      )}

      {/* Invitations List */}
      {filteredInvitations.length > 0 ? (
        <div className="space-y-4">
          {filteredInvitations.map((inv) => (
            <div key={inv.id} className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <Link 
                      href={`/poslovi/${inv.jobId}`}
                      className="font-medium hover:text-primary transition-colors truncate"
                    >
                      {inv.jobTitle || 'Posao'}
                    </Link>
                    {getStatusBadge(inv.status, inv.jobId)}
                  </div>
                  <p className="text-sm text-muted">{inv.businessName || 'Biznis'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {inv.job?.budgetMin && inv.job?.budgetMax ? (
                    <>
                      <div className="font-medium">€{inv.job.budgetMin} - €{inv.job.budgetMax}</div>
                      <div className="text-xs text-muted">Budžet</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted">Po dogovoru</div>
                  )}
                </div>
              </div>
              
              {inv.message && (
                <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                  <p className="text-sm text-muted line-clamp-2">{inv.message}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>Primljeno: {formatDate(inv.createdAt)}</span>
                  {inv.job?.category && (
                    <span>• {inv.job.category}</span>
                  )}
                </div>
                
                {inv.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedInvitation(inv);
                        setShowDetailsModal(true);
                      }}
                      className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      Detalji
                    </button>
                    <button
                      onClick={() => handleRespond(inv.id, 'rejected')}
                      disabled={respondingId === inv.id}
                      className="px-4 py-2 text-sm font-medium text-error hover:bg-error/5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Odbij
                    </button>
                    <button
                      onClick={() => handleRespond(inv.id, 'accepted')}
                      disabled={respondingId === inv.id}
                      className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {respondingId === inv.id ? 'Čuvam...' : 'Prihvati'}
                    </button>
                  </div>
                )}
                
                {inv.status === 'accepted' && (
                  <button
                    onClick={async () => {
                      // Find the engaged application for this job
                      const appsResponse = await fetch(`/api/job-applications?creatorId=${creatorId}`);
                      if (appsResponse.ok) {
                        const appsData = await appsResponse.json();
                        const app = (appsData.applications || []).find(
                          (a: any) => a.jobId === inv.jobId && a.status === 'engaged'
                        );
                        if (app) {
                          onOpenChat(app);
                        }
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Poruke
                  </button>
                )}
                
                {inv.status === 'rejected' && (
                  <Link
                    href={`/poslovi/${inv.jobId}`}
                    className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  >
                    Vidi posao →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <div className="text-5xl mb-4">📬</div>
          <h3 className="text-lg font-medium mb-2">Nemate ponuda</h3>
          <p className="text-muted text-sm mb-6 max-w-md mx-auto">
            Ovde ćete videti kada brendovi pošalju pozive za posao direktno vama.
          </p>
          <Link
            href="/poslovi"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Pregledaj dostupne poslove
          </Link>
        </div>
      )}
      
      {/* Details Modal */}
      {showDetailsModal && selectedInvitation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Detalji ponude</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedInvitation(null);
                }}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Job Info */}
              <div className="mb-6">
                <h4 className="text-xl font-medium mb-2">{selectedInvitation.jobTitle}</h4>
                <p className="text-muted">{selectedInvitation.businessName}</p>
              </div>
              
              {/* Job Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="text-sm text-muted mb-1">Kategorija</div>
                  <div className="font-medium">{selectedInvitation.job?.category || 'N/A'}</div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="text-sm text-muted mb-1">Budžet</div>
                  <div className="font-medium">
                    {selectedInvitation.job?.budgetMin && selectedInvitation.job?.budgetMax
                      ? `€${selectedInvitation.job.budgetMin} - €${selectedInvitation.job.budgetMax}`
                      : 'Po dogovoru'}
                  </div>
                </div>
              </div>
              
              {/* Job Description */}
              {selectedInvitation.job?.description && (
                <div className="mb-6">
                  <h5 className="text-sm font-medium mb-2">Opis posla</h5>
                  <p className="text-sm text-muted whitespace-pre-wrap">
                    {selectedInvitation.job.description}
                  </p>
                </div>
              )}
              
              {/* Invitation Message */}
              {selectedInvitation.message && (
                <div className="mb-6 bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <h5 className="text-sm font-medium mb-2 text-primary">Poruka od brenda</h5>
                  <p className="text-sm">{selectedInvitation.message}</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => handleRespond(selectedInvitation.id, 'rejected')}
                disabled={respondingId === selectedInvitation.id}
                className="flex-1 px-4 py-3 border border-error text-error rounded-xl font-medium hover:bg-error/5 transition-colors disabled:opacity-50"
              >
                Odbij ponudu
              </button>
              <button
                onClick={() => handleRespond(selectedInvitation.id, 'accepted')}
                disabled={respondingId === selectedInvitation.id}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {respondingId === selectedInvitation.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Čuvam...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Prihvati ponudu
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// CREATOR MESSAGES TAB
// ============================================
interface CreatorMessagesTabProps {
  applications: any[];
  activeChat: any | null;
  setActiveChat: (app: any | null) => void;
  creatorId: string;
}

function CreatorMessagesTab({ applications, activeChat, setActiveChat, creatorId }: CreatorMessagesTabProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Archive functionality
  const [messageTab, setMessageTab] = useState<'active' | 'archived'>('active');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Load archived IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`archived_chats_creator_${creatorId}`);
    if (saved) {
      try {
        setArchivedIds(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing archived chats:', e);
      }
    }
  }, [creatorId]);
  
  // Save archived IDs to localStorage
  const saveArchivedIds = (ids: string[]) => {
    setArchivedIds(ids);
    localStorage.setItem(`archived_chats_creator_${creatorId}`, JSON.stringify(ids));
  };
  
  // Toggle archive status
  const toggleArchive = (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (archivedIds.includes(appId)) {
      saveArchivedIds(archivedIds.filter(id => id !== appId));
    } else {
      saveArchivedIds([...archivedIds, appId]);
      if (activeChat?.id === appId) {
        setActiveChat(null);
      }
    }
  };
  
  // Fetch unread counts for all applications
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      if (!creatorId || applications.length === 0) return;
      
      const counts: Record<string, number> = {};
      await Promise.all(
        applications.map(async (app) => {
          try {
            const res = await fetch(`/api/job-messages?applicationId=${app.id}&countUnread=true&recipientType=creator&recipientId=${creatorId}`);
            if (res.ok) {
              const data = await res.json();
              counts[app.id] = data.unreadCount || 0;
            }
          } catch (e) {
            console.error('Error fetching unread count:', e);
          }
        })
      );
      setUnreadCounts(counts);
    };
    
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [applications, creatorId]);
  
  // Filter applications by archive status
  const activeApplications = applications.filter(app => !archivedIds.includes(app.id));
  const archivedApplications = applications.filter(app => archivedIds.includes(app.id));
  const displayedApplications = messageTab === 'active' ? activeApplications : archivedApplications;

  // Scroll to bottom - only within messages container
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Track if this is first load for this chat
  const isFirstLoadRef = useRef(true);
  
  // Reset first load when chat changes
  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [activeChat?.id]);
  
  // Fetch messages on load + Realtime subscription for new messages
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      if (isFirstLoadRef.current) setIsLoading(true);

      try {
        const response = await fetch(`/api/job-messages?applicationId=${activeChat.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);

          if (isFirstLoadRef.current && creatorId) {
            fetch('/api/job-messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                applicationId: activeChat.id,
                recipientType: 'creator',
                recipientId: creatorId,
              }),
            }).then(res => {
              if (res.ok) {
                window.dispatchEvent(new Event('notificationsCleared'));
              }
            }).catch(err => console.error('Error marking messages as read:', err));
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        if (isFirstLoadRef.current) {
          setIsLoading(false);
          isFirstLoadRef.current = false;
        }
      }
    };

    fetchMessages();

    let channel: any = null;
    (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      channel = supabase
        .channel(`creator-inline-msgs-${activeChat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'job_messages',
          filter: `application_id=eq.${activeChat.id}`,
        }, (payload: any) => {
          const row = payload.new;
          const newMsg = {
            id: row.id,
            applicationId: row.application_id,
            senderType: row.sender_type,
            senderId: row.sender_id,
            message: row.message,
            createdAt: row.created_at,
            isRead: row.is_read,
          };
          setMessages(prev => {
            if (prev.some((m: any) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (creatorId && row.sender_type !== 'creator') {
            fetch('/api/job-messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                applicationId: activeChat.id,
                recipientType: 'creator',
                recipientId: creatorId,
              }),
            }).catch(() => {});
          }
        })
        .subscribe();
    })();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [activeChat?.id, creatorId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/job-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: activeChat.id,
          senderType: 'creator',
          senderId: creatorId,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      } else {
        const errorData = await response.json();
        console.error('Error sending message:', errorData);
        alert(`Greška: ${errorData.error || 'Nije moguće poslati poruku'}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Greška pri slanju poruke');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Danas';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Juče';
    return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' });
  };

  // Handle withdraw from engagement - show modal first
  const handleWithdrawClick = () => {
    setShowWithdrawModal(true);
  };
  
  // Confirm withdraw
  const handleWithdrawConfirm = async () => {
    if (!activeChat || isWithdrawing) return;
    
    setShowWithdrawModal(false);
    setIsWithdrawing(true);
    try {
      const response = await fetch('/api/job-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: activeChat.id,
          status: 'withdrawn',
        }),
      });
      
      if (response.ok) {
        setWithdrawSuccess(true);
        // Update local state
        if (activeChat) {
          activeChat.status = 'withdrawn';
        }
        setTimeout(() => {
          setWithdrawSuccess(false);
          setActiveChat(null);
        }, 2000);
      } else {
        const error = await response.json();
        alert(`Greška: ${error.message || 'Nije moguće odustati'}`);
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Greška pri odustajanju');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // No conversations
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-border">
        <div className="text-5xl mb-4">💬</div>
        <h3 className="text-lg font-medium mb-2">Nemate aktivnih razgovora</h3>
        <p className="text-muted">Razgovori će se pojaviti kada biznis prihvati vašu prijavu</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex h-[600px] lg:h-[650px]">
        {/* Conversations list - left side */}
        <div className={`${activeChat ? 'hidden lg:block' : 'w-full'} lg:w-80 border-r border-border flex-shrink-0 flex flex-col`}>
          {/* Header with tabs */}
          <div className="p-3 border-b border-border">
            <h3 className="font-medium mb-2">Razgovori</h3>
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
              <button
                onClick={() => setMessageTab('active')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  messageTab === 'active' 
                    ? 'bg-white shadow-sm text-foreground' 
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Aktivni
                {activeApplications.length > 0 && (
                  <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {activeApplications.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMessageTab('archived')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  messageTab === 'archived' 
                    ? 'bg-white shadow-sm text-foreground' 
                    : 'text-muted hover:text-foreground'
                }`}
              >
                Arhivirani
                {archivedApplications.length > 0 && (
                  <span className="ml-1 text-[10px] bg-muted/20 text-muted px-1.5 py-0.5 rounded-full">
                    {archivedApplications.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Conversations list */}
          <div className="overflow-y-auto flex-1">
            {displayedApplications.length === 0 ? (
              <div className="p-4 text-center text-muted text-sm">
                {messageTab === 'active' ? 'Nema aktivnih razgovora' : 'Nema arhiviranih razgovora'}
              </div>
            ) : (
              displayedApplications.map((app) => (
                <div
                  key={app.id}
                  className={`relative group border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer ${
                    activeChat?.id === app.id ? 'bg-secondary' : ''
                  }`}
                  onClick={() => {
                    setActiveChat(app);
                    setUnreadCounts(prev => ({ ...prev, [app.id]: 0 }));
                  }}
                >
                  <div className="w-full p-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {app.job?.businessName?.charAt(0) || 'B'}
                          </span>
                        </div>
                        {/* Unread badge */}
                        {(unreadCounts[app.id] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                            {unreadCounts[app.id]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium text-sm truncate ${(unreadCounts[app.id] || 0) > 0 ? 'font-semibold' : ''}`}>
                            {app.job?.businessName || 'Biznis'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            app.status === 'engaged' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                          }`}>
                            {app.status === 'engaged' ? 'Angažovan' : 'Aktivan'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted truncate flex-1">{app.job?.title || 'Posao'}</p>
                          {/* Archive button */}
                          <button
                            onClick={(e) => toggleArchive(app.id, e)}
                            className="ml-2 p-1 rounded hover:bg-secondary/80 transition-all opacity-60 hover:opacity-100"
                            title={archivedIds.includes(app.id) ? 'Vrati iz arhive' : 'Arhiviraj'}
                          >
                            <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area - right side */}
        <div className={`${activeChat ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {activeChat ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveChat(null);
                  }}
                  className="lg:hidden p-1.5 hover:bg-secondary rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {activeChat.job?.businessName?.charAt(0) || 'B'}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{activeChat.job?.businessName || 'Biznis'}</h4>
                  <p className="text-xs text-muted">{activeChat.job?.title || 'Posao'}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">
                    <p>Započnite razgovor!</p>
                    <p className="text-xs mt-1">Dogovorite detalje projekta.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderType === 'creator';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMe 
                            ? 'bg-primary text-white rounded-br-md' 
                            : 'bg-white text-foreground rounded-bl-md shadow-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/70' : 'text-muted'}`}>
                            <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                            {isMe && (
                              <span 
                                className={`text-[10px] ${msg.readAt ? 'text-blue-400' : ''}`} 
                                title={msg.readAt ? 'Pročitano' : 'Poslato'}
                              >
                                {msg.readAt ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Withdraw success message */}
              {withdrawSuccess && (
                <div className="px-4 py-1.5 bg-warning/10 text-warning text-xs text-center">
                  ✓ Uspešno ste odustali od posla
                </div>
              )}
              
              {/* Engaged status with withdraw option */}
              {activeChat.status === 'engaged' && !withdrawSuccess && (
                <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Angažovani ste za ovaj posao
                  </div>
                  <button
                    onClick={handleWithdrawClick}
                    disabled={isWithdrawing}
                    className="px-3 py-1.5 text-error border border-error/30 rounded-lg text-xs font-medium hover:bg-error/5 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {isWithdrawing ? (
                      <div className="w-3 h-3 border-2 border-error border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Odustani
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Withdraw Confirmation Modal */}
              {showWithdrawModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Odustajanje od posla</h3>
                      <p className="text-muted text-sm">
                        Da li ste sigurni da želite da odustanete od ovog posla? Ova akcija se ne može poništiti.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowWithdrawModal(false)}
                        className="flex-1 px-4 py-3 border border-border rounded-xl font-medium hover:bg-secondary transition-colors"
                      >
                        Otkaži
                      </button>
                      <button
                        onClick={handleWithdrawConfirm}
                        className="flex-1 px-4 py-3 bg-error text-white rounded-xl font-medium hover:bg-error/90 transition-colors"
                      >
                        Da, odustajem
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-border bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napišite poruku..."
                    className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-4xl mb-4">💬</div>
                <p className="text-muted">Izaberite razgovor sa leve strane</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


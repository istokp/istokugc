'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDemo } from '@/context/DemoContext';
import Link from 'next/link';
import Image from 'next/image';
import { Creator, CreatorStatus, Review } from '@/lib/mockData';
import ReviewCard from '@/components/ReviewCard';
import StarRating from '@/components/StarRating';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import { getPortfolioVideoType, isPortfolioVideo, normalizeExternalUrl, opensExternally } from '@/lib/portfolio-media';

type AdminTab = 'pending' | 'creators' | 'businesses' | 'categories' | 'reviews' | 'poslovi';

export default function AdminPage() {
  const { 
    currentUser, 
    updateCreator, 
    deleteCreator, 
    isHydrated,
  } = useDemo();
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  
  // State for fetched creators from Supabase
  const [fetchedCreators, setFetchedCreators] = useState<any[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  
  // State for fetched businesses from Supabase
  const [fetchedBusinesses, setFetchedBusinesses] = useState<any[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);
  
  // State for jobs
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  
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
      }
    }
  }, []);

  // Fetch creators from Supabase
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const response = await fetch('/api/admin/creators');
        if (response.ok) {
          const data = await response.json();
          setFetchedCreators(data.creators || []);
        }
      } catch (error) {
        console.error('Error fetching creators:', error);
      } finally {
        setIsLoadingCreators(false);
      }
    };
    
    fetchCreators();
  }, []);
  
  // Fetch all jobs on mount (for badge count) and when tab is active
  useEffect(() => {
    const fetchJobs = async () => {
      // Only show loading spinner when actually on the jobs tab
      if (activeTab === 'poslovi') {
        setIsLoadingJobs(true);
      }
      try {
        const response = await fetch('/api/jobs?includeAll=true');
        if (response.ok) {
          const data = await response.json();
          setAllJobs(data.jobs || []);
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    
    fetchJobs();
  }, []); // Fetch on mount only
  
  // Fetch businesses from Supabase
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const response = await fetch('/api/admin/businesses');
        if (response.ok) {
          const data = await response.json();
          setFetchedBusinesses(data.businesses || []);
        }
      } catch (error) {
        console.error('Error fetching businesses:', error);
      } finally {
        setIsLoadingBusinesses(false);
      }
    };
    
    fetchBusinesses();
  }, []);
  
  // Refresh businesses after changes
  const refreshBusinesses = async () => {
    try {
      const response = await fetch('/api/admin/businesses');
      if (response.ok) {
        const data = await response.json();
        setFetchedBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    }
  };
  
  // Kreatori koji čekaju odobrenje
  const pendingCreatorsList = useMemo(() => {
    return fetchedCreators.filter(c => c.status === 'pending');
  }, [fetchedCreators]);
  
  // Odobreni/aktivni kreatori
  const approvedCreators = useMemo(() => {
    return fetchedCreators.filter(c => c.status === 'approved');
  }, [fetchedCreators]);
  
  // Deaktivirani kreatori
  const deactivatedCreators = useMemo(() => {
    return fetchedCreators.filter(c => c.status === 'deactivated');
  }, [fetchedCreators]);
  
  // Odbijeni kreatori
  const rejectedCreators = useMemo(() => {
    return fetchedCreators.filter(c => c.status === 'rejected');
  }, [fetchedCreators]);
  
  // State za biznise - sada se koristi fetchedBusinesses
  
  // State za kategorije - sada se koristi fetchedCategories
  const [fetchedCategories, setFetchedCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  
  // Fetch categories from Supabase
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories');
        if (response.ok) {
          const data = await response.json();
          setFetchedCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    
    fetchCategories();
  }, []);
  
  // Refresh categories after changes
  const refreshCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setFetchedCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error refreshing categories:', error);
    }
  };
  
  // State za editovanje
  const [editingCreator, setEditingCreator] = useState<any | null>(null);
  
  // State za pregled kreatora (detalji)
  const [viewingCreator, setViewingCreator] = useState<any | null>(null);
  // Da li se modal otvara iz pending liste (prikaži Odobri/Odbij) ili iz kreatori liste (prikaži samo status)
  const [viewingFromPending, setViewingFromPending] = useState(false);
  
  // State za pregled portfolio stavke (slike) / video player
  const [viewingPortfolioItem, setViewingPortfolioItem] = useState<any | null>(null);
  const [viewingPortfolioVideo, setViewingPortfolioVideo] = useState<any | null>(null);

  // ESC key handler za portfolio image preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingPortfolioItem) {
        setViewingPortfolioItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPortfolioItem]);
  
  // State za odbijanje kreatora (sa razlogom)
  const [rejectingCreator, setRejectingCreator] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Pretraga
  const [searchCreators, setSearchCreators] = useState('');
  const [searchBusinesses, setSearchBusinesses] = useState('');
  
  // State za recenzije - sada iz Supabase
  const [fetchedReviews, setFetchedReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedReviewCreator, setSelectedReviewCreator] = useState<string>('all');
  const [rejectingReview, setRejectingReview] = useState<any | null>(null);
  const [reviewRejectionReason, setReviewRejectionReason] = useState('');
  
  // Fetch reviews from Supabase
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch('/api/reviews');
        if (response.ok) {
          const data = await response.json();
          setFetchedReviews(data.reviews || []);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setIsLoadingReviews(false);
      }
    };
    
    fetchReviews();
  }, []);
  
  // Refresh reviews after changes
  const refreshReviews = async () => {
    try {
      const response = await fetch('/api/reviews');
      if (response.ok) {
        const data = await response.json();
        setFetchedReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error refreshing reviews:', error);
    }
  };
  
  // Approve review - using dedicated admin endpoint
  const [isApprovingReview, setIsApprovingReview] = useState<string | null>(null);
  
  const handleApproveReview = async (reviewId: string) => {
    setIsApprovingReview(reviewId);
    try {
      const response = await fetch(`/api/reviews/${reviewId}/approve`, {
        method: 'POST',
      });
      if (response.ok) {
        await refreshReviews();
      } else {
        const errorText = await response.text();
        console.error('Failed to approve review:', errorText);
        alert('Greška pri odobravanju recenzije: ' + errorText);
      }
    } catch (error) {
      console.error('Error approving review:', error);
      alert('Greška pri odobravanju recenzije');
    } finally {
      setIsApprovingReview(null);
    }
  };
  
  // Reject review - using dedicated admin endpoint
  const [isRejectingReview, setIsRejectingReview] = useState<string | null>(null);
  
  const handleRejectReview = async (reviewId: string, reason?: string) => {
    setIsRejectingReview(reviewId);
    try {
      const response = await fetch(`/api/reviews/${reviewId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) {
        await refreshReviews();
      } else {
        const errorText = await response.text();
        console.error('Failed to reject review:', errorText);
        alert('Greška pri odbijanju recenzije: ' + errorText);
      }
    } catch (error) {
      console.error('Error rejecting review:', error);
      alert('Greška pri odbijanju recenzije');
    } finally {
      setIsRejectingReview(null);
    }
  };
  
  // Delete review - using admin supabase client directly via API
  const handleDeleteReview = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await refreshReviews();
      } else {
        console.error('Failed to delete review:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };
  
  // State za brisanje kategorije
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  
  // State za brisanje kreatora
  const [deletingCreator, setDeletingCreator] = useState<any | null>(null);
  
  // State za brisanje biznisa
  const [deletingBusiness, setDeletingBusiness] = useState<any | null>(null);
  
  // State za pregled i uređivanje biznisa
  const [viewingBusiness, setViewingBusiness] = useState<any | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<any | null>(null);
  
  // State za otkazivanje pretplate
  const [cancellingSubscription, setCancellingSubscription] = useState<any | null>(null);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  // State za deaktivaciju biznisa
  const [deactivatingBusiness, setDeactivatingBusiness] = useState<any | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  // State za promenu statusa kreatora
  const [statusChangeCreator, setStatusChangeCreator] = useState<any | null>(null);
  const [statusChangeNewStatus, setStatusChangeNewStatus] = useState<CreatorStatus | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  
  // State za brisanje portfolio stavke iz admin edit modala
  const [deletingPortfolioIndex, setDeletingPortfolioIndex] = useState<number | null>(null);
  
  // Get reviews - sada koristi fetchedReviews
  const allReviews = fetchedReviews;
  
  const pendingReviewsCount = useMemo(() => {
    return fetchedReviews.filter(r => r.status === 'pending').length;
  }, [fetchedReviews]);
  
  // Pending jobs count for admin notification
  const adminPendingJobsCount = useMemo(() => {
    return allJobs.filter(j => j.status === 'pending').length;
  }, [allJobs]);
  
  // Filtrirane recenzije
  const filteredReviews = useMemo(() => {
    let reviews = [...fetchedReviews];
    
    if (reviewStatusFilter !== 'all') {
      reviews = reviews.filter(r => r.status === reviewStatusFilter);
    }
    
    if (selectedReviewCreator !== 'all') {
      reviews = reviews.filter(r => r.creatorId === selectedReviewCreator);
    }
    
    // Sort by date, pending first
    return reviews.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [fetchedReviews, reviewStatusFilter, selectedReviewCreator]);
  
  // Helper za dobijanje imena kreatora (koristi fetchedCreators iz Supabase)
  const getCreatorName = (creatorId: string): string => {
    const creator = fetchedCreators.find(c => c.id === creatorId);
    return creator?.name || 'Nepoznat kreator';
  };

  if (currentUser.type !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Pristup odbijen</h1>
          <p className="text-muted mb-6">Samo administratori mogu pristupiti ovoj stranici.</p>
          <Link href="/" className="text-primary hover:underline">
            Nazad na početnu
          </Link>
        </div>
      </div>
    );
  }

  // Refresh creators after action
  const refreshCreators = async () => {
    try {
      const response = await fetch('/api/admin/creators');
      if (response.ok) {
        const data = await response.json();
        setFetchedCreators(data.creators || []);
      }
    } catch (error) {
      console.error('Error refreshing creators:', error);
    }
  };

  // Odobri kreatora - sets status to 'approved'
  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/admin/creators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: id, action: 'approve' }),
      });
      
      if (response.ok) {
        await refreshCreators();
      } else {
        alert('Greška pri odobravanju kreatora');
      }
    } catch (error) {
      console.error('Error approving creator:', error);
      alert('Greška pri odobravanju kreatora');
    }
  };

  // Odbij kreatora sa razlogom
  const handleReject = async (id: string, reason: string) => {
    try {
      const response = await fetch('/api/admin/creators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: id, action: 'reject', rejectionReason: reason }),
      });
      
      if (response.ok) {
        await refreshCreators();
        setRejectingCreator(null);
        setRejectionReason('');
      } else {
        alert('Greška pri odbijanju kreatora');
      }
    } catch (error) {
      console.error('Error rejecting creator:', error);
      alert('Greška pri odbijanju kreatora');
    }
  };
  
  // Otvori modal za odbijanje
  const openRejectModal = (creator: any) => {
    setRejectingCreator(creator);
    setRejectionReason('');
  };

  // Obriši kreatora
  const handleDeleteCreator = (creator: any) => {
    setDeletingCreator(creator);
  };
  
  const confirmDeleteCreator = async () => {
    if (deletingCreator) {
      try {
        const response = await fetch(`/api/admin/creators?creatorId=${deletingCreator.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          await refreshCreators();
          setDeletingCreator(null);
        } else {
          alert('Greška pri brisanju kreatora');
        }
      } catch (error) {
        console.error('Error deleting creator:', error);
        alert('Greška pri brisanju kreatora');
      }
    }
  };

  // Otvori modal za potvrdu promene statusa
  const openStatusChangeModal = (creator: any, newStatus: CreatorStatus) => {
    // Ako je isti status, ne radi ništa
    const currentStatus = creator.status || (creator.approved ? 'approved' : 'pending');
    if (currentStatus === newStatus) return;
    
    setStatusChangeCreator(creator);
    setStatusChangeNewStatus(newStatus);
  };
  
  // Potvrdi promenu statusa kreatora
  const confirmChangeStatus = async () => {
    if (!statusChangeCreator || !statusChangeNewStatus) return;
    
    const action = statusChangeNewStatus === 'approved' ? 'approve' : 
                   statusChangeNewStatus === 'deactivated' ? 'deactivate' : 
                   statusChangeNewStatus === 'rejected' ? 'reject' : 
                   statusChangeNewStatus === 'pending' ? 'set_pending' : 'approve';
    
    setIsChangingStatus(true);
    
    try {
      const response = await fetch('/api/admin/creators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: statusChangeCreator.id, action }),
      });
      
      if (response.ok) {
        await refreshCreators();
        setStatusChangeCreator(null);
        setStatusChangeNewStatus(null);
        // Zatvori viewing modal ako je otvoren
        if (viewingCreator) {
          setViewingCreator(null);
        }
      } else {
        alert('Greška pri promeni statusa');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Greška pri promeni statusa');
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Obriši biznis
  const handleDeleteBusiness = (business: any) => {
    setDeletingBusiness(business);
  };
  
  const confirmDeleteBusiness = async () => {
    if (deletingBusiness) {
      try {
        const response = await fetch(`/api/admin/businesses?businessId=${deletingBusiness.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          await refreshBusinesses();
          setDeletingBusiness(null);
        } else {
          alert('Greška pri brisanju biznisa');
        }
      } catch (error) {
        console.error('Error deleting business:', error);
        alert('Greška pri brisanju biznisa');
      }
    }
  };

  
  // Otkaži pretplatu biznisa
  const confirmCancelSubscription = async () => {
    if (!cancellingSubscription) return;
    
    setIsCancellingSubscription(true);
    try {
      const response = await fetch('/api/admin/businesses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: cancellingSubscription.id,
          action: 'cancel_subscription',
        }),
      });
      
      if (response.ok) {
        await refreshBusinesses();
        // Ažuriraj editingBusiness ako je isti
        if (editingBusiness?.id === cancellingSubscription.id) {
          setEditingBusiness({...editingBusiness, subscriptionStatus: 'expired', stripeSubscriptionId: null});
        }
        setCancellingSubscription(null);
      } else {
        alert('Greška pri otkazivanju pretplate');
        setCancellingSubscription(null);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Greška pri otkazivanju pretplate');
      setCancellingSubscription(null);
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  // Sačuvaj izmene biznisa
  const handleSaveBusiness = async (updatedBusiness: any) => {
    try {
      const response = await fetch('/api/admin/businesses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: updatedBusiness.id,
          companyName: updatedBusiness.companyName,
          email: updatedBusiness.email,
          phone: updatedBusiness.phone,
          website: updatedBusiness.website,
          industry: updatedBusiness.industry,
          description: updatedBusiness.description,
          subscriptionStatus: updatedBusiness.subscriptionStatus,
          subscriptionType: updatedBusiness.subscriptionType,
          subscribedAt: updatedBusiness.subscribedAt,
          expiresAt: updatedBusiness.expiresAt,
        }),
      });
      
      if (response.ok) {
        await refreshBusinesses();
        setEditingBusiness(null);
      } else {
        alert('Greška pri čuvanju izmena');
      }
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Greška pri čuvanju izmena');
    }
  };

  // Dodaj kategoriju
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim() || fetchedCategories.includes(newCategory.trim())) return;
    
    setIsAddingCategory(true);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() }),
      });
      
      if (response.ok) {
        await refreshCategories();
        setNewCategory('');
      } else {
        const data = await response.json();
        alert(data.error || 'Greška pri dodavanju kategorije');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Greška pri dodavanju kategorije');
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Obriši kategoriju
  const handleDeleteCategory = (category: string) => {
    setDeletingCategory(category);
  };
  
  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    
    try {
      const response = await fetch(`/api/admin/categories?name=${encodeURIComponent(deletingCategory)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await refreshCategories();
        setDeletingCategory(null);
      } else {
        alert('Greška pri brisanju kategorije');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Greška pri brisanju kategorije');
    }
  };

  // Sačuvaj izmene kreatora - koristi admin endpoint
  const handleSaveCreator = async (updatedCreator: Creator) => {
    try {
      const response = await fetch('/api/admin/creators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: updatedCreator.id,
          name: updatedCreator.name,
          location: updatedCreator.location,
          bio: updatedCreator.bio,
          priceFrom: updatedCreator.priceFrom,
          phone: updatedCreator.phone,
          instagram: updatedCreator.instagram,
          tiktok: updatedCreator.tiktok,
          youtube: updatedCreator.youtube,
          portfolio: updatedCreator.portfolio,
          categories: updatedCreator.categories,
          platforms: updatedCreator.platforms,
          languages: updatedCreator.languages,
        }),
      });
      
      if (response.ok) {
        await refreshCreators();
        setEditingCreator(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Greška pri čuvanju izmena');
      }
    } catch (error) {
      console.error('Error saving creator:', error);
      alert('Greška pri čuvanju izmena');
    }
  };

  // Filtrirani kreatori (svi osim obrišenih)
  const filteredCreators = fetchedCreators.filter(c => 
    c.name.toLowerCase().includes(searchCreators.toLowerCase()) ||
    c.email.toLowerCase().includes(searchCreators.toLowerCase())
  );

  // Filtrirani biznisi
  const filteredBusinesses = fetchedBusinesses.filter(b => 
    (b.companyName || '').toLowerCase().includes(searchBusinesses.toLowerCase()) ||
    (b.email || '').toLowerCase().includes(searchBusinesses.toLowerCase())
  );

  const tabs: { id: AdminTab; label: string; count?: number; highlight?: boolean }[] = [
    { id: 'pending', label: 'Čekaju odobrenje', count: pendingCreatorsList.length },
    { id: 'creators', label: 'Kreatori', count: fetchedCreators.length },
    { id: 'businesses', label: 'Biznisi', count: fetchedBusinesses.length },
    { id: 'categories', label: 'Kategorije', count: fetchedCategories.length },
    { id: 'reviews', label: 'Recenzije', count: pendingReviewsCount, highlight: pendingReviewsCount > 0 },
    { id: 'poslovi', label: 'Poslovi', count: adminPendingJobsCount > 0 ? adminPendingJobsCount : allJobs.length, highlight: adminPendingJobsCount > 0 },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-12">
        {/* Header - responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-10 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light mb-1 sm:mb-2">Admin Panel</h1>
            <p className="text-sm sm:text-base text-muted">Upravljaj platformom</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-muted">Ulogovan kao:</span>
            <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-full text-xs sm:text-sm">Admin</span>
          </div>
        </div>

        {/* Tabs - scrollable on mobile, flex on desktop */}
        <div className="mb-6 sm:mb-8">
          {/* Mobile tabs - horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden scrollbar-hide">
            {tabs.map((tab) => {
              const mobileLabels: Record<AdminTab, string> = {
                pending: 'Čekaju',
                creators: 'Kreatori',
                businesses: 'Biznisi',
                categories: 'Kategorije',
                reviews: 'Recenzije',
                poslovi: 'Poslovi',
              };
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-white border border-border hover:bg-secondary'
                  } ${tab.highlight && activeTab !== tab.id ? 'border-warning' : ''}`}
                >
                  <span>{mobileLabels[tab.id]}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center ${
                      activeTab === tab.id ? 'bg-white/20' : 
                      tab.highlight ? 'bg-warning text-white' : 'bg-secondary'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Desktop tabs - horizontal flex */}
          <div className="hidden sm:flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border hover:bg-secondary'
                } ${tab.highlight && activeTab !== tab.id ? 'border-warning' : ''}`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 
                    tab.highlight ? 'bg-warning/20 text-warning' : 'bg-secondary'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-border p-4 sm:p-6">
          {/* Pending */}
          {activeTab === 'pending' && (
            <div>
              <h2 className="text-base sm:text-lg font-medium mb-4 sm:mb-6">Kreatori koji čekaju odobrenje</h2>
              
              {isLoadingCreators ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted text-sm sm:text-base">Učitavanje kreatora...</p>
                </div>
              ) : pendingCreatorsList.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-3xl sm:text-4xl mb-4">✅</div>
                  <p className="text-muted text-sm sm:text-base">Nema kreatora koji čekaju odobrenje</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingCreatorsList.map((creator) => (
                    <div key={creator.id} className="border border-border rounded-xl p-4 sm:p-6">
                      {/* Mobile layout */}
                      <div className="sm:hidden">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-14 h-14 rounded-full overflow-hidden relative flex-shrink-0 bg-secondary flex items-center justify-center">
                            {creator.photo ? (
                              <Image src={creator.photo} alt={creator.name} fill className="object-cover" />
                            ) : (
                              <span className="text-lg font-medium text-muted">{creator.name?.charAt(0) || '?'}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base truncate">{creator.name}</h3>
                            <p className="text-xs text-muted truncate">{creator.location}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-muted truncate">{creator.email}</p>
                              {creator.emailVerified ? (
                                <span className="flex-shrink-0 text-success" title="Email verifikovan">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                  </svg>
                                </span>
                              ) : (
                                <span className="flex-shrink-0 text-amber-500" title="Email nije verifikovan">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                  </svg>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-sm">€{creator.priceFrom}</p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted line-clamp-2 mb-3">{creator.bio}</p>
                        
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {creator.categories.slice(0, 3).map((cat: string) => (
                            <span key={cat} className="px-2 py-0.5 bg-secondary rounded-full text-xs">
                              {cat}
                            </span>
                          ))}
                          {creator.categories.length > 3 && (
                            <span className="px-2 py-0.5 bg-secondary rounded-full text-xs">+{creator.categories.length - 3}</span>
                          )}
                        </div>
                        
                        {/* Mobile buttons - stack vertically */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => { setViewingCreator(creator); setViewingFromPending(true); }}
                            className="w-full py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
                          >
                            Pogledaj detalje
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(creator.id)}
                              className="flex-1 py-2.5 bg-success text-white rounded-xl text-sm font-medium hover:bg-success/90 transition-colors"
                            >
                              ✓ Odobri
                            </button>
                            <button
                              onClick={() => openRejectModal(creator)}
                              className="flex-1 py-2.5 bg-error text-white rounded-xl text-sm font-medium hover:bg-error/90 transition-colors"
                            >
                              ✕ Odbij
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop layout */}
                      <div className="hidden sm:block">
                        <div className="flex items-start gap-6">
                          <div className="w-20 h-20 rounded-full overflow-hidden relative flex-shrink-0 bg-secondary flex items-center justify-center">
                            {creator.photo ? (
                              <Image src={creator.photo} alt={creator.name} fill className="object-cover" />
                            ) : (
                              <span className="text-2xl font-medium text-muted">{creator.name?.charAt(0) || '?'}</span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium text-lg">{creator.name}</h3>
                                <p className="text-sm text-muted">{creator.location}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-muted">{creator.email}</p>
                                  {creator.emailVerified ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success rounded-full text-xs">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                      </svg>
                                      Verifikovan
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                      </svg>
                                      Čeka verifikaciju
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">€{creator.priceFrom}</p>
                                <p className="text-sm text-muted">Registrovan: {creator.createdAt}</p>
                              </div>
                            </div>
                            
                            <p className="text-sm mt-4 line-clamp-2">{creator.bio}</p>
                            
                            <div className="flex flex-wrap gap-2 mt-4">
                              {creator.categories.map((cat: string) => (
                                <span key={cat} className="px-3 py-1 bg-secondary rounded-full text-xs">
                                  {cat}
                                </span>
                              ))}
                            </div>
                            
                            <div className="flex gap-3 mt-6">
                              <button
                                onClick={() => { setViewingCreator(creator); setViewingFromPending(true); }}
                                className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
                              >
                                Pogledaj detalje
                              </button>
                              <button
                                onClick={() => handleApprove(creator.id)}
                                className="px-6 py-2.5 bg-success text-white rounded-xl text-sm font-medium hover:bg-success/90 transition-colors"
                              >
                                ✓ Odobri
                              </button>
                              <button
                                onClick={() => openRejectModal(creator)}
                                className="px-6 py-2.5 bg-error text-white rounded-xl text-sm font-medium hover:bg-error/90 transition-colors"
                              >
                                ✕ Odbij
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Creators */}
          {activeTab === 'creators' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-medium">Svi kreatori ({filteredCreators.length})</h2>
                <input
                  type="text"
                  placeholder="Pretraži..."
                  value={searchCreators}
                  onChange={(e) => setSearchCreators(e.target.value)}
                  className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-muted w-full sm:w-64 text-sm"
                />
              </div>
              
              {filteredCreators.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-muted text-sm sm:text-base">Nema rezultata</p>
                </div>
              ) : (
                <>
                  {/* Mobile view - cards */}
                  <div className="sm:hidden space-y-3">
                    {filteredCreators.map((creator) => (
                      <div key={creator.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden relative flex-shrink-0 bg-secondary flex items-center justify-center">
                            {creator.photo ? (
                              <Image src={creator.photo} alt="" fill className="object-cover" />
                            ) : (
                              <span className="text-sm font-medium text-muted">{creator.name?.charAt(0) || '?'}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{creator.name}</div>
                            <div className="text-xs text-muted truncate">{creator.email}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-sm">€{creator.priceFrom}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {creator.categories.slice(0, 2).map((cat: string) => (
                            <span key={cat} className="px-2 py-0.5 bg-secondary rounded text-xs">
                              {cat}
                            </span>
                          ))}
                          {creator.categories.length > 2 && (
                            <span className="px-2 py-0.5 bg-secondary rounded text-xs">
                              +{creator.categories.length - 2}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={creator.status || (creator.approved ? 'approved' : 'pending')}
                            onChange={(e) => openStatusChangeModal(creator, e.target.value as CreatorStatus)}
                            className={`px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border-0 focus:outline-none ${
                              (creator.status === 'approved' || (creator.approved && !creator.status))
                                ? 'bg-black text-white' 
                                : creator.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : creator.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            <option value="approved">Aktivan</option>
                            <option value="pending">Na čekanju</option>
                            <option value="rejected">Odbijen</option>
                            <option value="deactivated">Neaktivan</option>
                          </select>
                          
                          <div className="flex gap-3 items-center">
                            <button 
                              onClick={() => { setViewingCreator(creator); setViewingFromPending(false); }}
                              className="text-muted hover:text-primary transition-colors"
                              title="Pogledaj"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => setEditingCreator(creator)}
                              className="text-primary hover:text-primary/70 transition-colors"
                              title="Uredi"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleDeleteCreator(creator)}
                              className="text-error hover:text-error/70 transition-colors"
                              title="Obriši"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop view - table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-4 font-medium text-sm text-muted">Kreator</th>
                          <th className="pb-4 font-medium text-sm text-muted">Kategorije</th>
                          <th className="pb-4 font-medium text-sm text-muted">Cena</th>
                          <th className="pb-4 font-medium text-sm text-muted">Status</th>
                          <th className="pb-4 font-medium text-sm text-muted">Akcije</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCreators.map((creator) => (
                          <tr key={creator.id} className="border-b border-border">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden relative bg-secondary flex items-center justify-center">
                                  {creator.photo ? (
                                    <Image src={creator.photo} alt="" fill className="object-cover" />
                                  ) : (
                                    <span className="text-sm font-medium text-muted">{creator.name?.charAt(0) || '?'}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{creator.name}</div>
                                  <div className="text-sm text-muted">{creator.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="flex gap-1 flex-wrap">
                                {creator.categories.slice(0, 2).map((cat: string) => (
                                  <span key={cat} className="px-2 py-0.5 bg-secondary rounded text-xs">
                                    {cat}
                                  </span>
                                ))}
                                {creator.categories.length > 2 && (
                                  <span className="px-2 py-0.5 bg-secondary rounded text-xs">
                                    +{creator.categories.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4">€{creator.priceFrom}</td>
                            <td className="py-4">
                              <select
                                value={creator.status || (creator.approved ? 'approved' : 'pending')}
                                onChange={(e) => openStatusChangeModal(creator, e.target.value as CreatorStatus)}
                                className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                                  (creator.status === 'approved' || (creator.approved && !creator.status))
                                    ? 'bg-black text-white' 
                                    : creator.status === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : creator.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                <option value="approved">Aktivan</option>
                                <option value="pending">Na čekanju</option>
                                <option value="rejected">Odbijen</option>
                                <option value="deactivated">Neaktivan</option>
                              </select>
                            </td>
                            <td className="py-4">
                              <div className="flex gap-3 items-center">
                                <button 
                                  onClick={() => { setViewingCreator(creator); setViewingFromPending(false); }}
                                  className="text-muted hover:text-primary transition-colors"
                                  title="Pogledaj"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => setEditingCreator(creator)}
                                  className="text-primary hover:text-primary/70 transition-colors"
                                  title="Uredi"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteCreator(creator)}
                                  className="text-error hover:text-error/70 transition-colors"
                                  title="Obriši"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Businesses */}
          {activeTab === 'businesses' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-medium">Svi biznisi ({filteredBusinesses.length})</h2>
                <input
                  type="text"
                  placeholder="Pretraži..."
                  value={searchBusinesses}
                  onChange={(e) => setSearchBusinesses(e.target.value)}
                  className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-muted w-full sm:w-64 text-sm"
                />
              </div>
              
              {isLoadingBusinesses ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredBusinesses.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-muted text-sm sm:text-base">Nema rezultata</p>
                </div>
              ) : (
                <>
                  {/* Mobile view - cards */}
                  <div className="sm:hidden space-y-3">
                    {filteredBusinesses.map((business) => (
                      <div key={business.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{business.companyName}</h3>
                            <p className="text-xs text-muted truncate">{business.email}</p>
                          </div>
                          <span className={`px-2 py-1.5 rounded-lg text-xs ml-2 ${
                            business.subscriptionStatus === 'active' 
                              ? 'bg-black text-white' 
                              : business.subscriptionStatus === 'expired'
                              ? 'bg-amber-100 text-amber-700'
                              : business.subscriptionStatus === 'deactivated'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {business.subscriptionStatus === 'active' ? 'Aktivan' : 
                             business.subscriptionStatus === 'expired' ? 'Istekao' : 
                             business.subscriptionStatus === 'deactivated' ? 'Deaktiviran' : 'Neaktivan'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>
                            Plan: {business.subscriptionType === 'yearly' ? 'Godišnji' : 
                                   business.subscriptionType === 'monthly' ? 'Mesečni' : '—'}
                          </span>
                          <span>Ističe: {business.expiresAt || '—'}</span>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-border flex justify-end gap-3">
                          <button 
                            onClick={() => setViewingBusiness(business)}
                            className="text-muted hover:text-primary transition-colors"
                            title="Pogledaj"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => setEditingBusiness(business)}
                            className="text-primary hover:text-primary/70 transition-colors"
                            title="Uredi"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteBusiness(business)}
                            className="text-error hover:text-error/70 transition-colors"
                            title="Obriši"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop view - table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-4 font-medium text-sm text-muted">Kompanija</th>
                          <th className="pb-4 font-medium text-sm text-muted">Email</th>
                          <th className="pb-4 font-medium text-sm text-muted">Plan</th>
                          <th className="pb-4 font-medium text-sm text-muted">Status</th>
                          <th className="pb-4 font-medium text-sm text-muted">Ističe</th>
                          <th className="pb-4 font-medium text-sm text-muted">Akcije</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBusinesses.map((business) => (
                          <tr key={business.id} className="border-b border-border">
                            <td className="py-4 font-medium">{business.companyName}</td>
                            <td className="py-4 text-muted">{business.email}</td>
                            <td className="py-4">
                              {business.subscriptionType === 'yearly' ? 'Godišnji' : 
                               business.subscriptionType === 'monthly' ? 'Mesečni' : '—'}
                            </td>
                            <td className="py-4">
                              <span className={`px-3 py-1.5 rounded-lg text-xs ${
                                business.subscriptionStatus === 'active' 
                                  ? 'bg-black text-white' 
                                  : business.subscriptionStatus === 'expired'
                                  ? 'bg-amber-100 text-amber-700'
                                  : business.subscriptionStatus === 'deactivated'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {business.subscriptionStatus === 'active' ? 'Aktivan' : 
                                 business.subscriptionStatus === 'expired' ? 'Istekao' : 
                                 business.subscriptionStatus === 'deactivated' ? 'Deaktiviran' : 'Neaktivan'}
                              </span>
                            </td>
                            <td className="py-4 text-muted">{business.expiresAt || '—'}</td>
                            <td className="py-4">
                              <div className="flex gap-3 items-center">
                                <button 
                                  onClick={() => setViewingBusiness(business)}
                                  className="text-muted hover:text-primary transition-colors"
                                  title="Pogledaj"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => setEditingBusiness(business)}
                                  className="text-primary hover:text-primary/70 transition-colors"
                                  title="Uredi"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteBusiness(business)}
                                  className="text-error hover:text-error/70 transition-colors"
                                  title="Obriši"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Categories */}
          {activeTab === 'categories' && (
            <div>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-medium">Kategorije ({fetchedCategories.length})</h2>
              </div>
              
              <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nova kategorija..."
                  className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 border border-border rounded-xl focus:outline-none focus:border-muted text-sm"
                  disabled={isAddingCategory}
                />
                <button
                  type="submit"
                  disabled={isAddingCategory || !newCategory.trim()}
                  className="px-6 py-2.5 sm:py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAddingCategory ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Dodajem...
                    </>
                  ) : (
                    'Dodaj'
                  )}
                </button>
              </form>
              
              {isLoadingCategories ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : fetchedCategories.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-muted text-sm sm:text-base">Nema kategorija</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                  {fetchedCategories.map((category) => (
                    <div 
                      key={category}
                      className="flex items-center justify-between p-3 sm:p-4 bg-secondary rounded-xl group"
                    >
                      <span className="text-sm truncate">{category}</span>
                      <button 
                        onClick={() => handleDeleteCategory(category)}
                        className="text-muted hover:text-error transition-colors sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <div>
                  <h2 className="text-base sm:text-lg font-medium">Moderacija recenzija</h2>
                  <p className="text-sm text-muted mt-1">
                    {isLoadingReviews ? 'Učitavanje...' : pendingReviewsCount > 0 
                      ? `${pendingReviewsCount} recenzija čeka odobrenje`
                      : 'Sve recenzije su pregledane'
                    }
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Status filter */}
                  <select
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value as typeof reviewStatusFilter)}
                    className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-muted text-sm"
                  >
                    <option value="pending">Na čekanju ({allReviews.filter(r => r.status === 'pending').length})</option>
                    <option value="approved">Odobrene ({allReviews.filter(r => r.status === 'approved').length})</option>
                    <option value="rejected">Odbijene ({allReviews.filter(r => r.status === 'rejected').length})</option>
                    <option value="all">Sve ({allReviews.length})</option>
                  </select>
                  
                  {/* Creator filter */}
                  <select
                    value={selectedReviewCreator}
                    onChange={(e) => setSelectedReviewCreator(e.target.value)}
                    className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:border-muted text-sm"
                  >
                    <option value="all">Svi kreatori</option>
                    {fetchedCreators.map(creator => (
                      <option key={creator.id} value={creator.id}>
                        {creator.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {isLoadingReviews ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-3xl sm:text-4xl mb-4">
                    {reviewStatusFilter === 'pending' ? '✅' : '📝'}
                  </div>
                  <p className="text-muted text-sm sm:text-base">
                    {reviewStatusFilter === 'pending' 
                      ? 'Nema recenzija koje čekaju odobrenje'
                      : 'Nema recenzija sa ovim filterima'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReviews.map((review) => (
                    <div key={review.id} className="border border-border rounded-xl p-4 sm:p-6">
                      {/* Review header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          {/* Business avatar */}
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {review.businessName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{review.businessName}</div>
                            <div className="text-xs text-muted">
                              Za: <Link href={`/kreator/${review.creatorId}`} className="text-primary hover:underline">
                                {review.creator?.name || 'Nepoznat kreator'}
                              </Link>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status & date */}
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            review.status === 'pending' 
                              ? 'bg-amber-100 text-amber-700'
                              : review.status === 'approved'
                              ? 'bg-success/10 text-success'
                              : 'bg-error/10 text-error'
                          }`}>
                            {review.status === 'pending' ? 'Na čekanju' :
                             review.status === 'approved' ? 'Odobrena' : 'Odbijena'}
                          </span>
                          <span className="text-xs text-muted">{review.createdAt}</span>
                        </div>
                      </div>
                      
                      {/* Rating */}
                      <div className="mb-3">
                        <StarRating rating={review.rating} readonly size="sm" />
                      </div>
                      
                      {/* Comment */}
                      <p className="text-sm mb-4 break-words">{review.comment}</p>
                      
                      {/* Creator reply */}
                      {review.creatorReply && (
                        <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-primary">Odgovor kreatora</span>
                            {review.creatorReplyAt && (
                              <span className="text-xs text-muted">{review.creatorReplyAt}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted">{review.creatorReply}</p>
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                        {review.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveReview(review.id)}
                              disabled={isApprovingReview === review.id}
                              className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
                            >
                              {isApprovingReview === review.id ? 'Odobravanje...' : '✓ Odobri'}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingReview(review);
                                setReviewRejectionReason('');
                              }}
                              className="px-4 py-2 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/90 transition-colors"
                            >
                              ✕ Odbij
                            </button>
                          </>
                        )}
                        {review.status === 'approved' && (
                          <button
                            onClick={() => handleRejectReview(review.id)}
                            className="px-4 py-2 border border-error text-error rounded-lg text-sm font-medium hover:bg-error/10 transition-colors"
                          >
                            Povuci odobrenje
                          </button>
                        )}
                        {review.status === 'rejected' && (
                          <button
                            onClick={() => handleApproveReview(review.id)}
                            className="px-4 py-2 border border-success text-success rounded-lg text-sm font-medium hover:bg-success/10 transition-colors"
                          >
                            Odobri
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Da li ste sigurni da želite da obrišete ovu recenziju?')) {
                              handleDeleteReview(review.id);
                            }
                          }}
                          className="px-4 py-2 text-muted hover:text-error text-sm transition-colors ml-auto"
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Poslovi */}
          {activeTab === 'poslovi' && (
            <AdminJobsTab 
              jobs={allJobs}
              setJobs={setAllJobs}
              isLoading={isLoadingJobs}
              showAddModal={showAddJobModal}
              setShowAddModal={setShowAddJobModal}
            />
          )}
        </div>

        {/* View Creator Details Modal */}
        {viewingCreator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-medium">Detalji kreatora</h2>
                <button 
                  onClick={() => setViewingCreator(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-secondary transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="px-4 sm:px-6 py-6">
                {/* Profile header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative flex-shrink-0 bg-secondary flex items-center justify-center">
                    {viewingCreator.photo ? (
                      <Image src={viewingCreator.photo} alt={viewingCreator.name} fill className="object-cover" />
                    ) : (
                      <span className="text-2xl font-medium text-muted">{viewingCreator.name?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-medium truncate">{viewingCreator.name}</h3>
                    <p className="text-sm text-muted">{viewingCreator.location}</p>
                    <p className="text-lg font-semibold text-primary mt-1">od €{viewingCreator.priceFrom}</p>
                  </div>
                </div>
                
                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 p-4 bg-secondary/50 rounded-xl">
                  <div>
                    <span className="text-xs text-muted block">Email</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium break-all">{viewingCreator.email}</span>
                      {viewingCreator.emailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success rounded-full text-xs flex-shrink-0">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                          Verifikovan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs flex-shrink-0">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                          </svg>
                          Čeka verifikaciju
                        </span>
                      )}
                    </div>
                  </div>
                  {viewingCreator.phone && (
                    <div>
                      <span className="text-xs text-muted block">Telefon</span>
                      <span className="text-sm font-medium">{viewingCreator.phone}</span>
                    </div>
                  )}
                  {viewingCreator.instagram && (
                    <div>
                      <span className="text-xs text-muted block">Instagram</span>
                      <span className="text-sm font-medium">{viewingCreator.instagram}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted block">Registrovan</span>
                    <span className="text-sm font-medium">{viewingCreator.createdAt}</span>
                  </div>
                </div>
                
                {/* Bio */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted mb-2">Bio</h3>
                  <p className="text-sm leading-relaxed">{viewingCreator.bio}</p>
                </div>
                
                {/* Categories */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted mb-2">Kategorije</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingCreator.categories.map((cat: string) => (
                      <span key={cat} className="px-3 py-1.5 bg-secondary rounded-full text-xs font-medium">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Platforms */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted mb-2">Platforme</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingCreator.platforms.map((platform: string) => (
                      <span key={platform} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Languages */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted mb-2">Jezici</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingCreator.languages.map((lang: string) => (
                      <span key={lang} className="px-3 py-1.5 bg-secondary rounded-full text-xs">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Portfolio */}
                {viewingCreator.portfolio && viewingCreator.portfolio.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted mb-3">Portfolio ({viewingCreator.portfolio.length} stavk{viewingCreator.portfolio.length > 1 ? 'i' : 'a'})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {viewingCreator.portfolio.map((item: any, index: number) => (
                        <button 
                          key={index}
                          onClick={() => {
                            if (isPortfolioVideo(item)) {
                              if (opensExternally(getPortfolioVideoType(item))) {
                                window.open(normalizeExternalUrl(item.url), '_blank', 'noopener,noreferrer');
                              } else {
                                setViewingPortfolioVideo(item);
                              }
                            } else {
                              setViewingPortfolioItem(item);
                            }
                          }}
                          className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-secondary text-left"
                        >
                          {item.thumbnail ? (
                            <Image 
                              src={item.thumbnail} 
                              alt={`Portfolio ${index + 1}`} 
                              fill 
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : item.url ? (
                            <Image 
                              src={item.url} 
                              alt={`Portfolio ${index + 1}`} 
                              fill 
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary">
                              <span className="text-muted text-xs">Nema slike</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium px-3 py-1.5 bg-black/50 rounded-full">
                              Pogledaj
                            </span>
                          </div>
                          {item.platform && (
                            <div className="absolute top-2 right-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                item.platform === 'tiktok' ? 'bg-black text-white' :
                                item.platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                                'bg-red-600 text-white'
                              }`}>
                                {item.platform === 'tiktok' && 'TikTok'}
                                {item.platform === 'instagram' && 'IG'}
                                {item.platform === 'youtube' && 'YT'}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Warning if email not verified */}
                {viewingFromPending && !viewingCreator.emailVerified && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800">Email nije verifikovan</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Ovaj kreator još uvek nije potvrdio svoju email adresu. Ako ga odobrite, neće moći da se prijavi dok ne verifikuje email.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action buttons - different for pending vs approved creators */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  {viewingFromPending ? (
                    // Pending kreatori - prikaži Odobri/Odbij
                    <>
                      <button
                        onClick={() => {
                          handleApprove(viewingCreator.id);
                          setViewingCreator(null);
                        }}
                        className="flex-1 py-3 bg-success text-white rounded-xl text-sm font-medium hover:bg-success/90 transition-colors"
                      >
                        ✓ Odobri kreatora
                      </button>
                      <button
                        onClick={() => {
                          setViewingCreator(null);
                          openRejectModal(viewingCreator);
                        }}
                        className="flex-1 py-3 bg-error text-white rounded-xl text-sm font-medium hover:bg-error/90 transition-colors"
                      >
                        ✕ Odbij kreatora
                      </button>
                    </>
                  ) : (
                    // Već odobreni kreatori - prikaži status dropdown
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm text-muted">Status:</span>
                      <select
                        value={viewingCreator.status || (viewingCreator.approved ? 'approved' : 'pending')}
                        onChange={(e) => {
                          openStatusChangeModal(viewingCreator, e.target.value as CreatorStatus);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          (viewingCreator.status === 'approved' || (viewingCreator.approved && !viewingCreator.status))
                            ? 'bg-black text-white' 
                            : viewingCreator.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : viewingCreator.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <option value="approved">Aktivan</option>
                        <option value="pending">Na čekanju</option>
                        <option value="rejected">Odbijen</option>
                        <option value="deactivated">Neaktivan</option>
                      </select>
                    </div>
                  )}
                  <button
                    onClick={() => setViewingCreator(null)}
                    className={`${viewingFromPending ? 'flex-1' : ''} py-3 px-6 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors`}
                  >
                    Zatvori
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Creator Modal */}
        {editingCreator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium">Uredi kreatora</h3>
                <button 
                  onClick={() => setEditingCreator(null)}
                  className="text-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSaveCreator(editingCreator);
              }} className="space-y-4">
                <div>
                  <label className="text-sm text-muted mb-1 block">Ime</label>
                  <input
                    type="text"
                    value={editingCreator.name}
                    onChange={(e) => setEditingCreator({...editingCreator, name: e.target.value})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted mb-1 block">Email</label>
                  <input
                    type="email"
                    value={editingCreator.email}
                    onChange={(e) => setEditingCreator({...editingCreator, email: e.target.value})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted mb-1 block">Lokacija</label>
                  <input
                    type="text"
                    value={editingCreator.location}
                    onChange={(e) => setEditingCreator({...editingCreator, location: e.target.value})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted mb-1 block">Bio</label>
                  <textarea
                    value={editingCreator.bio}
                    onChange={(e) => setEditingCreator({...editingCreator, bio: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted resize-none"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted mb-1 block">Cena (€)</label>
                  <input
                    type="number"
                    value={editingCreator.priceFrom}
                    onChange={(e) => setEditingCreator({...editingCreator, priceFrom: Number(e.target.value)})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted mb-1 block">Telefon</label>
                  <input
                    type="text"
                    value={editingCreator.phone || ''}
                    onChange={(e) => setEditingCreator({...editingCreator, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                  />
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted mb-1 block">Instagram</label>
                    <input
                      type="text"
                      value={editingCreator.instagram || ''}
                      onChange={(e) => setEditingCreator({...editingCreator, instagram: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1 block">TikTok</label>
                    <input
                      type="text"
                      value={editingCreator.tiktok || ''}
                      onChange={(e) => setEditingCreator({...editingCreator, tiktok: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1 block">YouTube</label>
                    <input
                      type="text"
                      value={editingCreator.youtube || ''}
                      onChange={(e) => setEditingCreator({...editingCreator, youtube: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                      placeholder="@channel"
                    />
                  </div>
                </div>

                {/* Portfolio Section */}
                {editingCreator.portfolio && editingCreator.portfolio.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <label className="text-sm text-muted mb-3 block">Portfolio ({editingCreator.portfolio.length} stavki)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {editingCreator.portfolio.map((item: { thumbnail?: string; url?: string; type?: string }, index: number) => (
                        <div key={index} className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPortfolioVideo(item)) {
                                if (item.url && opensExternally(getPortfolioVideoType(item))) {
                                  window.open(normalizeExternalUrl(item.url), '_blank', 'noopener,noreferrer');
                                } else {
                                  setViewingPortfolioVideo(item);
                                }
                              } else {
                                setViewingPortfolioItem(item);
                              }
                            }}
                            className="relative aspect-square rounded-lg overflow-hidden bg-secondary w-full text-left"
                            title="Otvori portfolio stavku"
                          >
                            {item.thumbnail ? (
                              <Image src={item.thumbnail} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </button>
                          {/* Desktop: X button on hover */}
                          <button
                            type="button"
                            onClick={() => setDeletingPortfolioIndex(index)}
                            className="hidden sm:flex absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Obriši"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          {/* Mobile: Trash icon always visible */}
                          <button
                            type="button"
                            onClick={() => setDeletingPortfolioIndex(index)}
                            className="sm:hidden absolute -top-1 -right-1 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center shadow-sm"
                            title="Obriši"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Desktop hint */}
                    <p className="hidden sm:block text-xs text-muted mt-2">Pređi mišem preko stavke i klikni X da obrišeš</p>

                    {/* Confirm Delete Portfolio Modal */}
                    {deletingPortfolioIndex !== null && (
                      <div 
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
                        onClick={() => setDeletingPortfolioIndex(null)}
                      >
                        <div 
                          className="bg-white rounded-xl max-w-sm w-full p-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-center">
                            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </div>
                            
                            <h3 className="text-lg font-semibold mb-2">Obriši portfolio stavku?</h3>
                            <p className="text-muted text-sm mb-4">
                              Da li ste sigurni da želite da obrišete ovu stavku iz portfolia kreatora?
                            </p>

                            {editingCreator.portfolio[deletingPortfolioIndex]?.thumbnail && (
                              <div className="mb-4 rounded-lg overflow-hidden border border-border mx-auto w-24 h-24">
                                <img 
                                  src={editingCreator.portfolio[deletingPortfolioIndex].thumbnail} 
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setDeletingPortfolioIndex(null)}
                                className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors"
                              >
                                Odustani
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newPortfolio = editingCreator.portfolio.filter((_: unknown, i: number) => i !== deletingPortfolioIndex);
                                  setEditingCreator({...editingCreator, portfolio: newPortfolio});
                                  setDeletingPortfolioIndex(null);
                                }}
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
                )}

                {/* Reset Password Section */}
                <div className="pt-4 mt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Resetuj lozinku</p>
                      <p className="text-xs text-muted">Pošalji link za reset lozinke na email kreatora</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/admin/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: editingCreator.email }),
                          });
                          if (response.ok) {
                            alert(`Link za reset lozinke je poslat na ${editingCreator.email}`);
                          } else {
                            alert('Greška pri slanju reset linka');
                          }
                        } catch (error) {
                          alert('Greška pri slanju reset linka');
                        }
                      }}
                      className="px-4 py-2 text-sm border border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="hidden sm:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Pošalji reset link
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingCreator(null)}
                    className="flex-1 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                  >
                    Otkaži
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Sačuvaj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal za odbijanje kreatora */}
        {rejectingCreator && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-error">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">Odbij kreatora</h3>
                <p className="text-muted text-sm">
                  Odbijate profil: <strong>{rejectingCreator.name}</strong>
                </p>
              </div>

              <div className="mb-6">
                <label className="text-sm text-muted mb-2 block">Razlog odbijanja *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-error resize-none"
                  placeholder="Unesite razlog odbijanja profila (biće prikazan kreatoru)..."
                  required
                />
                <p className="text-xs text-muted mt-1">
                  Kreator će videti ovaj razlog na svom dashboardu
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectingCreator(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={() => {
                    if (rejectionReason.trim()) {
                      handleReject(rejectingCreator.id, rejectionReason.trim());
                    } else {
                      alert('Molimo unesite razlog odbijanja');
                    }
                  }}
                  className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-error/90 transition-colors"
                >
                  Potvrdi odbijanje
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal za odbijanje recenzije */}
        {rejectingReview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-medium mb-2">Odbij recenziju</h3>
              <p className="text-sm text-muted mb-4">
                Recenzija od <strong>{rejectingReview.businessName}</strong> za kreatora <strong>{rejectingReview.creator?.name || 'Nepoznat'}</strong>
              </p>

              <div className="mb-6">
                <label className="text-sm text-muted mb-2 block">Razlog odbijanja (opcionalno)</label>
                <textarea
                  value={reviewRejectionReason}
                  onChange={(e) => setReviewRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Npr. Neprimeren sadržaj, spam..."
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-error resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectingReview(null);
                    setReviewRejectionReason('');
                  }}
                  className="flex-1 py-3 border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
                <button
                  onClick={() => {
                    handleRejectReview(rejectingReview.id, reviewRejectionReason.trim() || undefined);
                    setRejectingReview(null);
                    setReviewRejectionReason('');
                  }}
                  className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-error/90 transition-colors"
                >
                  Odbij recenziju
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal za brisanje kategorije */}
        {deletingCategory && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeletingCategory(null)}
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
                
                <h3 className="text-lg font-semibold mb-2">Obriši kategoriju?</h3>
                <p className="text-muted text-sm mb-6">
                  Da li ste sigurni da želite da obrišete kategoriju <strong>"{deletingCategory}"</strong>? Ova akcija se ne može poništiti.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingCategory(null)}
                    className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="flex-1 py-2.5 bg-error text-white rounded-lg font-medium hover:bg-error/90 transition-colors"
                  >
                    Obriši
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal za potvrdu promene statusa kreatora */}
        {statusChangeCreator && statusChangeNewStatus && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!isChangingStatus) {
                setStatusChangeCreator(null);
                setStatusChangeNewStatus(null);
              }
            }}
          >
            <div 
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  statusChangeNewStatus === 'approved' ? 'bg-green-100' :
                  statusChangeNewStatus === 'pending' ? 'bg-amber-100' :
                  'bg-red-100'
                }`}>
                  {statusChangeNewStatus === 'approved' ? (
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : statusChangeNewStatus === 'pending' ? (
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-medium mb-2">Promena statusa</h3>
                <p className="text-muted">
                  Da li ste sigurni da želite da promenite status kreatora{' '}
                  <span className="font-medium text-foreground">{statusChangeCreator.name}</span> u{' '}
                  <span className={`font-medium ${
                    statusChangeNewStatus === 'approved' ? 'text-green-600' :
                    statusChangeNewStatus === 'pending' ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {statusChangeNewStatus === 'approved' ? 'Aktivan' :
                     statusChangeNewStatus === 'pending' ? 'Na čekanju' :
                     'Neaktivan'}
                  </span>?
                </p>
                {statusChangeNewStatus === 'deactivated' && (
                  <p className="text-sm text-muted mt-2">
                    Deaktivirani kreatori neće moći da se prijave i neće biti vidljivi u pretrazi.
                  </p>
                )}
                {statusChangeNewStatus === 'pending' && (
                  <p className="text-sm text-muted mt-2">
                    Kreator će ponovo morati da čeka odobrenje i neće biti vidljiv u pretrazi.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStatusChangeCreator(null);
                    setStatusChangeNewStatus(null);
                  }}
                  disabled={isChangingStatus}
                  className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Otkaži
                </button>
                <button
                  onClick={confirmChangeStatus}
                  disabled={isChangingStatus}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    statusChangeNewStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                    statusChangeNewStatus === 'pending' ? 'bg-amber-500 hover:bg-amber-600' :
                    'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isChangingStatus ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Menjam...
                    </>
                  ) : (
                    'Potvrdi'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal za brisanje kreatora */}
        {deletingCreator && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeletingCreator(null)}
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
                
                <h3 className="text-lg font-semibold mb-2">Obriši kreatora?</h3>
                <p className="text-muted text-sm mb-6">
                  Da li ste sigurni da želite da obrišete kreatora <strong>"{deletingCreator.name}"</strong>? Svi podaci, portfolio i recenzije će biti trajno obrisani.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingCreator(null)}
                    className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={confirmDeleteCreator}
                    className="flex-1 py-2.5 bg-error text-white rounded-lg font-medium hover:bg-error/90 transition-colors"
                  >
                    Obriši
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal za brisanje biznisa */}
        {deletingBusiness && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeletingBusiness(null)}
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
                
                <h3 className="text-lg font-semibold mb-2">Obriši biznis nalog?</h3>
                <p className="text-muted text-sm mb-6">
                  Da li ste sigurni da želite da obrišete biznis <strong>"{deletingBusiness.companyName}"</strong>? Svi podaci i recenzije će biti trajno obrisani.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingBusiness(null)}
                    className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={confirmDeleteBusiness}
                    className="flex-1 py-2.5 bg-error text-white rounded-lg font-medium hover:bg-error/90 transition-colors"
                  >
                    Obriši
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal za otkazivanje pretplate */}
        {cancellingSubscription && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => !isCancellingSubscription && setCancellingSubscription(null)}
          >
            <div 
              className="bg-white rounded-xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-semibold mb-2">Otkaži pretplatu?</h3>
                <p className="text-muted text-sm mb-2">
                  Da li ste sigurni da želite da otkažete pretplatu za biznis:
                </p>
                <p className="font-medium text-foreground mb-4">
                  "{cancellingSubscription.companyName}"
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-6">
                  Ovo će odmah otkazati Stripe pretplatu. Biznis više neće imati pristup premium funkcijama.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancellingSubscription(null)}
                    disabled={isCancellingSubscription}
                    className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={confirmCancelSubscription}
                    disabled={isCancellingSubscription}
                    className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCancellingSubscription ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Otkazujem...
                      </>
                    ) : (
                      'Otkaži pretplatu'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal za deaktivaciju biznisa */}
        {deactivatingBusiness && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => !isDeactivating && setDeactivatingBusiness(null)}
          >
            <div 
              className="bg-white rounded-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {/* Warning Icon */}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-semibold mb-2">Deaktiviraj nalog?</h3>
                <p className="text-muted text-sm mb-4">
                  Želite da deaktivirate biznis:
                </p>
                <p className="font-medium text-foreground mb-4">
                  "{deactivatingBusiness.companyName}"
                </p>
                
                {/* Važno upozorenje */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-amber-800 mb-2">⚠️ Važno:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>• Korisnik <strong>neće moći da se uloguje</strong> na platformu</li>
                    <li>• Stripe pretplata <strong>ostaje aktivna</strong> - naplata se nastavlja!</li>
                    <li>• Ako želite da zaustavite naplatu, morate <strong>posebno otkazati pretplatu</strong></li>
                  </ul>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeactivatingBusiness(null)}
                    disabled={isDeactivating}
                    className="flex-1 py-2.5 border border-border rounded-lg font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={async () => {
                      setIsDeactivating(true);
                      try {
                        const response = await fetch('/api/admin/businesses', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            businessId: deactivatingBusiness.id,
                            subscriptionStatus: 'deactivated',
                          }),
                        });
                        if (response.ok) {
                          await refreshBusinesses();
                          if (editingBusiness?.id === deactivatingBusiness.id) {
                            setEditingBusiness({...editingBusiness, subscriptionStatus: 'deactivated'});
                          }
                          setDeactivatingBusiness(null);
                        }
                      } catch (error) {
                        console.error('Error deactivating:', error);
                      } finally {
                        setIsDeactivating(false);
                      }
                    }}
                    disabled={isDeactivating}
                    className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeactivating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Deaktiviram...
                      </>
                    ) : (
                      'Deaktiviraj'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal za pregled biznisa */}
        {viewingBusiness && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingBusiness(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Detalji biznisa</h3>
                  <button 
                    onClick={() => setViewingBusiness(null)}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Company Name */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-semibold text-primary">
                      {viewingBusiness.companyName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold">{viewingBusiness.companyName}</h4>
                    <p className="text-sm text-muted">{viewingBusiness.email}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${
                        viewingBusiness.subscriptionStatus === 'active' 
                          ? 'bg-black text-white' 
                          : viewingBusiness.subscriptionStatus === 'expired'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {viewingBusiness.subscriptionStatus === 'active' ? 'Aktivan' : 
                         viewingBusiness.subscriptionStatus === 'expired' ? 'Istekao' : 'Neaktivan'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider mb-1">Plan</p>
                      <p className="font-medium">
                        {viewingBusiness.subscriptionType === 'yearly' ? 'Godišnji ($948/god)' : 
                         viewingBusiness.subscriptionType === 'monthly' ? 'Mesečni ($99/mes)' : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider mb-1">Ističe</p>
                      <p className="font-medium">{viewingBusiness.expiresAt || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider mb-1">ID</p>
                      <p className="font-mono text-sm">{viewingBusiness.id}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">Kontakt podaci</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{viewingBusiness.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => {
                    setViewingBusiness(null);
                    setEditingBusiness(viewingBusiness);
                  }}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Uredi
                </button>
                <button
                  onClick={() => setViewingBusiness(null)}
                  className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-secondary transition-colors"
                >
                  Zatvori
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal za uređivanje biznisa */}
        {editingBusiness && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingBusiness(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Uredi biznis</h3>
                  <button 
                    onClick={() => setEditingBusiness(null)}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-muted mb-2">Naziv kompanije</label>
                  <input
                    type="text"
                    value={editingBusiness.companyName}
                    onChange={(e) => setEditingBusiness({...editingBusiness, companyName: e.target.value})}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted mb-2">Email</label>
                    <input
                      type="email"
                      value={editingBusiness.email}
                      onChange={(e) => setEditingBusiness({...editingBusiness, email: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-2">Telefon</label>
                    <input
                      type="text"
                      value={editingBusiness.phone || ''}
                      onChange={(e) => setEditingBusiness({...editingBusiness, phone: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary"
                      placeholder="+381..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted mb-2">Website</label>
                    <input
                      type="url"
                      value={editingBusiness.website || ''}
                      onChange={(e) => setEditingBusiness({...editingBusiness, website: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-2">Industrija</label>
                    <input
                      type="text"
                      value={editingBusiness.industry || ''}
                      onChange={(e) => setEditingBusiness({...editingBusiness, industry: e.target.value})}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                      placeholder="npr. Tech, Fashion..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2">Opis kompanije</label>
                  <textarea
                    value={editingBusiness.description || ''}
                    onChange={(e) => setEditingBusiness({...editingBusiness, description: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary resize-none"
                    placeholder="Kratak opis kompanije..."
                  />
                </div>

                <div className="pt-4 mt-2 border-t border-border">
                  <p className="text-xs text-muted uppercase tracking-wider mb-3">Pretplata i pristup</p>
                  
                  {/* Status prikaz i akcija */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-muted">Status naloga</label>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        editingBusiness.subscriptionStatus === 'deactivated' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {editingBusiness.subscriptionStatus === 'deactivated' ? 'Deaktiviran' : 'Aktivan'}
                      </span>
                    </div>
                    {editingBusiness.subscriptionStatus === 'deactivated' ? (
                      <button
                        type="button"
                        onClick={() => setEditingBusiness({...editingBusiness, subscriptionStatus: 'active'})}
                        className="w-full py-3 border border-green-500 text-green-600 rounded-xl hover:bg-green-50 transition-colors text-sm font-medium"
                      >
                        Aktiviraj nalog
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeactivatingBusiness(editingBusiness)}
                        className="w-full py-3 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium"
                      >
                        Deaktiviraj nalog
                      </button>
                    )}
                  </div>

                  {/* Info polja - samo za čitanje */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-secondary/50 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-muted mb-1">Tip pretplate</p>
                      <p className="font-medium">
                        {editingBusiness.subscriptionType === 'yearly' ? 'Godišnji' : 
                         editingBusiness.subscriptionType === 'monthly' ? 'Mesečni' : 
                         'Nije aktivna'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Datum početka</p>
                      <p className="font-medium">
                        {editingBusiness.subscribedAt 
                          ? new Date(editingBusiness.subscribedAt).toLocaleDateString('sr-RS')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Datum isteka</p>
                      <p className="font-medium">
                        {editingBusiness.expiresAt 
                          ? new Date(editingBusiness.expiresAt).toLocaleDateString('sr-RS')
                          : '—'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Cancel Subscription Button - uvek vidljivo dok postoji Stripe pretplata */}
                  {editingBusiness.stripeSubscriptionId && (
                    <div className="mt-4 pt-4 border-t border-amber-200 bg-amber-50 -mx-6 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-800">Otkaži Stripe pretplatu</p>
                          <p className="text-xs text-amber-600">Ovo će odmah otkazati automatsku naplatu</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCancellingSubscription(editingBusiness)}
                          className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                        >
                          Otkaži pretplatu
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset Password Section */}
                <div className="pt-4 mt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Resetuj lozinku</p>
                      <p className="text-xs text-muted">Pošalji link za reset lozinke na email biznisa</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/admin/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: editingBusiness.email }),
                          });
                          if (response.ok) {
                            alert(`Link za reset lozinke je poslat na ${editingBusiness.email}`);
                          } else {
                            alert('Greška pri slanju reset linka');
                          }
                        } catch (error) {
                          alert('Greška pri slanju reset linka');
                        }
                      }}
                      className="px-4 py-2 text-sm border border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="hidden sm:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Pošalji reset link
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => handleSaveBusiness(editingBusiness)}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  Sačuvaj izmene
                </button>
                <button
                  onClick={() => setEditingBusiness(null)}
                  className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-secondary transition-colors"
                >
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio image preview (upload / static images) */}
        {viewingPortfolioItem && (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
            onClick={() => setViewingPortfolioItem(null)}
          >
            <button
              onClick={() => setViewingPortfolioItem(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div 
              className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {viewingPortfolioItem.url && (
                <Image 
                  src={viewingPortfolioItem.thumbnail || viewingPortfolioItem.url} 
                  alt="Portfolio" 
                  fill 
                  className="object-contain"
                />
              )}
            </div>

            {viewingPortfolioItem.description && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-xl p-4 max-w-2xl mx-auto">
                <p className="text-white text-sm">
                  {viewingPortfolioItem.platform && (
                    <span className="font-medium uppercase text-xs text-white/70 block mb-1">
                      {viewingPortfolioItem.platform}
                    </span>
                  )}
                  {viewingPortfolioItem.description}
                </p>
              </div>
            )}

            {viewingPortfolioItem.url && (
              <a
                href={normalizeExternalUrl(viewingPortfolioItem.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 text-white/80 text-xs underline hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                Otvori original
              </a>
            )}
          </div>
        )}

        {/* Portfolio video — YouTube embed / TikTok+IG open-on-platform (isto kao javni profil) */}
        <VideoPlayerModal
          isOpen={!!viewingPortfolioVideo}
          onClose={() => setViewingPortfolioVideo(null)}
          videoUrl={viewingPortfolioVideo?.url || ''}
          videoType={getPortfolioVideoType(viewingPortfolioVideo || {})}
          originalUrl={viewingPortfolioVideo?.url}
          description={viewingPortfolioVideo?.description}
        />
      </div>
    </div>
  );
}

// ============================================
// ADMIN JOBS TAB COMPONENT
// ============================================
interface AdminJobsTabProps {
  jobs: any[];
  setJobs: (jobs: any[]) => void;
  isLoading: boolean;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
}

function AdminJobsTab({ jobs, setJobs, isLoading, showAddModal, setShowAddModal }: AdminJobsTabProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [viewingJob, setViewingJob] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'open' | 'closed'>('all');
  
  // Pending jobs count for highlight
  const pendingJobsCount = jobs.filter(j => j.status === 'pending').length;
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    platforms: [] as string[],
    budgetType: 'fixed',
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
  
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      platforms: [],
      budgetType: 'fixed',
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
    
    setIsSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        platforms: formData.platforms,
        budgetType: formData.budgetType,
        budgetMin: formData.budgetMin ? parseInt(formData.budgetMin) : null,
        budgetMax: formData.budgetMax ? parseInt(formData.budgetMax) : null,
        duration: formData.duration || null,
        experienceLevel: formData.experienceLevel || null,
      };
      
      if (editingJob) {
        // Update existing job - using admin endpoint
        const response = await fetch('/api/admin/jobs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: editingJob.id, ...payload }),
        });
        
        if (response.ok) {
          setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, ...payload } : j));
        } else {
          const data = await response.json();
          alert(data.error || 'Greška pri čuvanju posla');
        }
      } else {
        // Admin creates job - using admin endpoint
        const response = await fetch('/api/admin/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (response.ok) {
          // Refetch all jobs (including pending for admin view)
          const refreshRes = await fetch('/api/jobs?includeAll=true');
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setJobs(data.jobs || []);
          }
        } else {
          const data = await response.json();
          alert(data.error || 'Greška pri kreiranju posla');
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
      const response = await fetch(`/api/admin/jobs?jobId=${jobId}`, { method: 'DELETE' });
      if (response.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
      } else {
        console.error('Failed to delete job:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
    setDeleteConfirmId(null);
  };
  
  const handleToggleStatus = async (job: any) => {
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, status: newStatus }),
      });
      if (response.ok) {
        setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
      } else {
        console.error('Failed to toggle job status:', await response.text());
      }
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  };
  
  // Approve or reject a pending job - using admin endpoint
  const handleApproveRejectJob = async (jobId: string, approve: boolean) => {
    const newStatus = approve ? 'open' : 'rejected';
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: newStatus }),
      });
      if (response.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
      } else {
        console.error('Failed to approve/reject job:', await response.text());
      }
    } catch (error) {
      console.error('Error approving/rejecting job:', error);
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
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">Čeka odobrenje</span>;
      case 'open':
        return <span className="px-3 py-1 text-xs bg-success/10 text-success rounded-full">Aktivan</span>;
      case 'in_progress':
        return <span className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-full">U toku</span>;
      case 'completed':
        return <span className="px-3 py-1 text-xs bg-secondary text-muted rounded-full">Završen</span>;
      case 'closed':
        return <span className="px-3 py-1 text-xs bg-muted/20 text-muted rounded-full">Zatvoren</span>;
      case 'rejected':
        return <span className="px-3 py-1 text-xs bg-error/10 text-error rounded-full">Odbijen</span>;
      default:
        return null;
    }
  };
  
  const filteredJobs = jobs.filter(job => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return job.status === 'pending';
    if (statusFilter === 'open') return job.status === 'open' || job.status === 'in_progress';
    if (statusFilter === 'closed') return job.status === 'closed' || job.status === 'completed' || job.status === 'rejected';
    return true;
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted">Učitavanje poslova...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-medium">Upravljanje poslovima</h2>
          <p className="text-sm text-muted">{jobs.length} poslova ukupno</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`px-4 py-2 border rounded-xl focus:outline-none focus:border-primary text-sm ${
              pendingJobsCount > 0 && statusFilter !== 'pending' ? 'border-amber-400 bg-amber-50' : 'border-border'
            }`}
          >
            <option value="all">Svi ({jobs.length})</option>
            <option value="pending">⏳ Čekaju odobrenje ({pendingJobsCount})</option>
            <option value="open">Aktivni ({jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length})</option>
            <option value="closed">Zatvoreni ({jobs.filter(j => j.status === 'closed' || j.status === 'completed' || j.status === 'rejected').length})</option>
          </select>
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="border border-border rounded-xl p-4 sm:p-5 hover:border-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-medium truncate">{job.title}</h3>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-sm text-muted">{job.businessName || 'Admin'} • {job.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium">{formatBudget(job)}</div>
                  <div className="text-xs text-muted">{job.budgetType === 'hourly' ? 'po satu' : 'fiksno'}</div>
                </div>
              </div>
              
              <p className="text-sm text-muted mb-3 line-clamp-2">{job.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {job.platforms?.map((platform: string) => (
                  <span key={platform} className="text-xs px-2.5 py-1 bg-secondary rounded-full">{platform}</span>
                ))}
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted">Kreirano: {formatDate(job.createdAt)}</span>
                <div className="flex items-center gap-2">
                  {/* Pending job - show approve/reject */}
                  {job.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleApproveRejectJob(job.id, true)}
                        className="text-xs px-3 py-1.5 bg-success text-white rounded-lg hover:bg-success/90 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Odobri
                      </button>
                      <button
                        onClick={() => handleApproveRejectJob(job.id, false)}
                        className="text-xs px-3 py-1.5 text-error hover:bg-error/10 border border-error/20 rounded-lg transition-colors"
                      >
                        Odbij
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleStatus(job)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          job.status === 'open' 
                            ? 'text-amber-600 hover:bg-amber-50 border border-amber-200'
                            : 'text-success hover:bg-success/10 border border-success/20'
                        }`}
                      >
                        {job.status === 'open' ? 'Zatvori' : 'Otvori'}
                      </button>
                      <button
                        onClick={() => setViewingJob(job)}
                        className="text-xs px-3 py-1.5 text-primary hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
                      >
                        Pogledaj
                      </button>
                    </>
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
        <div className="text-center py-12">
          <div className="text-4xl mb-4">💼</div>
          <p className="text-muted">
            {statusFilter === 'all' ? 'Nema postavljenih poslova' : 'Nema poslova sa ovim filterom'}
          </p>
        </div>
      )}

      {/* View Job Modal */}
      {viewingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-medium">Detalji posla</h2>
              <button
                onClick={() => setViewingJob(null)}
                className="p-2 hover:bg-secondary rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Title and Status */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-medium">{viewingJob.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    viewingJob.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    viewingJob.status === 'open' ? 'bg-success/10 text-success' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {viewingJob.status === 'pending' ? 'Čeka odobrenje' :
                     viewingJob.status === 'open' ? 'Aktivan' : 'Zatvoren'}
                  </span>
                </div>
                <p className="text-muted text-sm">
                  {viewingJob.businessName || 'Biznis'} • {viewingJob.category}
                </p>
              </div>
              
              {/* Budget */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <p className="text-sm text-muted mb-1">Budžet</p>
                <p className="text-xl font-medium">
                  {viewingJob.budgetMin && viewingJob.budgetMax 
                    ? `€${viewingJob.budgetMin} - €${viewingJob.budgetMax}`
                    : viewingJob.budgetMin 
                      ? `Od €${viewingJob.budgetMin}`
                      : 'Nije navedeno'
                  }
                  <span className="text-sm text-muted ml-2">
                    {viewingJob.budgetType === 'fixed' ? 'fiksno' : 'po satu'}
                  </span>
                </p>
              </div>
              
              {/* Description */}
              <div>
                <h4 className="font-medium mb-2">Opis posla</h4>
                <p className="text-foreground whitespace-pre-wrap">{viewingJob.description}</p>
              </div>
              
              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                {viewingJob.platforms?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted mb-2">Platforme</p>
                    <div className="flex flex-wrap gap-2">
                      {viewingJob.platforms.map((platform: string) => (
                        <span key={platform} className="px-3 py-1 bg-secondary rounded-full text-sm">
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {viewingJob.duration && (
                  <div>
                    <p className="text-sm text-muted mb-2">Trajanje</p>
                    <p className="font-medium">{viewingJob.duration}</p>
                  </div>
                )}
                {viewingJob.experienceLevel && (
                  <div>
                    <p className="text-sm text-muted mb-2">Nivo iskustva</p>
                    <p className="font-medium">{viewingJob.experienceLevel}</p>
                  </div>
                )}
              </div>
              
              {/* Date */}
              <div className="text-sm text-muted pt-4 border-t border-border">
                Kreirano: {new Date(viewingJob.createdAt).toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            
            {/* Footer with actions */}
            <div className="p-6 border-t border-border flex gap-3 justify-end">
              {viewingJob.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleDeleteJob(viewingJob.id);
                      setViewingJob(null);
                    }}
                    className="px-4 py-2 border border-error text-error rounded-xl hover:bg-error/5 transition-colors"
                  >
                    Odbij
                  </button>
                  <button
                    onClick={() => {
                      handleApproveRejectJob(viewingJob.id, true);
                      setViewingJob(null);
                    }}
                    className="px-4 py-2 bg-success text-white rounded-xl hover:bg-success/90 transition-colors"
                  >
                    Odobri
                  </button>
                </>
              )}
              <button
                onClick={() => setViewingJob(null)}
                className="px-6 py-2 border border-border rounded-xl hover:bg-secondary transition-colors"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

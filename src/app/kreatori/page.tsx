'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { categories, platforms, languages } from '@/lib/mockData';
import CreatorCard from '@/components/CreatorCard';
import CityAutocomplete, { City } from '@/components/CityAutocomplete';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';

interface Creator {
  id: string;
  name: string;
  photo: string | null;
  categories: string[];
  platforms: string[];
  languages: string[];
  location: string;
  cityId: number | null;
  bio: string;
  priceFrom: number;
  rating: number;
  totalReviews: number;
  profileViews: number;
  status: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  niches: string[];
  portfolio: any[];
  createdAt: string;
  approved?: boolean;
}

export default function KreatoriPage() {
  const { user, userData, creatorProfile, isLoading: authLoading } = useSupabaseUser();
  
  // State for creators from API
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine user type
  const userType = userData?.role || null;
  const isLoggedIn = !!user;
  const isAdmin = userType === 'admin';
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [priceRange, setPriceRange] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(true);
  // Lokacija (server-side filter)
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [includeNearby, setIncludeNearby] = useState<boolean>(false);


  // Fetch creators from API
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setIsLoadingCreators(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (isAdmin) {
          params.set('includeAll', 'true');
        }
        params.set('limit', '100'); // Get more creators

        // Lokacija: ili "okolina" (radius oko grada) ili tačan grad
        if (selectedCity && includeNearby) {
          params.set('nearLat', String(selectedCity.lat));
          params.set('nearLng', String(selectedCity.lng));
          params.set('radiusKm', '50');
        } else if (selectedCity) {
          params.set('cityId', String(selectedCity.id));
        }
        
        const response = await fetch(`/api/creators?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch creators');
        }
        
        const data = await response.json();
        setCreators(data.creators || []);
      } catch (err) {
        console.error('Error fetching creators:', err);
        setError('Greška pri učitavanju kreatora');
      } finally {
        setIsLoadingCreators(false);
      }
    };
    
    // Only fetch if logged in and auth is loaded
    if (!authLoading && isLoggedIn) {
      fetchCreators();
    }
  }, [authLoading, isLoggedIn, isAdmin, selectedCity, includeNearby]);
  
  // Hide filters on mobile by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowFilters(false);
      }
    };
    handleResize();
  }, []);

  const filteredCreators = useMemo(() => {
    let results = creators.filter((creator) => {
      // For non-admins, only show approved
      if (!isAdmin && creator.status !== 'approved') return false;
      
      if (selectedCategory && !creator.categories.includes(selectedCategory)) return false;
      if (selectedPlatform && !creator.platforms.includes(selectedPlatform)) return false;
      if (selectedLanguage && !creator.languages.includes(selectedLanguage)) return false;
      
      if (priceRange) {
        const [min, max] = priceRange.split('-').map(Number);
        if (max) {
          if (creator.priceFrom < min || creator.priceFrom > max) return false;
        } else {
          if (creator.priceFrom < min) return false;
        }
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !creator.name.toLowerCase().includes(query) &&
          !creator.bio.toLowerCase().includes(query) &&
          !creator.location.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      
      // Filter by minimum rating
      if (minRating) {
        const minRatingNum = parseFloat(minRating);
        if ((creator.rating || 0) < minRatingNum) return false;
      }

      return true;
    });
    
    // Sort results
    if (sortBy === 'rating-desc') {
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'rating-asc') {
      results.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    } else if (sortBy === 'reviews') {
      results.sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0));
    } else if (sortBy === 'price-asc') {
      results.sort((a, b) => a.priceFrom - b.priceFrom);
    } else if (sortBy === 'price-desc') {
      results.sort((a, b) => b.priceFrom - a.priceFrom);
    }
    
    return results;
  }, [creators, isAdmin, selectedCategory, selectedPlatform, selectedLanguage, priceRange, searchQuery, minRating, sortBy]);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedPlatform('');
    setSelectedLanguage('');
    setPriceRange('');
    setSearchQuery('');
    setMinRating('');
    setSortBy('');
    setSelectedCity(null);
    setIncludeNearby(false);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Učitavanje...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="max-w-md mx-auto px-6 text-center">
          <div className="bg-white rounded-3xl p-10 border border-border shadow-sm">
            <div className="text-5xl mb-6">🔒</div>
            <h1 className="text-2xl font-light mb-3">Pristup ograničen</h1>
            <p className="text-muted mb-8">
              Da bi pregledao kreatore, potrebno je da imaš nalog na platformi.
            </p>
            <div className="space-y-3">
              <Link 
                href="/login"
                className="block w-full py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Prijavi se
              </Link>
              <Link 
                href="/register/biznis"
                className="block w-full py-4 border border-border rounded-xl font-medium hover:bg-secondary transition-colors"
              >
                Registruj se kao brend
              </Link>
              <Link 
                href="/register/kreator"
                className="block w-full py-3 text-sm text-muted hover:text-foreground transition-colors"
              >
                Ili postani kreator →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If creator is pending or rejected, redirect to dashboard
  if (userType === 'creator' && creatorProfile) {
    if (creatorProfile.status === 'pending' || creatorProfile.status === 'rejected') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/30">
          <div className="max-w-md mx-auto px-6 text-center">
            <div className="bg-white rounded-3xl p-10 border border-border shadow-sm">
              <div className="text-5xl mb-6">⏳</div>
              <h1 className="text-2xl font-light mb-3">Profil na čekanju</h1>
              <p className="text-muted mb-8">
                Vaš profil još uvek nije odobren. Dok čekate odobrenje, ne možete pregledati druge kreatore.
              </p>
              <Link 
                href="/dashboard"
                className="block w-full py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Nazad na dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-secondary py-10 sm:py-12 lg:py-16">
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light mb-2 sm:mb-4">Pretraži kreatore</h1>
          <p className="text-muted text-sm sm:text-base max-w-xl">
            Pronađi savršenog UGC kreatora za tvoj brend
          </p>
        </div>
      </section>

      <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
        <div className="lg:flex lg:gap-12">
          {/* Mobile filter toggle */}
          <div className="lg:hidden mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {showFilters ? 'Sakrij filtere' : 'Prikaži filtere'}
            </button>
          </div>
          
          {/* Sidebar filters */}
          <aside className={`
            ${showFilters ? 'block' : 'hidden'} 
            w-full lg:w-64 
            flex-shrink-0 
            mb-8 lg:mb-0
            transition-all duration-300
          `}>
            <div className="w-full lg:w-64 lg:sticky lg:top-28 bg-white lg:bg-transparent p-4 lg:p-0 rounded-2xl lg:rounded-none border lg:border-0 border-border">
              {/* Search */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Pretraga</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ime, lokacija..."
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                />
              </div>

              {/* Grad (lokacija) */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Grad</label>
                <CityAutocomplete
                  value={selectedCity}
                  onChange={setSelectedCity}
                  placeholder="Svi gradovi"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted"
                />
                {selectedCity && (
                  <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeNearby}
                      onChange={(e) => setIncludeNearby(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Uključi okolinu (50km)</span>
                  </label>
                )}
              </div>

              {/* Category */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Kategorija</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted bg-white"
                >
                  <option value="">Sve kategorije</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Platform */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Platforma</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted bg-white"
                >
                  <option value="">Sve platforme</option>
                  {platforms.map((plat) => (
                    <option key={plat} value={plat}>{plat}</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Jezik</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted bg-white"
                >
                  <option value="">Svi jezici</option>
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Cenovni rang</label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted bg-white"
                >
                  <option value="">Svi cenovni rangovi</option>
                  <option value="0-100">Do €100</option>
                  <option value="100-200">€100 - €200</option>
                  <option value="200-300">€200 - €300</option>
                  <option value="300-">€300+</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div className="mb-8">
                <label className="text-sm text-muted mb-2 block">Minimalna ocena</label>
                <div className="relative">
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-muted bg-white appearance-none"
                  >
                    <option value="">Sve ocene</option>
                    <option value="5">5.0 ⭐</option>
                    <option value="4.5">4.5+ ⭐</option>
                    <option value="4">4.0+ ⭐</option>
                    <option value="3.5">3.5+ ⭐</option>
                    <option value="3">3.0+ ⭐</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {/* Rating preview with stars */}
                {minRating && (
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        viewBox="0 0 24 24"
                        fill={star <= parseFloat(minRating) ? '#f59e0b' : 'none'}
                        stroke={star <= parseFloat(minRating) ? '#f59e0b' : '#e5e5e5'}
                        strokeWidth={2}
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      </svg>
                    ))}
                    <span className="text-sm text-muted ml-1">{minRating}+</span>
                  </div>
                )}
              </div>

              {/* Clear filters */}
              <button
                onClick={clearFilters}
                className="w-full py-3 text-sm text-muted hover:text-foreground border border-border rounded-xl hover:bg-secondary transition-colors"
              >
                Očisti filtere
              </button>
              
              {/* Hide filters button - mobile only */}
              <button
                onClick={() => setShowFilters(false)}
                className="lg:hidden w-full mt-4 py-3 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
              >
                Primeni filtere
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Results count & sorting */}
            <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Filter toggle button - desktop only */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`hidden lg:flex p-2.5 rounded-xl border transition-all ${
                    showFilters 
                      ? 'bg-primary text-white border-primary' 
                      : 'bg-white text-muted border-border hover:bg-secondary hover:text-foreground'
                  }`}
                  title={showFilters ? 'Sakrij filtere' : 'Prikaži filtere'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
                <p className="text-muted text-sm sm:text-base">
                  Prikazano <span className="font-medium text-foreground">{filteredCreators.length}</span> kreatora
                </p>
              </div>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:border-muted bg-white text-sm"
              >
                <option value="">Sortiraj po</option>
                <option value="rating-desc">Najviša ocena</option>
                <option value="rating-asc">Najniža ocena</option>
                <option value="reviews">Najviše recenzija</option>
                <option value="price-asc">Cena: niska → visoka</option>
                <option value="price-desc">Cena: visoka → niska</option>
              </select>
            </div>

            {/* Loading state */}
            {isLoadingCreators && (
              <div className="text-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted">Učitavanje kreatora...</p>
              </div>
            )}

            {/* Error state */}
            {error && !isLoadingCreators && (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-xl font-medium mb-2">Greška</h3>
                <p className="text-muted mb-6">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-primary text-white rounded-full text-sm hover:bg-primary/90 transition-colors"
                >
                  Pokušaj ponovo
                </button>
              </div>
            )}

            {/* Grid */}
            {!isLoadingCreators && !error && filteredCreators.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {filteredCreators.map((creator) => (
                  <CreatorCard key={creator.id} creator={creator as any} userType={userType} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoadingCreators && !error && filteredCreators.length === 0 && (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-medium mb-2">Nema rezultata</h3>
                <p className="text-muted mb-6">Pokušaj sa drugim filterima</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-primary text-white rounded-full text-sm hover:bg-primary/90 transition-colors"
                >
                  Očisti filtere
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

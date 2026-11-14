import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Star, IndianRupee as Rupee, Calendar, Sliders, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Designer } from '../lib/supabase';

interface SearchFilters {
  query: string;
  location: string;
  specialization: string;
  minExperience: number;
  maxExperience: number;
  minRating: number;
  minBudget: number;
  maxBudget: number;
  services: string[];
  materials: string[];
  isVerified: boolean;
  sortBy: 'rating' | 'experience' | 'projects' | 'price';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedSearchProps {
  onResults: (designers: Designer[]) => void;
  onLoading: (loading: boolean) => void;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onResults, onLoading }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    location: '',
    specialization: '',
    minExperience: 0,
    maxExperience: 20,
    minRating: 0,
    minBudget: 0,
    maxBudget: 200000,
    services: [],
    materials: [],
    isVerified: false,
    sortBy: 'rating',
    sortOrder: 'desc'
  });

  const [availableOptions, setAvailableOptions] = useState({
    locations: [] as string[],
    specializations: [] as string[],
    services: [] as string[],
    materials: [] as string[]
  });

  useEffect(() => {
    fetchAvailableOptions();
    performSearch();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [filters]);

  const fetchAvailableOptions = async () => {
    try {
      const { data: designers, error } = await supabase
        .from('designers')
        .select('location, specialization, services, materials_expertise')
        .eq('is_active', true);

      if (error) throw error;

      const locations = [...new Set(designers?.map(d => d.location) || [])];
      const specializations = [...new Set(designers?.map(d => d.specialization) || [])];
      const services = [...new Set(designers?.flatMap(d => d.services || []) || [])];
      const materials = [...new Set(designers?.flatMap(d => d.materials_expertise || []) || [])];

      setAvailableOptions({
        locations: locations.sort(),
        specializations: specializations.sort(),
        services: services.sort(),
        materials: materials.sort()
      });
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const performSearch = async () => {
    try {
      onLoading(true);

      let query = supabase
        .from('designers')
        .select('id, name, specialization, experience, location, bio, website, starting_price, profile_image, portfolio_images, services, materials_expertise, awards, rating, total_reviews, total_projects, is_verified, is_active')
        .eq('is_active', true);

      // Apply filters
      if (filters.query) {
        query = query.or(`name.ilike.%${filters.query}%,bio.ilike.%${filters.query}%,specialization.ilike.%${filters.query}%`);
      }

      if (filters.location) {
        query = query.eq('location', filters.location);
      }

      if (filters.specialization) {
        query = query.eq('specialization', filters.specialization);
      }

      if (filters.minExperience > 0) {
        query = query.gte('experience', filters.minExperience);
      }

      if (filters.maxExperience < 20) {
        query = query.lte('experience', filters.maxExperience);
      }

      if (filters.minRating > 0) {
        query = query.gte('rating', filters.minRating);
      }

      if (filters.isVerified) {
        query = query.eq('is_verified', true);
      }

      // Apply sorting
      const sortColumn = filters.sortBy === 'projects' ? 'total_projects' : filters.sortBy;
      query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      // Client-side filtering for complex conditions
      if (filters.services.length > 0) {
        filteredData = filteredData.filter(designer =>
          filters.services.some(service => designer.services?.includes(service))
        );
      }

      if (filters.materials.length > 0) {
        filteredData = filteredData.filter(designer =>
          filters.materials.some(material => designer.materials_expertise?.includes(material))
        );
      }

      // Budget filtering (based on starting_price)
      if (filters.minBudget > 0 || filters.maxBudget < 200000) {
        filteredData = filteredData.filter(designer => {
          if (!designer.starting_price) return true;
          const price = parseInt(designer.starting_price.replace(/[₹,]/g, ''));
          return price >= filters.minBudget && price <= filters.maxBudget;
        });
      }

      onResults(filteredData);
    } catch (error) {
      console.error('Error performing search:', error);
      onResults([]);
    } finally {
      onLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleServiceToggle = (service: string) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleMaterialToggle = (material: string) => {
    setFilters(prev => ({
      ...prev,
      materials: prev.materials.includes(material)
        ? prev.materials.filter(m => m !== material)
        : [...prev.materials, material]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      location: '',
      specialization: '',
      minExperience: 0,
      maxExperience: 20,
      minRating: 0,
      minBudget: 0,
      maxBudget: 200000,
      services: [],
      materials: [],
      isVerified: false,
      sortBy: 'rating',
      sortOrder: 'desc'
    });
  };

  const activeFiltersCount = [
    filters.location,
    filters.specialization,
    filters.minExperience > 0,
    filters.maxExperience < 20,
    filters.minRating > 0,
    filters.minBudget > 0,
    filters.maxBudget < 200000,
    filters.services.length > 0,
    filters.materials.length > 0,
    filters.isVerified
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
      {/* Search Bar */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search designers by name, specialization, or keywords..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-colors ${
            showFilters || activeFiltersCount > 0
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="bg-white text-primary-500 px-2 py-1 rounded-full text-xs font-medium">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="border-t border-gray-200 pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-secondary-800">Advanced Filters</h3>
            <button
              onClick={clearFilters}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location
              </label>
              <select
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Locations</option>
                {availableOptions.locations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            {/* Specialization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialization
              </label>
              <select
                value={filters.specialization}
                onChange={(e) => handleFilterChange('specialization', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Specializations</option>
                {availableOptions.specializations.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <div className="flex space-x-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="rating">Rating</option>
                  <option value="experience">Experience</option>
                  <option value="projects">Projects</option>
                </select>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="desc">High to Low</option>
                  <option value="asc">Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Experience Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Experience (Years)
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="20"
                value={filters.minExperience}
                onChange={(e) => handleFilterChange('minExperience', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 w-16">
                {filters.minExperience}+ years
              </span>
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Star className="w-4 h-4 inline mr-1" />
              Minimum Rating
            </label>
            <div className="flex items-center space-x-2">
              {[0, 3, 4, 4.5].map(rating => (
                <button
                  key={rating}
                  onClick={() => handleFilterChange('minRating', rating)}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    filters.minRating === rating
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {rating === 0 ? 'Any' : `${rating}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Rupee className="w-4 h-4 inline mr-1" />
              Budget Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  placeholder="Min budget"
                  value={filters.minBudget || ''}
                  onChange={(e) => handleFilterChange('minBudget', parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max budget"
                  value={filters.maxBudget === 200000 ? '' : filters.maxBudget}
                  onChange={(e) => handleFilterChange('maxBudget', parseInt(e.target.value) || 200000)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Services Offered
            </label>
            <div className="flex flex-wrap gap-2">
              {availableOptions.services.map(service => (
                <button
                  key={service}
                  onClick={() => handleServiceToggle(service)}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    filters.services.includes(service)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          {/* Materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materials Expertise
            </label>
            <div className="flex flex-wrap gap-2">
              {availableOptions.materials.map(material => (
                <button
                  key={material}
                  onClick={() => handleMaterialToggle(material)}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    filters.materials.includes(material)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {material}
                </button>
              ))}
            </div>
          </div>

          {/* Verification */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.isVerified}
                onChange={(e) => handleFilterChange('isVerified', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show only verified designers
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Active filters:</span>
            {filters.location && (
              <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs flex items-center space-x-1">
                <span>Location: {filters.location}</span>
                <button onClick={() => handleFilterChange('location', '')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.specialization && (
              <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs flex items-center space-x-1">
                <span>{filters.specialization}</span>
                <button onClick={() => handleFilterChange('specialization', '')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.minRating > 0 && (
              <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs flex items-center space-x-1">
                <span>{filters.minRating}+ stars</span>
                <button onClick={() => handleFilterChange('minRating', 0)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.isVerified && (
              <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs flex items-center space-x-1">
                <span>Verified only</span>
                <button onClick={() => handleFilterChange('isVerified', false)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
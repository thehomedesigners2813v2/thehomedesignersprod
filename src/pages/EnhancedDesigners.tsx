import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, User, Award, Eye, Heart, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Designer } from '../lib/supabase';
import { formatDesignerArea } from '../lib/designerLocations';
import AdvancedSearch from '../components/AdvancedSearch';

const EnhancedDesigners = () => {
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteDesigners');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const handleSearchResults = (results: Designer[]) => {
    setDesigners(results);
  };

  const handleSearchLoading = (isLoading: boolean) => {
    setLoading(isLoading);
  };

  const toggleFavorite = (designerId: string) => {
    const newFavorites = favorites.includes(designerId)
      ? favorites.filter(id => id !== designerId)
      : [...favorites, designerId];
    
    setFavorites(newFavorites);
    localStorage.setItem('favoriteDesigners', JSON.stringify(newFavorites));
  };

  const shareDesigner = async (designer: Designer) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${designer.name} - Interior Designer`,
          text: `Check out ${designer.name}, a ${designer.specialization} designer in ${formatDesignerArea(designer.location, designer.sublocation)}`,
          url: `${window.location.origin}/designers/${designer.id}`
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/designers/${designer.id}`);
      // You could show a toast notification here
    }
  };

  if (loading && designers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading designers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-4">
            <p className="font-medium">Error loading designers</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-secondary-800 mb-4">
                Interior Designers
              </h1>
              <p className="text-lg text-gray-600">
                Discover talented interior designers across India. Find the perfect match for your project.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Advanced Search */}
        <AdvancedSearch 
          onResults={handleSearchResults}
          onLoading={handleSearchLoading}
        />

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {loading ? 'Searching...' : `Showing ${designers.length} designers`}
          </p>
          {favorites.length > 0 && (
            <Link
              to="/favorites"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center space-x-1"
            >
              <Heart className="w-4 h-4" />
              <span>{favorites.length} Favorites</span>
            </Link>
          )}
        </div>

        {/* Loading State */}
        {loading && designers.length > 0 && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        )}

        {/* Designers Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {designers.map((designer) => (
              <div key={designer.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="relative">
                  <img
                    src={designer.profile_image || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=400'}
                    alt={`${designer.name}'s profile`}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={() => toggleFavorite(designer.id)}
                      className={`p-2 rounded-full transition-colors ${
                        favorites.includes(designer.id)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/80 text-gray-600 hover:bg-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(designer.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => shareDesigner(designer)}
                      className="p-2 bg-white/80 text-gray-600 hover:bg-white rounded-full transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  {designer.is_verified && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                        <Award className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    {designer.profile_image ? (
                      <img
                        src={designer.profile_image}
                        alt={designer.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-secondary-800">
                        {designer.name}
                      </h3>
                      <p className="text-primary-600 font-medium text-sm">
                        {designer.specialization}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {designer.bio || 'Professional interior designer with expertise in creating beautiful spaces.'}
                  </p>

                  <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4" />
                      <span>{formatDesignerArea(designer.location, designer.sublocation)}</span>
                    </div>
                    <span>•</span>
                    <span>{designer.experience} years</span>
                    <span>•</span>
                    <span>{designer.total_projects} projects</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(designer.rating)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {designer.rating.toFixed(1)} ({designer.total_reviews})
                      </span>
                    </div>
                    {designer.starting_price && (
                      <div className="text-lg font-semibold text-secondary-800">
                        {designer.starting_price}
                      </div>
                    )}
                  </div>

                  {/* Services Preview */}
                  {designer.services && designer.services.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {designer.services.slice(0, 3).map((service, index) => (
                          <span key={index} className="bg-accent-100 text-accent-800 px-2 py-1 rounded-md text-xs">
                            {service}
                          </span>
                        ))}
                        {designer.services.length > 3 && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs">
                            +{designer.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Link
                      to={`/designers/${designer.id}`}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white text-center py-2 rounded-lg font-medium transition-colors"
                    >
                      View Profile
                    </Link>
                    <button className="bg-secondary-500 hover:bg-secondary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {designers.map((designer) => (
              <div key={designer.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-start space-x-6">
                  <div className="relative">
                    <img
                      src={designer.profile_image || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=400'}
                      alt={`${designer.name}'s profile`}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                    {designer.is_verified && (
                      <div className="absolute -top-2 -right-2">
                        <span className="bg-green-500 text-white p-1 rounded-full">
                          <Award className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-secondary-800 mb-1">
                          {designer.name}
                        </h3>
                        <p className="text-primary-600 font-medium mb-2">
                          {designer.specialization}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{formatDesignerArea(designer.location, designer.sublocation)}</span>
                          </div>
                          <span>•</span>
                          <span>{designer.experience} years experience</span>
                          <span>•</span>
                          <span>{designer.total_projects} projects completed</span>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2 max-w-2xl">
                          {designer.bio || 'Professional interior designer with expertise in creating beautiful spaces.'}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < Math.floor(designer.rating)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">
                            {designer.rating.toFixed(1)} ({designer.total_reviews})
                          </span>
                        </div>
                        {designer.starting_price && (
                          <div className="text-lg font-semibold text-secondary-800 mb-3">
                            {designer.starting_price}
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleFavorite(designer.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              favorites.includes(designer.id)
                                ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${favorites.includes(designer.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => shareDesigner(designer)}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/designers/${designer.id}`}
                            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    {designer.services && designer.services.length > 0 && (
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-2">
                          {designer.services.slice(0, 5).map((service, index) => (
                            <span key={index} className="bg-accent-100 text-accent-800 px-3 py-1 rounded-full text-xs">
                              {service}
                            </span>
                          ))}
                          {designer.services.length > 5 && (
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">
                              +{designer.services.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {designers.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">No designers found</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Try adjusting your search criteria or filters to find more designers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedDesigners;
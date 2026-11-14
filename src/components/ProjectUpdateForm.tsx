import React, { useState } from 'react';
import { Plus, X, Upload, Camera, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface ProjectUpdateFormProps {
  projectId: string;
  designerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProjectUpdateForm: React.FC<ProjectUpdateFormProps> = ({
  projectId,
  designerId,
  onSuccess,
  onCancel
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    update_type: 'progress_report',
    completion_percentage: 0,
    photos: [] as string[]
  });
  
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  const updateTypes = [
    { value: 'progress_report', label: 'Progress Report', icon: FileText },
    { value: 'photo_update', label: 'Photo Update', icon: Camera }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'completion_percentage') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Add new files to the existing array
    const newFiles = Array.from(files);
    setPhotoFiles(prev => [...prev, ...newFiles]);
    
    // Clear error when user adds photos
    if (error) setError(null);
  };
  
  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photoFiles.length === 0) return [];
    
    setUploadingPhotos(true);
    const photoUrls: string[] = [];
    
    try {
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        
        // Update progress
        setUploadProgress(Math.round((i / photoFiles.length) * 100));
        
        // Generate a unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id || 'anonymous'}/${fileName}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('project-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (error) throw error;
        
        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-images')
          .getPublicUrl(data.path);
        
        photoUrls.push(publicUrl);
      }
      
      setUploadProgress(100);
      return photoUrls;
    } catch (error: any) {
      console.error('Error uploading photos:', error);
      throw error;
    } finally {
      setUploadingPhotos(false);
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    
    if (formData.update_type === 'photo_update' && photoFiles.length === 0) {
      setError('Please upload at least one photo for a photo update');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First upload photos if any
      let photoUrls: string[] = [];
      if (photoFiles.length > 0) {
        photoUrls = await uploadPhotos();
      }
      
      // Then create the update record
      const { error } = await supabase
        .from('project_updates')
        .insert({
          project_id: projectId,
          designer_id: designerId,
          title: formData.title,
          description: formData.description,
          update_type: formData.update_type,
          photos: photoUrls,
          completion_percentage: formData.update_type === 'progress_report' ? formData.completion_percentage : null
        });
      
      if (error) throw error;
      
      setSuccess(true);
      
      // Reset form and notify parent after success
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating project update:', error);
      setError(error.message || 'Failed to create project update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-secondary-800 mb-4">Create Project Update</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 flex items-start space-x-2">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Update created successfully!</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Update Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Update Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {updateTypes.map(type => {
              const IconComponent = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, update_type: type.value }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                    formData.update_type === type.value
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="w-5 h-5 mb-1" />
                  <span className="text-sm">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="e.g., Week 2 Progress, Kitchen Cabinets Installed"
            required
          />
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Provide details about the progress, challenges, or next steps..."
          />
        </div>
        
        {/* Completion Percentage (only for progress reports) */}
        {formData.update_type === 'progress_report' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Completion Percentage: {formData.completion_percentage}%
            </label>
            <input
              type="range"
              name="completion_percentage"
              value={formData.completion_percentage}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="5"
              className="w-full"
            />
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-primary-500 h-2.5 rounded-full" 
                style={{ width: `${formData.completion_percentage}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos {formData.update_type === 'photo_update' && '*'}
          </label>
          
          {/* Photo Preview */}
          {photoFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {photoFiles.map((file, index) => (
                <div key={index} className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Upload Button */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-500 transition-colors">
            <input
              type="file"
              id="photo-upload"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              disabled={loading || uploadingPhotos}
            />
            <label
              htmlFor="photo-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500">PNG, JPG or JPEG (max. 5MB per file)</p>
            </label>
          </div>
          
          {uploadingPhotos && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Uploading photos...</span>
                <span className="text-xs font-medium text-gray-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-primary-500 h-1.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploadingPhotos}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Update</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectUpdateForm;
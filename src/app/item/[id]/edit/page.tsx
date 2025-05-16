"use client";
import { useEffect, useState, ChangeEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reportItemSchema, ReportItemFormData } from "@/lib/schemas";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Item, CategoryNames } from "@/types/database";

import Image from "next/image";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export default function EditItemPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  // Image state
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [aiLabels, setAiLabels] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [tfModel, setTfModel] = useState<cocoSsd.ObjectDetection | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    clearErrors,
  } = useForm<ReportItemFormData>({
    resolver: zodResolver(reportItemSchema),
    defaultValues: {
      status: 'lost',
      category: 'other',
      isUrgent: false,
      title: '',
      description: '',
      locationDescription: '',
      dateLostOrFound: '',
    },
  });

  const currentStatus = watch('status');

  // Load TensorFlow model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        setTfModel(model);
      } catch (error) {
        setServerError("AI features might be unavailable: Could not load image detection model.");
      }
    };
    loadModel();
  }, []);

  // Fetch item and user on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUserId(user.id);
      const { data, error } = await supabase.from("items").select("*").eq("id", itemId).single();
      if (error || !data) {
        setServerError("Item not found or you do not have permission to edit.");
        setLoading(false);
        return;
      }
      if (data.user_id !== user.id) {
        setServerError("You do not have permission to edit this item.");
        setLoading(false);
        return;
      }
      // Map category_id to category string key
      const idToCategoryKey = Object.entries(CategoryNames).reduce((acc, [key, _], idx) => {
        acc[idx + 1] = key; // Assumes category_id starts at 1 and increments
        return acc;
      }, {} as Record<number, string>);
      const categoryKey = data.category || idToCategoryKey[data.category_id] || 'other';
      setItem({ ...data, category: categoryKey });
      // Set existing images
      setExistingImageUrls(data.image_urls || []);
      // Set form values
      reset({
        ...data,
        status: data.status || 'lost',
        category: categoryKey,
        isUrgent: data.is_urgent || false,
        title: data.title || '',
        description: data.description || '',
        locationDescription: data.location_description || '',
        dateLostOrFound: data.date_lost_or_found || '',
      });
      setAiLabels(data.image_labels || []);
      setLoading(false);
    };
    fetchData();
  }, [itemId, reset, router, supabase]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setAiLabels([]);
    clearErrors("imageFile");
    if (event.target.files) {
      const files = Array.from(event.target.files).slice(0, 5 - existingImageUrls.length);
      setSelectedFiles(files);
      setImagePreviews(files.map(file => URL.createObjectURL(file)));
      // Optionally, run AI detection on the first image
      if (files[0] && tfModel) {
        setIsDetecting(true);
        try {
          const imgElement = document.createElement('img');
          imgElement.src = URL.createObjectURL(files[0]);
          await new Promise(resolve => imgElement.onload = resolve);
          const predictions = await tfModel.detect(imgElement);
          const labels = predictions.map(pred => pred.class);
          setAiLabels(Array.from(new Set(labels)));
        } catch (error) {
          setServerError("Failed to detect objects in image.");
          setAiLabels([]);
        } finally {
          setIsDetecting(false);
        }
      }
    } else {
      setImagePreviews([]);
      setSelectedFiles([]);
    }
  };

  const handleRemoveExistingImage = (url: string) => {
    setExistingImageUrls(existingImageUrls.filter(u => u !== url));
  };

  const onSubmit: SubmitHandler<ReportItemFormData> = async (data) => {
    setServerError(null);
    setSuccessMessage(null);
    if (!userId || !item) {
      setServerError("User not authenticated or item not loaded.");
      return;
    }
    let imageUrls: string[] = [...existingImageUrls];
    let uploadedFilePaths: string[] = [];
    // Upload new images if selected
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const fileName = `${userId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('item-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });
          if (uploadError) {
            setServerError("Failed to upload image: " + uploadError.message);
            return;
          }
          if (!uploadData || !uploadData.path) {
            setServerError("Failed to get image path after upload. Please try again.");
            return;
          }
          uploadedFilePaths.push(uploadData.path);
          const { data: urlData } = supabase.storage
            .from('item-images')
            .getPublicUrl(uploadData.path);
          if (!urlData || !urlData.publicUrl) {
            setServerError("Failed to retrieve image URL after upload. Please try again.");
            return;
          }
          imageUrls.push(urlData.publicUrl);
        } catch (e: any) {
          setServerError("Unexpected error during image upload: " + (e?.message || e));
          return;
        }
      }
    }
    // Convert category string to category_id
    let category_id: number | undefined;
    const categoryKeys = Object.keys(CategoryNames);
    const categoryIndex = categoryKeys.indexOf(data.category);
    if (categoryIndex !== -1) {
      category_id = categoryIndex + 1; // Assumes category_id starts at 1 and increments
    } else {
      // Fallback or error handling if category string is not found
      // For now, let's try to find it by value if it's a direct value from DB (though less likely here)
      const categoryValues = Object.values(CategoryNames);
      const valueIndex = categoryValues.indexOf(data.category as any); // Cast as any if data.category might be a direct DB value
      if (valueIndex !== -1) {
        category_id = categoryKeys.findIndex(key => CategoryNames[key as keyof typeof CategoryNames] === data.category) + 1;
      } else {
        setServerError(`Invalid category selected: ${data.category}. Please refresh and try again.`);
        return;
      }
    }

    // Prepare update data
    const updateData = {
      title: data.title,
      description: data.description,
      category_id: category_id, // Use category_id here
      location_description: data.locationDescription,
      date_lost_or_found: new Date(data.dateLostOrFound).toISOString(),
      status: data.status,
      is_urgent: data.isUrgent || false,
      image_urls: imageUrls,
      image_labels: aiLabels.length > 0 ? aiLabels : null,
    };
    // Update item
    const { error: updateError } = await supabase.from('items').update(updateData).eq('id', itemId);
    if (updateError) {
      setServerError(`Failed to update item: ${updateError.message}`);
      if (uploadedFilePaths.length > 0) {
        await supabase.storage.from('item-images').remove(uploadedFilePaths);
      }
    } else {
      setSuccessMessage('Item updated successfully!');
      setImagePreviews([]);
      setSelectedFiles([]);
      setAiLabels([]);
      router.push(`/item/${itemId}`);
    }
  };

  if (loading) {
    return <div className="text-center p-10">Loading item...</div>;
  }

  if (serverError) {
    return <div className="text-center p-10 text-red-500">{serverError}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Item</h1>
      {successMessage && <p className="text-green-500 bg-green-100 p-3 rounded mb-4">{successMessage}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Are you editing a...
          </label>
          <select
            id="status"
            {...register('status')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.status ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          >
            <option value={'lost'}>Lost Item</option>
            <option value={'found'}>Found Item</option>
          </select>
          {errors.status && <p className="mt-1 text-xs text-red-500">{errors.status.message}</p>}
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Item Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            {...register('title')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={4}
            className={`mt-1 block w-full px-3 py-2 border ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            {...register('category')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.category ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          >
            {Object.keys(CategoryNames).map((cat) => (
              <option key={cat} value={cat}>
                {CategoryNames[cat as keyof typeof CategoryNames]}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message?.toString()}</p>}
        </div>
        <div>
          <label htmlFor="locationDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="locationDescription"
            {...register('locationDescription')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.locationDescription ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.locationDescription && <p className="mt-1 text-xs text-red-500">{errors.locationDescription.message}</p>}
        </div>
        <div>
          <label htmlFor="dateLostOrFound" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date {currentStatus === 'lost' ? 'Lost' : 'Found'} <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="dateLostOrFound"
            {...register('dateLostOrFound')}
            className={`mt-1 block w-full px-3 py-2 border ${errors.dateLostOrFound ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.dateLostOrFound && <p className="mt-1 text-xs text-red-500">{errors.dateLostOrFound.message}</p>}
        </div>
        {/* Image Upload Field */}
        <div>
          <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Item Images (up to 5, max 5MB each, .jpg, .png, .webp)
          </label>
          <input
            type="file"
            id="imageFile"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageChange}
            className={`mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 dark:file:bg-gray-600 file:text-indigo-700 dark:file:text-indigo-200
              hover:file:bg-indigo-100 dark:hover:file:bg-gray-500
              ${errors.imageFile ? 'border-red-500 border rounded-md p-1' : ''}
            `}
          />
          {errors.imageFile && <p className="mt-1 text-xs text-red-500">{errors.imageFile.message?.toString()}</p>}
          {/* Existing images */}
          {existingImageUrls.length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {existingImageUrls.map((url, idx) => (
                <div key={idx} className="relative group">
                  <Image src={url} alt={`Existing image ${idx + 1}`} width={120} height={120} className="rounded-md object-cover" />
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-80 group-hover:opacity-100"
                    onClick={() => handleRemoveExistingImage(url)}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* New image previews */}
          {imagePreviews.length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {imagePreviews.map((src, idx) => (
                <Image key={idx} src={src} alt={`Image preview ${idx + 1}`} width={120} height={120} className="rounded-md object-cover" />
              ))}
            </div>
          )}
        </div>
        {/* AI Detected Labels */}
        {isDetecting && <p className="text-sm text-gray-600 dark:text-gray-400">Detecting objects in image...</p>}
        {aiLabels.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Detected Objects:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {aiLabels.map(label => (
                <span key={label} className="px-2 py-1 bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center">
          <input
            id="isUrgent"
            type="checkbox"
            {...register('isUrgent')}
            className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-700"
          />
          <label htmlFor="isUrgent" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
            Mark as Urgent (e.g., ID, Keys, Wallet)
          </label>
        </div>
        <div>
          <button
            type="submit"
            disabled={isSubmitting || isDetecting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Saving...' : (isDetecting ? 'Processing Image...' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
} 
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reportItemSchema, ReportItemFormData } from "@/lib/schemas";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CategoryNames } from "@/types/database";
import type { CategoryType, ItemStatus } from "@/types/database";
import Image from "next/image";

export default function ReportPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // State for image handling
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    clearErrors,
  } = useForm<ReportItemFormData>({
    resolver: zodResolver(reportItemSchema),
    defaultValues: {
      status: "lost" as ItemStatus,
      category: "other", // Default to 'other' category
      isUrgent: false,
      turnInToSecurity: false,
      title: "",
      description: "",
      locationDescription: "",
      dateLostOrFound: "",
    },
  });

  const currentStatus = watch("status");

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        router.push("/auth");
      }
    };
    getUser();
  }, [supabase, router]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearErrors("imageFile");
    if (event.target.files) {
      const files = Array.from(event.target.files).slice(0, 5);
      setSelectedFiles(files);
      setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    } else {
      setImagePreviews([]);
      setSelectedFiles([]);
    }
  };

  const getCategoryId = async (category: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id")
        .eq("name", category);

      if (error) {
        setServerError("Failed to get category ID: " + error.message);
        return 9; // Default to 'other' category ID (assuming it's 9)
      }

      if (!data || data.length === 0) {
        console.warn(`Category '${category}' not found, using default`);
        return 9; // Default to 'other' category ID
      }

      return data[0].id as number;
    } catch (err) {
      console.error("Error getting category ID:", err);
      return 9; // Default to 'other' category ID
    }
  };

  const onSubmit: SubmitHandler<ReportItemFormData> = async (data) => {
    setServerError(null);
    setSuccessMessage(null);

    if (!userId) {
      setServerError("User not authenticated. Please log in.");
      return;
    }

    const imageUrls: string[] = [];
    const uploadedFilePaths: string[] = [];

    // 1. Upload images if selected
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const fileName = `${userId}/${Date.now()}_${file.name.replace(
          /\s/g,
          "_"
        )}`;
        try {
          const { data: uploadData, error: uploadError } =
            await supabase.storage.from("item-images").upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
            });
          if (uploadError) {
            setServerError("Failed to upload image: " + uploadError.message);
            return;
          }
          if (!uploadData || !uploadData.path) {
            setServerError(
              "Failed to get image path after upload. Please try again."
            );
            return;
          }
          uploadedFilePaths.push(uploadData.path);
          const { data: urlData } = supabase.storage
            .from("item-images")
            .getPublicUrl(uploadData.path);
          if (!urlData || !urlData.publicUrl) {
            setServerError(
              "Failed to retrieve image URL after upload. Please try again."
            );
            return;
          }
          imageUrls.push(urlData.publicUrl);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setServerError("Unexpected error during image upload: " + msg);
          return;
        }
      }
    }

    // 2. Prepare data for Supabase `items` table
    const itemData = {
      user_id: userId,
      title: data.title,
      description: data.description,
      // Get category_id from categories table
      category_id: await getCategoryId(data.category),
      location_description: data.locationDescription,
      date_lost_or_found: new Date(
        data.dateLostOrFound as string
      ).toISOString(),
      status: data.status,
      is_urgent: data.isUrgent || false,
      turn_in_to_security: data.turnInToSecurity || false,
      image_urls: imageUrls,
    };

    // 3. Insert item data
    const { error: insertError } = await supabase
      .from("items")
      .insert(itemData);

    if (insertError) {
      setServerError(`Failed to report item: ${insertError.message}`);
      // If insert fails after image upload, consider deleting the uploaded images (cleanup)
      if (uploadedFilePaths.length > 0) {
        await supabase.storage.from("item-images").remove(uploadedFilePaths);
      }
    } else {
      setSuccessMessage("Item reported successfully!");
      reset();
      setImagePreviews([]);
      setSelectedFiles([]);
    }
  };

  if (!userId && !isSubmitting) {
    return <div className="text-center p-10">Loading user information...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Report an Item</h1>
      {serverError && (
        <p className="text-red-500 bg-red-100 p-3 rounded mb-4">
          {serverError}
        </p>
      )}
      {successMessage && (
        <p className="text-green-500 bg-green-100 p-3 rounded mb-4">
          {successMessage}
        </p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md"
      >
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Are you reporting a...
          </label>
          <select
            id="status"
            {...register("status")}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.status
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          >
            <option value={"lost"}>Lost Item</option>
            <option value={"found"}>Found Item</option>
          </select>
          {errors.status && (
            <p className="mt-1 text-xs text-red-500">{errors.status.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Item Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            {...register("title")}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.title
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            {...register("description")}
            rows={4}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.description
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            {...register("category")}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.category
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          >
            {Object.keys(CategoryNames).map((cat) => (
              <option key={cat} value={cat}>
                {CategoryNames[cat as CategoryType]}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-xs text-red-500">
              {errors.category.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="locationDescription"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Location Description (e.g., &quot;Near COE Library, 2nd Floor&quot;){" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="locationDescription"
            {...register("locationDescription")}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.locationDescription
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.locationDescription && (
            <p className="mt-1 text-xs text-red-500">
              {errors.locationDescription.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="dateLostOrFound"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Date {currentStatus === "lost" ? "Lost" : "Found"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="dateLostOrFound"
            {...register("dateLostOrFound")}
            className={`mt-1 block w-full px-3 py-2 border ${
              errors.dateLostOrFound
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`}
          />
          {errors.dateLostOrFound && (
            <p className="mt-1 text-xs text-red-500">
              {errors.dateLostOrFound.message}
            </p>
          )}
        </div>

        {/* Image Upload Field */}
        <div>
          <label
            htmlFor="imageFile"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
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
              ${errors.imageFile ? "border-red-500 border rounded-md p-1" : ""}
            `}
          />
          {errors.imageFile && (
            <p className="mt-1 text-xs text-red-500">
              {errors.imageFile.message?.toString()}
            </p>
          )}

          {imagePreviews.length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {imagePreviews.map((src, idx) => (
                <Image
                  key={idx}
                  src={src}
                  alt={`Image preview ${idx + 1}`}
                  width={120}
                  height={120}
                  className="rounded-md object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {currentStatus === "found" && (
          <div className="flex items-center">
            <input
              id="turnInToSecurity"
              type="checkbox"
              {...register("turnInToSecurity")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="turnInToSecurity"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              I will turn this item in to the Lost and Found desk.
            </label>
          </div>
        )}

        <div className="flex items-center">
          <input
            id="isUrgent"
            type="checkbox"
            {...register("isUrgent")}
            className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-700"
          />
          <label
            htmlFor="isUrgent"
            className="ml-2 block text-sm text-gray-900 dark:text-gray-200"
          >
            Mark as Urgent (e.g., ID, Keys, Wallet)
          </label>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isSubmitting ? "Submitting..." : "Report Item"}
          </button>
        </div>
      </form>
    </div>
  );
}

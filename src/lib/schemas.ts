import { z } from 'zod';
import { CategoryNames, ItemStatusValues } from '@/types/database';
import type { ItemStatus } from '@/types/database';

// Max file size (e.g., 5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Allowed image types
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const reportItemSchema = z.object({
  status: z.enum(ItemStatusValues as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Please select if the item is lost or found.' }),
  }),
  title: z.string()
    .max(150, "Title cannot exceed 150 characters."),
  description: z.string()
    .min(10, "Description must be at least 10 characters long.")
    .max(1000, "Description cannot exceed 1000 characters."),
  category: z.string()
    .min(1, "Please select a category.")
    .refine(category => Object.keys(CategoryNames).includes(category), {
      message: "Please select a valid category."
    }),
  locationDescription: z.string()
    .min(5, "Location description must be at least 5 characters long.")
    .max(255, "Location description cannot exceed 255 characters."),
  dateLostOrFound: z.string()
    .refine((date) => date.length > 0, { 
      message: "Please select a valid date." 
    }),
  isUrgent: z.boolean().optional(),
  imageFile: z
    .any()
    .optional()
    .refine(
      (files) => {
        if (!files) return true;
        if (typeof FileList !== 'undefined' && files instanceof FileList) {
          return files.length === 0 || files[0]?.size <= MAX_FILE_SIZE;
        }
        return true;
      },
      `Max image size is 5MB.`
    )
    .refine(
      (files) => {
        if (!files) return true;
        if (typeof FileList !== 'undefined' && files instanceof FileList) {
          return files.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files[0]?.type);
        }
        return true;
      },
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
});

// This creates a TypeScript type from the Zod schema
export type ReportItemFormData = z.infer<typeof reportItemSchema>; 
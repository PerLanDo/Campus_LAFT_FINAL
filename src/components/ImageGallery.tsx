"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageGalleryProps {
  primaryImage?: string;
  images: string[];
  itemTitle: string;
}

export default function ImageGallery({ primaryImage, images, itemTitle }: ImageGalleryProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Use primaryImage if available, otherwise use the first image from images array
  const mainImage = primaryImage || (images.length > 0 ? images[0] : "");
  // For thumbnails, if primaryImage is used, show remaining images; otherwise, show all images starting from the second
  const thumbnailImages = primaryImage ? images : images.slice(1);

  const openFullScreen = (index: number) => {
    setCurrentImageIndex(index);
    setIsFullScreen(true);
  };

  const closeFullScreen = () => {
    setIsFullScreen(false);
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => 
      prev > 0 ? prev - 1 : (primaryImage ? images.length : images.length - 1)
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => 
      prev < (primaryImage ? images.length : images.length - 1) ? prev + 1 : 0
    );
  };

  const currentFullScreenImage = primaryImage 
    ? (currentImageIndex === 0 ? primaryImage : images[currentImageIndex - 1])
    : images[currentImageIndex];

  return (
    <div className="image-gallery">
      {/* Main Image */}
      <div 
        className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-700 cursor-pointer"
        onClick={() => openFullScreen(0)}
        role="button"
        aria-label={`View full-screen image of ${itemTitle}`}
      >
        {mainImage ? (
          <Image
            src={mainImage}
            alt={`${itemTitle} - Main Image`}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 33vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {thumbnailImages.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {thumbnailImages.slice(0, 4).map((url, idx) => (
            <div 
              key={idx} 
              className="relative aspect-square rounded-md overflow-hidden shadow-md hover:opacity-80 transition-opacity cursor-pointer"
              onClick={() => openFullScreen(primaryImage ? idx + 1 : idx + 1)}
              role="button"
              aria-label={`View full-screen image ${idx + 2} of ${itemTitle}`}
            >
              <Image
                src={url}
                alt={`${itemTitle} - Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="8vw"
              />
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Modal */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center p-4 overflow-hidden">
          <button 
            onClick={closeFullScreen} 
            className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none z-10"
            aria-label="Close full-screen view"
          >
            <X size={32} />
          </button>

          <div className="relative w-full h-5/6 flex items-center justify-center">
            {currentFullScreenImage ? (
              <Image
                src={currentFullScreenImage}
                alt={`${itemTitle} - Full Screen`}
                layout="fill"
                objectFit="contain"
                className="rounded-lg"
                priority
              />
            ) : (
              <div className="text-white text-center flex items-center justify-center h-full">
                <p>Image not available</p>
              </div>
            )}
          </div>

          {(primaryImage ? images.length > 0 : images.length > 1) && (
            <>
              <button 
                onClick={goToPrevious} 
                className="absolute left-4 text-white hover:text-gray-300 focus:outline-none z-10"
                aria-label="Previous image"
              >
                <ChevronLeft size={48} />
              </button>
              <button 
                onClick={goToNext} 
                className="absolute right-4 text-white hover:text-gray-300 focus:outline-none z-10"
                aria-label="Next image"
              >
                <ChevronRight size={48} />
              </button>
              <div className="absolute bottom-4 text-white text-sm z-10">
                {currentImageIndex + 1} / {primaryImage ? images.length + 1 : images.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

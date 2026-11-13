"use client"

import React, { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { UploadCloud, X, Star, Link as LinkIcon, Plus, ArrowLeft, ArrowRight, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface ProductImageItem {
  url: string
  alt?: string
  width?: number
  height?: number
}

interface ProductImageDropzoneProps {
  images: ProductImageItem[]
  onChange: (images: ProductImageItem[]) => void
  productName?: string
  maxImages?: number
}

export function ProductImageDropzone({
  images,
  onChange,
  productName = "Product",
  maxImages = 8,
}: ProductImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Process dropped or selected files
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))

      if (fileArray.length === 0) {
        toast.error("Please drop or select valid image files (PNG, JPG, WEBP, SVG)")
        return
      }

      if (images.length + fileArray.length > maxImages) {
        toast.error(`You can upload a maximum of ${maxImages} images per product`)
        return
      }

      const readers = fileArray.map(
        (file) =>
          new Promise<ProductImageItem>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result === "string") {
                resolve({
                  url: reader.result,
                  alt: `${productName} - ${file.name.replace(/\.[^/.]+$/, "")}`,
                  width: 800,
                  height: 800,
                })
              } else {
                reject(new Error("Failed to read file"))
              }
            }
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
      )

      Promise.all(readers)
        .then((newImages) => {
          onChange([...images, ...newImages])
          toast.success(`Added ${newImages.length} image${newImages.length > 1 ? "s" : ""}!`)
        })
        .catch((err) => {
          console.error(err)
          toast.error("Error reading image files")
        })
    },
    [images, maxImages, onChange, productName]
  )

  // Drag handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only deactivate if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  // Handle URL Add
  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = urlInput.trim()
    if (!trimmed) return

    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
      toast.error("Please enter a valid image URL starting with http://, https:// or /")
      return
    }

    if (images.length >= maxImages) {
      toast.error(`Maximum of ${maxImages} images allowed`)
      return
    }

    onChange([
      ...images,
      {
        url: trimmed,
        alt: `${productName} image ${images.length + 1}`,
        width: 800,
        height: 800,
      },
    ])
    setUrlInput("")
    setShowUrlInput(false)
    toast.success("Image URL added!")
  }

  // Remove image
  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index)
    onChange(updated)
  }

  // Set image as Primary / Cover (move to index 0)
  const handleSetPrimary = (index: number) => {
    if (index === 0) return
    const target = images[index]
    const remaining = images.filter((_, i) => i !== index)
    onChange([target, ...remaining])
    toast.success("Set as primary cover image!")
  }

  // Move left / right
  const handleMove = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= images.length) return
    const updated = [...images]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-black">
          Product Images & Media ({images.length}/{maxImages})
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-semibold text-black/70 hover:text-black hover:underline flex items-center gap-1 cursor-pointer"
        >
          <LinkIcon className="size-3" />
          <span>{showUrlInput ? "Hide URL input" : "Add by Image URL"}</span>
        </button>
      </div>

      {/* Optional URL Input */}
      {showUrlInput && (
        <div className="flex items-center gap-2 p-3 bg-[#F0EEED]/60 rounded-xl border border-black/10">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image URL (e.g. https://... or /images/products/...)"
            className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-black/85 cursor-pointer"
          >
            Add URL
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer select-none",
          isDragging
            ? "border-black bg-black/5 scale-[1.01]"
            : "border-black/20 bg-[#F0EEED]/30 hover:border-black/40 hover:bg-[#F0EEED]/60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              processFiles(e.target.files)
            }
          }}
        />

        <div className="size-12 rounded-full bg-white flex items-center justify-center shadow-xs border border-black/10 mb-3 text-black">
          <UploadCloud className={cn("size-6 transition-transform", isDragging && "scale-110")} />
        </div>

        <p className="text-xs font-bold text-black">
          {isDragging ? "Drop images right here..." : "Drag & drop product images here, or browse"}
        </p>
        <p className="text-[11px] text-black/50 mt-1">
          Supports JPG, PNG, WEBP, SVG • Drag multiple files at once
        </p>

        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-bold text-black shadow-2xs hover:bg-black hover:text-white transition-colors">
          <Plus className="size-3" />
          <span>Select from Computer</span>
        </span>
      </div>

      {/* Gallery Cards Grid */}
      {images.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-black/60 font-medium">
            <span>Uploaded Gallery (First image is store cover)</span>
            <span>{images.length} image{images.length > 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={`${img.url}-${idx}`}
                className={cn(
                  "group relative aspect-square rounded-xl overflow-hidden border bg-white shadow-2xs flex flex-col justify-between p-1.5 transition-all",
                  idx === 0 ? "border-black ring-2 ring-black/10" : "border-black/10 hover:border-black/30"
                )}
              >
                {/* Thumbnail Image */}
                <div className="relative size-full rounded-lg overflow-hidden bg-[#F0EEED]">
                  <Image
                    src={img.url}
                    alt={img.alt || `Product image ${idx + 1}`}
                    fill
                    unoptimized={img.url.startsWith("data:")}
                    className="object-cover"
                  />
                </div>

                {/* Primary Badge */}
                {idx === 0 ? (
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                    <Star className="size-2.5 fill-yellow-400 text-yellow-400" />
                    <span>Cover</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSetPrimary(idx)
                    }}
                    title="Set as main cover"
                    className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold text-black shadow-xs hover:bg-black hover:text-white cursor-pointer"
                  >
                    Set Cover
                  </button>
                )}

                {/* Top Right: Delete Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveImage(idx)
                  }}
                  title="Remove image"
                  className="absolute top-2.5 right-2.5 size-6 rounded-full bg-white/90 hover:bg-red-600 hover:text-white text-black/70 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>

                {/* Bottom Bar: Move Left / Right Controls */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity px-1">
                  {idx > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMove(idx, "left")
                      }}
                      title="Move left"
                      className="size-5 rounded-full bg-white/95 text-black hover:bg-black hover:text-white flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <ArrowLeft className="size-3" />
                    </button>
                  ) : <div />}

                  {idx < images.length - 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMove(idx, "right")
                      }}
                      title="Move right"
                      className="size-5 rounded-full bg-white/95 text-black hover:bg-black hover:text-white flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <ArrowRight className="size-3" />
                    </button>
                  ) : <div />}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
          <ImageIcon className="size-4 shrink-0" />
          <span>No image attached yet. Drag & drop or browse an image file to display on the storefront.</span>
        </div>
      )}
    </div>
  )
}


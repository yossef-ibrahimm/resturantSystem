import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n";
import { uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Link as LinkIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ImageSource =
  | { type: "url"; value: string }
  | { type: "file"; file: File; previewUrl: string }
  | null;

interface ImageUploaderProps {
  label?: string;
  initialUrl?: string;
  onChange: (url: string | null) => void;
  className?: string;
  maxFileSizeMB?: number;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_SIZE_MB = 5;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ImageUploader({
  label,
  initialUrl,
  onChange,
  className,
  maxFileSizeMB = DEFAULT_MAX_SIZE_MB,
}: ImageUploaderProps) {
  const { isArabic } = useLanguage();
  const [source, setSource] = useState<ImageSource>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlInput, setUrlInput] = useState(initialUrl || "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"drop" | "url">("drop");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    return () => {
      if (source?.type === "file") {
        URL.revokeObjectURL(source.previewUrl);
      }
    };
  }, [source]);

  const revokePreview = useCallback(() => {
    if (source?.type === "file") {
      URL.revokeObjectURL(source.previewUrl);
    }
  }, [source]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return isArabic
          ? "صيغة الملف غير مدعومة. يُسمح فقط بـ JPG، PNG، WEBP"
          : "Unsupported file type. Only JPG, PNG, WEBP are allowed";
      }
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        return isArabic
          ? `حجم الملف يتجاوز الحد الأقصى ${maxFileSizeMB} ميغابايت`
          : `File size exceeds the ${maxFileSizeMB} MB limit`;
      }
      return null;
    },
    [isArabic, maxFileSizeMB]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      revokePreview();
      const previewUrl = URL.createObjectURL(file);
      setSource({ type: "file", file, previewUrl });
      setUploading(true);

      try {
        const { url } = await uploadImage(file);
        onChange(url);
      } catch {
        toast.error(isArabic ? "فشل رفع الصورة" : "Failed to upload image");
        setSource(null);
        URL.revokeObjectURL(previewUrl);
      } finally {
        setUploading(false);
      }
    },
    [validateFile, revokePreview, onChange, isArabic]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile]
  );

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError(isArabic ? "الرجاء إدخال رابط الصورة" : "Please enter an image URL");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setUrlError(isArabic ? "رابط غير صالح" : "Invalid URL");
      return;
    }
    setUrlError(null);
    revokePreview();
    setSource({ type: "url", value: trimmed });
    onChange(trimmed);
  }, [urlInput, isArabic, revokePreview, onChange]);

  const handleUrlChange = useCallback((val: string) => {
    setUrlInput(val);
    setUrlError(null);
  }, []);

  const removeImage = useCallback(() => {
    revokePreview();
    setSource(null);
    setUrlInput("");
    setUrlError(null);
    onChange(null);
  }, [revokePreview, onChange]);

  const replaceImage = useCallback(() => {
    revokePreview();
    setSource(null);
    setUrlInput("");
    setUrlError(null);
    onChange(null);
  }, [revokePreview, onChange]);

  const previewUrl = source?.type === "file" ? source.previewUrl : source?.type === "url" ? source.value : null;

  return (
    <div className={className}>
      <Label className="block mb-2">{label || (isArabic ? "صورة الطبق" : "Item Image")}</Label>

      {previewUrl ? (
        <div className="space-y-3">
          <div className="relative rounded-lg border border-border overflow-hidden bg-muted">
            <img
              src={previewUrl}
              alt={isArabic ? "معاينة الصورة" : "Image preview"}
              className="w-full h-48 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            {uploading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span className="ms-2 text-sm font-medium">
                  {isArabic ? "جاري الرفع..." : "Uploading..."}
                </span>
              </div>
            )}
          </div>

          {source?.type === "file" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{source.file.name}</span>
              <span className="flex-shrink-0">{formatFileSize(source.file.size)}</span>
            </div>
          )}

          {source?.type === "url" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LinkIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate" dir="ltr">{source.value}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={replaceImage}
              disabled={uploading}
            >
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              {isArabic ? "استبدال" : "Replace"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={removeImage}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              {isArabic ? "إزالة" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "drop"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("drop")}
            >
              <Upload className="h-4 w-4 me-1.5 inline-block" />
              {isArabic ? "رفع ملف" : "Upload File"}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "url"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("url")}
            >
              <LinkIcon className="h-4 w-4 me-1.5 inline-block" />
              {isArabic ? "رابط الصورة" : "Image URL"}
            </button>
          </div>

          {activeTab === "drop" ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={isArabic ? "اسحب وأفلت صورة هنا أو اضغط لاختيار ملف" : "Drag and drop an image here or click to browse"}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Upload
                className={`h-8 w-8 mb-3 transition-colors ${
                  dragging ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <p className="text-sm font-medium mb-1">
                {dragging
                  ? isArabic
                    ? "أفلت الصورة هنا"
                    : "Drop image here"
                  : isArabic
                    ? "اسحب وأفلت صورة هنا"
                    : "Drag & drop your image here"}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {isArabic ? "أو" : "or"}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <ImageIcon className="h-4 w-4 me-1.5" />
                {isArabic ? "اختيار ملف" : "Browse Files"}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                {isArabic
                  ? `JPG، PNG، WEBP — حتى ${maxFileSizeMB} ميغابايت`
                  : `JPG, PNG, WEBP — up to ${maxFileSizeMB} MB`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="url"
                  dir="ltr"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUrlSubmit();
                    }
                  }}
                  className="flex-1"
                />
                <Button type="button" variant="secondary" onClick={handleUrlSubmit}>
                  {isArabic ? "تطبيق" : "Apply"}
                </Button>
              </div>
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}
    </div>
  );
}

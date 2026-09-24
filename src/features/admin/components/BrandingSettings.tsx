import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/i18n";
import { useSettingsQuery, useUpdateSettingsMutation, useResetSettingsMutation } from "@/hooks/useSettings";
import { uploadImage, seedTables } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Palette, Upload, Globe, Phone, Save, RotateCcw, X, Receipt, Grid3X3
} from "lucide-react";
import { toast } from "sonner";

const settingsSchema = z.object({
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  logoUrl: z.string().nullable(),
  menuBackgroundUrl: z.string().nullable(),
  primaryColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).nullable().or(z.literal("")),
  secondaryColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).nullable().or(z.literal("")),
  backgroundColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).nullable().or(z.literal("")),
  contactPhone: z.string().nullable(),
  contactAddress: z.string().nullable(),
  workingHours: z.string().nullable(),
  facebookUrl: z.string().url().nullable().or(z.literal("")),
  instagramUrl: z.string().url().nullable().or(z.literal("")),
  tiktokUrl: z.string().url().nullable().or(z.literal("")),
  whatsappNumber: z.string().nullable(),
  taxEnabled: z.boolean(),
  taxRate: z.number().min(0).max(1),
  serviceEnabled: z.boolean(),
  serviceRate: z.number().min(0).max(1),
  totalTables: z.number().min(0).max(500),
  tableNumberStart: z.number().min(1).max(500),
  tableNumberEnd: z.number().min(1).max(500),
  staleThresholdMinutes: z.number().min(1).max(480),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

function ImageUpload({
  label,
  currentUrl,
  onUpload,
  onRemove,
}: {
  label: string;
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}) {
  const { isArabic } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onUpload(url);
    } catch {
      toast.error(isArabic ? "فشل رفع الصورة" : "Failed to upload image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {currentUrl ? (
        <div className="relative group w-full max-w-xs">
          <img
            src={currentUrl}
            alt={label}
            className="h-32 w-full rounded-lg object-cover border border-border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full max-w-xs items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
          disabled={uploading}
        >
          <div className="text-center">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {uploading
                ? isArabic ? "جاري الرفع..." : "Uploading..."
                : isArabic ? "اضغط لرفع صورة" : "Click to upload"}
            </p>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  const { isArabic } = useLanguage();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || "#2E7D32"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 rounded-lg border border-border cursor-pointer"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="#2E7D32"
          className="flex-1 max-w-[140px] font-mono text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {isArabic ? "إعادة تعيين" : "Reset"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function BrandingSettings() {
  const { isArabic } = useLanguage();
  const { data: settings, isLoading } = useSettingsQuery();
  const updateMutation = useUpdateSettingsMutation();
  const resetMutation = useResetSettingsMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        nameAr: settings.nameAr,
        nameEn: settings.nameEn,
        logoUrl: settings.logoUrl,
        menuBackgroundUrl: settings.menuBackgroundUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        backgroundColor: settings.backgroundColor,
        contactPhone: settings.contactPhone,
        contactAddress: settings.contactAddress,
        workingHours: settings.workingHours,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        tiktokUrl: settings.tiktokUrl,
        whatsappNumber: settings.whatsappNumber,
        taxEnabled: settings.taxEnabled ?? false,
        taxRate: Number(settings.taxRate) || 0,
        serviceEnabled: settings.serviceEnabled ?? false,
        serviceRate: Number(settings.serviceRate) || 0,
        totalTables: Number(settings.totalTables) || 0,
        tableNumberStart: Number(settings.tableNumberStart) || 1,
        tableNumberEnd: Number(settings.tableNumberEnd) || 50,
        staleThresholdMinutes: Number(settings.staleThresholdMinutes) || 30,
      });
    }
  }, [settings, reset]);

  const onSubmit = async (data: SettingsFormData) => {
    const payload = {
      ...data,
      primaryColor: data.primaryColor || null,
      secondaryColor: data.secondaryColor || null,
      backgroundColor: data.backgroundColor || null,
      facebookUrl: data.facebookUrl || null,
      instagramUrl: data.instagramUrl || null,
      tiktokUrl: data.tiktokUrl || null,
      taxEnabled: Boolean(data.taxEnabled),
      taxRate: Number(data.taxRate) || 0,
      serviceEnabled: Boolean(data.serviceEnabled),
      serviceRate: Number(data.serviceRate) || 0,
      totalTables: Number(data.totalTables) || 0,
      tableNumberStart: Number(data.tableNumberStart) || 1,
      tableNumberEnd: Number(data.tableNumberEnd) || 50,
      staleThresholdMinutes: Number(data.staleThresholdMinutes) || 30,
    };
    
    updateMutation.mutate(payload, {
      onSuccess: async () => {
        toast.success(isArabic ? "تم حفظ الإعدادات" : "Settings saved");
        // Seed tables if totalTables changed
        if (payload.totalTables > 0) {
          try {
            const result = await seedTables();
            if (result.created > 0) {
              toast.success(
                isArabic 
                  ? `تم إنشاء ${result.created} طاولة جديدة` 
                  : `${result.created} new tables created`
              );
            }
          } catch {
            // Table seeding is best-effort
          }
        }
      },
      onError: () => {
        toast.error(isArabic ? "فشل حفظ الإعدادات" : "Failed to save settings");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isArabic ? "التخصيص والعلامة التجارية" : "Branding & Customization"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isArabic
            ? "خصص مظهر المطعم وبيانات الاتصال"
            : "Customize your restaurant's appearance and contact info"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              {isArabic ? "الهوية" : "Identity"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "اسم المطعم والصور"
                : "Restaurant name and images"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nameAr">{isArabic ? "الاسم بالعربي" : "Name (Arabic)"}</Label>
                <Input id="nameAr" {...register("nameAr")} />
                {errors.nameAr && (
                  <p className="text-xs text-destructive">{isArabic ? "الحد الأدنى 2 أحرف" : "Min 2 characters"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">{isArabic ? "الاسم بالإنجليزي" : "Name (English)"}</Label>
                <Input id="nameEn" {...register("nameEn")} />
                {errors.nameEn && (
                  <p className="text-xs text-destructive">{isArabic ? "الحد الأدنى 2 أحرف" : "Min 2 characters"}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageUpload
                label={isArabic ? "شعار المطعم" : "Restaurant Logo"}
                currentUrl={watch("logoUrl")}
                onUpload={(url) => setValue("logoUrl", url)}
                onRemove={() => setValue("logoUrl", null)}
              />
              <ImageUpload
                label={isArabic ? "صورة خلفية القائمة" : "Menu Background"}
                currentUrl={watch("menuBackgroundUrl")}
                onUpload={(url) => setValue("menuBackgroundUrl", url)}
                onRemove={() => setValue("menuBackgroundUrl", null)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              {isArabic ? "الألوان" : "Brand Colors"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "اختر ألوان العلامة التجارية"
                : "Choose your brand colors"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ColorPicker
                label={isArabic ? "اللون الأساسي" : "Primary Color"}
                value={watch("primaryColor")}
                onChange={(val) => setValue("primaryColor", val)}
              />
              <ColorPicker
                label={isArabic ? "اللون الثانوي" : "Secondary Color"}
                value={watch("secondaryColor")}
                onChange={(val) => setValue("secondaryColor", val)}
              />
              <ColorPicker
                label={isArabic ? "لون الخلفية" : "Background Color"}
                value={watch("backgroundColor")}
                onChange={(val) => setValue("backgroundColor", val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact & Social */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              {isArabic ? "بيانات الاتصال وال التواصل" : "Contact & Social"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "تظهر في ذيل صفحة القائمة"
                : "Displayed in the menu page footer"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">{isArabic ? "رقم الهاتف" : "Phone Number"}</Label>
                <Input id="contactPhone" {...register("contactPhone")} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workingHours">{isArabic ? "ساعات العمل" : "Working Hours"}</Label>
                <Input id="workingHours" {...register("workingHours")} placeholder={isArabic ? "يومياً 10:00 ص - 12:00 م" : "Daily 10:00 AM - 12:00 AM"} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactAddress">{isArabic ? "العنوان" : "Address"}</Label>
              <Input id="contactAddress" {...register("contactAddress")} />
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebookUrl">Facebook</Label>
                <Input id="facebookUrl" {...register("facebookUrl")} placeholder="https://facebook.com/..." />
                {errors.facebookUrl && (
                  <p className="text-xs text-destructive">{isArabic ? "رابط غير صالح" : "Invalid URL"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramUrl">Instagram</Label>
                <Input id="instagramUrl" {...register("instagramUrl")} placeholder="https://instagram.com/..." />
                {errors.instagramUrl && (
                  <p className="text-xs text-destructive">{isArabic ? "رابط غير صالح" : "Invalid URL"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktokUrl">TikTok</Label>
                <Input id="tiktokUrl" {...register("tiktokUrl")} placeholder="https://tiktok.com/..." />
                {errors.tiktokUrl && (
                  <p className="text-xs text-destructive">{isArabic ? "رابط غير صالح" : "Invalid URL"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">{isArabic ? "رقم واتساب" : "WhatsApp Number"}</Label>
                <Input id="whatsappNumber" {...register("whatsappNumber")} placeholder="201XXXXXXXXX" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax & Service Charge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              {isArabic ? "الضريبة ورسوم الخدمة" : "Tax & Service Charge"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "تفعيل وضبط نسب الضريبة ورسوم الخدمة على الطلبات"
                : "Enable and configure tax and service charge rates applied to orders"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tax */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {isArabic ? "الضريبة" : "Tax"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "إضافة ضريبة على الطلبات" : "Add tax to orders"}
                  </p>
                </div>
                <Switch
                  checked={watch("taxEnabled")}
                  onCheckedChange={(checked) => setValue("taxEnabled", checked)}
                />
              </div>
              {watch("taxEnabled") && (
                <div className="space-y-2">
                  <Label htmlFor="taxRate">
                    {isArabic ? "نسبة الضريبة" : "Tax Rate"} (%)
                  </Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={watch("taxRate") * 100}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setValue("taxRate", Math.min(Math.max(val / 100, 0), 1));
                    }}
                    placeholder="15"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isArabic
                      ? `النسبة الحالية: ${(watch("taxRate") * 100).toFixed(1)}%`
                      : `Current rate: ${(watch("taxRate") * 100).toFixed(1)}%`}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Service Charge */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {isArabic ? "رسوم الخدمة" : "Service Charge"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "إضافة رسوم خدمة على الطلبات" : "Add service charge to orders"}
                  </p>
                </div>
                <Switch
                  checked={watch("serviceEnabled")}
                  onCheckedChange={(checked) => setValue("serviceEnabled", checked)}
                />
              </div>
              {watch("serviceEnabled") && (
                <div className="space-y-2">
                  <Label htmlFor="serviceRate">
                    {isArabic ? "نسبة رسوم الخدمة" : "Service Rate"} (%)
                  </Label>
                  <Input
                    id="serviceRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={watch("serviceRate") * 100}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setValue("serviceRate", Math.min(Math.max(val / 100, 0), 1));
                    }}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isArabic
                      ? `النسبة الحالية: ${(watch("serviceRate") * 100).toFixed(1)}%`
                      : `Current rate: ${(watch("serviceRate") * 100).toFixed(1)}%`}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3X3 className="h-4 w-4" />
              {isArabic ? "إدارة الطاولات" : "Table Management"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "إعداد عدد ونطاق أرقام الطاولات"
                : "Configure the number and range of restaurant tables"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalTables">
                  {isArabic ? "عدد الطاولات الكلي" : "Total Tables"}
                </Label>
                <Input
                  id="totalTables"
                  type="number"
                  min="0"
                  max="500"
                  value={watch("totalTables")}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setValue("totalTables", Math.min(Math.max(val, 0), 500));
                  }}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? "0 = تعطيل إدارة الطاولات"
                    : "0 = disable table management"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staleThresholdMinutes">
                  {isArabic ? "حد الطاولة المتراكبة (دقيقة)" : "Stale Threshold (minutes)"}
                </Label>
                <Input
                  id="staleThresholdMinutes"
                  type="number"
                  min="1"
                  max="480"
                  value={watch("staleThresholdMinutes")}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 30;
                    setValue("staleThresholdMinutes", Math.min(Math.max(val, 1), 480));
                  }}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? "الوقت قبل اعتبار الطاولة متراكبة"
                    : "Time before a table is considered stale"}
                </p>
              </div>
            </div>

            {watch("totalTables") > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tableNumberStart">
                    {isArabic ? "رقم البداية" : "Start Number"}
                  </Label>
                  <Input
                    id="tableNumberStart"
                    type="number"
                    min="1"
                    max="500"
                    value={watch("tableNumberStart")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setValue("tableNumberStart", Math.min(Math.max(val, 1), 500));
                    }}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tableNumberEnd">
                    {isArabic ? "رقم النهاية" : "End Number"}
                  </Label>
                  <Input
                    id="tableNumberEnd"
                    type="number"
                    min="1"
                    max="500"
                    value={watch("tableNumberEnd")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 50;
                      setValue("tableNumberEnd", Math.min(Math.max(val, 1), 500));
                    }}
                    placeholder="50"
                  />
                </div>
              </div>
            )}

            {watch("totalTables") > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {isArabic
                    ? `سيتم إنشاء طاولات من ${watch("tableNumberStart")} إلى ${watch("tableNumberEnd")}`
                    : `Tables will be created from ${watch("tableNumberStart")} to ${watch("tableNumberEnd")}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={resetMutation.isPending}
            onClick={() => {
              if (window.confirm(isArabic ? "هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟" : "Are you sure you want to reset all settings to defaults?")) {
                resetMutation.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(isArabic ? "تم إعادة تعيين الإعدادات" : "Settings reset to defaults");
                    reset({
                      nameAr: "Tasty Table",
                      nameEn: "Tasty Table",
                      logoUrl: null,
                      menuBackgroundUrl: null,
                      primaryColor: null,
                      secondaryColor: null,
                      backgroundColor: null,
                      contactPhone: null,
                      contactAddress: null,
                      workingHours: null,
                      facebookUrl: null,
                      instagramUrl: null,
                      tiktokUrl: null,
                      whatsappNumber: null,
                      taxEnabled: false,
                      taxRate: 0,
                      serviceEnabled: false,
                      serviceRate: 0,
                      totalTables: 0,
                      tableNumberStart: 1,
                      tableNumberEnd: 50,
                      staleThresholdMinutes: 30,
                    });
                  },
                  onError: () => {
                    toast.error(isArabic ? "فشل إعادة تعيين الإعدادات" : "Failed to reset settings");
                  },
                });
              }
            }}
          >
            <RotateCcw className="h-4 w-4 me-2" />
            {isArabic ? "إعادة تعيين الكل" : "Reset All"}
          </Button>

          <Button type="submit" size="lg" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 me-2" />
            {updateMutation.isPending
              ? isArabic ? "جاري الحفظ..." : "Saving..."
              : isArabic ? "حفظ الإعدادات" : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

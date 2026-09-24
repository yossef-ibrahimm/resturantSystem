import { useLanguage } from "@/i18n";
import { Phone, MapPin, Clock, Facebook, Instagram } from "lucide-react";
import type { RestaurantSettings } from "@/lib/types";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13.2a8.16 8.16 0 005.58 2.17V12a4.83 4.83 0 01-3.77-1.53V6.69h3.77z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface MenuFooterProps {
  settings: RestaurantSettings | undefined;
}

export default function MenuFooter({ settings }: MenuFooterProps) {
  const { isArabic } = useLanguage();

  if (!settings) return null;

  const notConfiguredText = isArabic ? "لم يتم الإعداد" : "Not configured";

  return (
    <footer className="relative z-10 mt-16 border-t border-border/60 bg-gradient-to-b from-transparent via-background/60 to-background/90 backdrop-blur-sm">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-accent-metal/30 to-transparent" />
              <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-foreground/70">
                {isArabic ? "بيانات الاتصال" : "Contact Us"}
              </h3>
              <div className="h-px flex-1 bg-gradient-to-l from-accent-metal/30 to-transparent" />
            </div>
            <div className="space-y-2 text-sm">
              <a
                href={settings.contactPhone ? `tel:${settings.contactPhone}` : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  settings.contactPhone
                    ? "hover:bg-primary/5 hover:text-primary cursor-pointer"
                    : "opacity-40 cursor-default"
                }`}
                title={!settings.contactPhone ? notConfiguredText : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                </div>
                <span dir="ltr" className={settings.contactPhone ? "" : "italic"}>
                  {settings.contactPhone || notConfiguredText}
                </span>
              </a>
              <div
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${!settings.contactAddress ? "opacity-40" : ""}`}
                title={!settings.contactAddress ? notConfiguredText : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className={settings.contactAddress ? "" : "italic"}>
                  {settings.contactAddress || notConfiguredText}
                </span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${!settings.workingHours ? "opacity-40" : ""}`}
                title={!settings.workingHours ? notConfiguredText : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className={settings.workingHours ? "" : "italic"}>
                  {settings.workingHours || notConfiguredText}
                </span>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-accent-metal/30 to-transparent" />
              <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-foreground/70">
                {isArabic ? "تابعنا" : "Follow Us"}
              </h3>
              <div className="h-px flex-1 bg-gradient-to-l from-accent-metal/30 to-transparent" />
            </div>
            <div className="flex items-center gap-3">
              <a
                href={settings.facebookUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                  settings.facebookUrl
                    ? "bg-primary/5 text-foreground/60 hover:text-[hsl(var(--social-facebook))] hover:bg-[hsl(var(--social-facebook)/0.08)] hover:shadow-md"
                    : "bg-muted/40 text-muted-foreground/25 cursor-default"
                }`}
                aria-label="Facebook"
                title={!settings.facebookUrl ? notConfiguredText : undefined}
                onClick={!settings.facebookUrl ? (e) => e.preventDefault() : undefined}
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href={settings.instagramUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                  settings.instagramUrl
                    ? "bg-primary/5 text-foreground/60 hover:text-[hsl(var(--social-instagram))] hover:bg-[hsl(var(--social-instagram)/0.08)] hover:shadow-md"
                    : "bg-muted/40 text-muted-foreground/25 cursor-default"
                }`}
                aria-label="Instagram"
                title={!settings.instagramUrl ? notConfiguredText : undefined}
                onClick={!settings.instagramUrl ? (e) => e.preventDefault() : undefined}
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href={settings.tiktokUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                  settings.tiktokUrl
                    ? "bg-primary/5 text-foreground/60 hover:text-[hsl(var(--social-tiktok))] hover:bg-[hsl(var(--social-tiktok)/0.08)] hover:shadow-md"
                    : "bg-muted/40 text-muted-foreground/25 cursor-default"
                }`}
                aria-label="TikTok"
                title={!settings.tiktokUrl ? notConfiguredText : undefined}
                onClick={!settings.tiktokUrl ? (e) => e.preventDefault() : undefined}
              >
                <TikTokIcon className="h-5 w-5" />
              </a>
              <a
                href={settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                  settings.whatsappNumber
                    ? "bg-primary/5 text-foreground/60 hover:text-[hsl(var(--social-whatsapp))] hover:bg-[hsl(var(--social-whatsapp)/0.08)] hover:shadow-md"
                    : "bg-muted/40 text-muted-foreground/25 cursor-default"
                }`}
                aria-label="WhatsApp"
                title={!settings.whatsappNumber ? notConfiguredText : undefined}
                onClick={!settings.whatsappNumber ? (e) => e.preventDefault() : undefined}
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()}{" "}
            <span className="font-medium text-muted-foreground/70">
              {isArabic ? settings.nameAr : settings.nameEn}
            </span>
            {" — "}
            {isArabic ? "جميع الحقوق محفوظة" : "All rights reserved"}
          </p>
        </div>
      </div>
    </footer>
  );
}

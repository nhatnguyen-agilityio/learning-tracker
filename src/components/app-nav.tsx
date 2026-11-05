"use client";

import {
  BookOpenIcon,
  HouseIcon,
  LayersIcon,
  type LucideIcon,
  SettingsIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isCurrentNavItem, NAV_ITEMS } from "@/lib/nav";

const icons: Record<(typeof NAV_ITEMS)[number]["key"], LucideIcon> = {
  today: HouseIcon,
  library: BookOpenIcon,
  cards: LayersIcon,
  settings: SettingsIcon,
};

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("label")}
      className="hidden w-58 flex-none flex-col gap-1 border-r border-border bg-card px-3 py-4 min-[900px]:flex"
    >
      <div className="mb-2 flex items-center gap-2 px-2 font-semibold">
        <Image src="/logo.svg" alt="" width={32} height={32} priority />
        {t("brand")}
      </div>
      {NAV_ITEMS.map(({ key, href }) => {
        const Icon = icons[key];
        return (
          <Link
            key={key}
            href={href}
            aria-current={isCurrentNavItem(href, pathname) ? "page" : undefined}
            className="flex min-h-10 items-center gap-3 rounded-lg p-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-soft-foreground"
          >
            <Icon aria-hidden className="size-5 flex-none" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("label")}
      className="grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] min-[900px]:hidden"
    >
      {NAV_ITEMS.map(({ key, href }) => {
        const Icon = icons[key];
        return (
          <Link
            key={key}
            href={href}
            aria-current={isCurrentNavItem(href, pathname) ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-primary"
          >
            <Icon aria-hidden className="size-5.5 flex-none" />
            <span className="max-w-full truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const NAV_ITEMS = [
  { key: "today", href: "/" },
  { key: "library", href: "/library" },
  { key: "cards", href: "/cards" },
  { key: "settings", href: "/settings" },
] as const;

export function isCurrentNavItem(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

import type { AppLocale } from "./locale";
import type messages from "./messages/vi.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}

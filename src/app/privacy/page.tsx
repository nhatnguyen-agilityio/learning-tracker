import { LegalPage } from "@/components/legal/legal-page";

// The language comes from the request, so this page waits for it.
export const instant = false;

export default function Privacy() {
  return <LegalPage page="privacy" />;
}

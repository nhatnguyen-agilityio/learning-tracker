import { ReviewSession } from "@/components/review/review-session";
import { requireUserId } from "@/lib/auth/session";
import { loadReviewBatch } from "./actions";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Review() {
  const userId = await requireUserId();
  const { cards, remaining } = await loadReviewBatch();

  return (
    <ReviewSession userId={userId} cards={cards} initialRemaining={remaining} />
  );
}

import { ReviewSession } from "@/components/review/review-session";
import { selectReviewCards } from "@/domain/review-selection";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Review() {
  const userId = await requireUserId();
  const { cards } = await selectReviewCards(getDb(), userId, new Date());

  return (
    <ReviewSession
      userId={userId}
      cards={cards.map(({ id, front, back, resourceTitle }) => ({
        id,
        front,
        back,
        resourceTitle,
      }))}
    />
  );
}

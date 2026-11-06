const dotClasses: Record<string, string> = {
  "topic-1": "bg-topic-1",
  "topic-2": "bg-topic-2",
  "topic-3": "bg-topic-3",
  "topic-4": "bg-topic-4",
  "topic-5": "bg-topic-5",
  "topic-6": "bg-topic-6",
  "topic-7": "bg-topic-7",
  "topic-8": "bg-topic-8",
};

export function TopicDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className={`size-2 flex-none rounded-full ${dotClasses[color] ?? "bg-muted-foreground"}`}
    />
  );
}

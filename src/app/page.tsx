import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
      <Image src="/logo.svg" alt="" width={48} height={48} priority />
      <h1 className="text-2xl font-semibold">Learning Tracker</h1>
      <p className="text-muted-foreground">
        Gom nguồn học, ghi chú và thẻ ôn vào một luồng, rồi ôn đúng lúc sắp
        quên.
      </p>
    </main>
  );
}

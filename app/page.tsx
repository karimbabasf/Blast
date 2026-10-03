export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight" translate="no">
        Blast
      </h1>
      <p className="max-w-prose text-lg text-pretty text-muted-foreground">
        A manager agent that auditions and hires other agents for you.
      </p>
    </main>
  );
}

import LineMap from "@/app/components/LineMap";
import SiteHeader from "@/app/components/SiteHeader";

const stops = [
  { name: "Pick", text: "Choose the career at the end of the line." },
  { name: "Answer", text: "Pace and starting point. Three taps." },
  { name: "Ride", text: "Every MDC stop, in order, from the catalog." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader mode="public" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section>
            <p className="text-sm font-medium text-muted">Miami Dade College</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Majorly lost? Good. Every route starts there.
            </h1>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Pick where you want to end up: architect, chef, engineer, and
              more. We’ll map every MDC class between here and there, one
              station at a time.
            </p>
            <a
              href="/auth/login?returnTo=/dashboard"
              className="press focus-ring mt-8 inline-block px-5 py-3 text-base font-extrabold"
            >
              Get my ticket
            </a>
          </section>
          <LineMap />
        </div>
        <ol className="mt-14 grid gap-4 sm:grid-cols-3">
          {stops.map((stop, index) => (
            <li key={stop.name} className="ticket p-4">
              <div className="font-mono text-sm text-accent">0{index + 1}</div>
              <h2 className="mt-1 text-xl font-extrabold">{stop.name}</h2>
              <p className="mt-1 text-sm text-muted">{stop.text}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

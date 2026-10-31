import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[#09090B] px-6 text-center text-white">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-[#0066FF]">
        404
      </p>
      <h1 className="mt-4 text-3xl font-black">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-[#888]">
        This page does not exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-7 rounded-xl bg-[#0066FF] px-5 py-3 text-sm font-bold"
      >
        Return home
      </Link>
    </main>
  );
}

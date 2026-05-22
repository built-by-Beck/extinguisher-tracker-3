/**
 * Shown while lazy route chunks load. Matches dashboard loading shell styling.
 *
 * Author: built_by_Beck
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-500">Loading page…</p>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-2 text-6xl font-bold text-gray-900">404</h1>
      <p className="mb-6 text-lg text-gray-600">Page not found</p>
      <Link
        to="/"
        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Go Home
      </Link>
    </div>
  );
}

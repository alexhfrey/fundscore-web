import Link from "next/link";
import { AuthNav } from "./AuthNav";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1466b8] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FS</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Fund<span className="text-[#1466b8]">Score</span>
                <span className="text-gray-400 font-normal">.ai</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/screener"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Screener
              </Link>
              <Link
                href="/xray"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                X-Ray
              </Link>
              <Link
                href="/lens"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Lenses
              </Link>
              <Link
                href="/methodology"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Methodology
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              Beta
            </span>
            <AuthNav />
          </div>
        </div>
      </div>
    </header>
  );
}

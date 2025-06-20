
"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Define paths that are publicly accessible without authentication
// Removed "/" from PUBLIC_PATHS to make the root route protected.
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // If authentication is still loading and the current path is not public,
  // show a loading indicator to prevent flashing content.
  if (isLoading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"> {/* Adjusted height */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated and trying to access a protected page,
  // return null while the redirect effect takes place.
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    return null; 
  }

  // If authenticated or on a public path, render the children.
  return <>{children}</>;
}

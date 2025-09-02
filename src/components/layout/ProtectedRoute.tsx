
"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Define paths that are publicly accessible without authentication
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // If auth is not loading, we have a definitive answer about authentication
    if (!isLoading) {
      // If the user is not authenticated and the path is NOT public
      if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
        console.log(`Redirecting to /login from protected route: ${pathname}`);
        router.push("/login");
      }
      // If the user IS authenticated and trying to access a public-only page (like login)
      else if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
         console.log(`Redirecting to / from public route: ${pathname}`);
         router.push("/");
      }
    }
  }, [isLoading, isAuthenticated, pathname, router]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"> 
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated and on a protected route, render nothing while redirecting
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }
  
  // If authenticated and on a public route, render nothing while redirecting
  if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
      return null;
  }

  // Render children if everything is fine (authenticated on protected route, or unauthenticated on public route)
  return <>{children}</>;
}

"use client";

import Header from '@/components/layout/header';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { AuthProvider } from '@/hooks/useAuth';

export default function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <Header />
      <main>
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
    </AuthProvider>
  );
}

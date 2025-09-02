import Header from '@/components/layout/header';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

export default function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main>
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
    </>
  );
}


import LoginForm from '@/components/auth/LoginForm';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { version } from '../../../package.json';

export const metadata: Metadata = {
  title: 'TourFile',
  description: 'Accede a tu cuenta para generar reportes de caja chica.',
};

export default function LoginPage() {
  const appVersion = `${version} - DC`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-4">
          {/* Logo compuesto horizontal */}
          <div className="flex items-center gap-0 mb-0">
            <Image
              src="/logo.png"
              alt="TourFile Logo"
              width={80}
              height={80}
              className="h-20 w-20 object-contain dark:brightness-110 dark:contrast-110"
              priority
            />
            <h1 className="text-5xl font-bold tracking-tight translate-y-1 -ml-2" style={{ color: '#42a5fe' }}>
              TourFile
            </h1>
          </div>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regístrate aquí
          </Link>
        </p>
         <footer className="mt-8 text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} TourFile Generator. (Versión: {appVersion})</p>
        </footer>
      </div>
    </div>
  );
}

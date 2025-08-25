
import LoginForm from '@/components/auth/LoginForm';
import { FileSpreadsheet } from 'lucide-react'; // Using main app icon
import Link from 'next/link';
import type { Metadata } from 'next';
import { version } from '../../../package.json'; // Import version

export const metadata: Metadata = {
  title: 'Iniciar Sesión - TourFile Generator',
  description: 'Accede a tu cuenta para generar reportes de caja chica.',
};

export default function LoginPage() {
  const appVersion = process.env.NEXT_PUBLIC_APP_ENV && process.env.NEXT_PUBLIC_APP_ENV !== "production"
    ? `${version}-${process.env.NEXT_PUBLIC_APP_ENV}`
    : version;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <FileSpreadsheet className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">TourFile Generator</h1>
          <p className="text-muted-foreground">Acceso al sistema.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regístrate aquí
          </Link>
        </p>
         <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TourFile Generator. (Versión: {appVersion})
        </p>
      </div>
    </div>
  );
}

    

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { KeyRound } from 'lucide-react'; // Using KeyRound icon
import type { Metadata } from 'next';
import { version } from '../../../package.json'; // Import version

export const metadata: Metadata = {
  title: 'Recuperar Contraseña - TourFile Generator',
  description: 'Restablece tu contraseña para acceder al sistema.',
};

export default function ForgotPasswordPage() {
  const appVersion = process.env.NEXT_PUBLIC_APP_ENV && process.env.NEXT_PUBLIC_APP_ENV !== "production"
    ? `${version}-${process.env.NEXT_PUBLIC_APP_ENV}`
    : version;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <KeyRound className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Recuperar Contraseña</h1>
          <p className="text-muted-foreground">Sigue los pasos para restablecer tu contraseña.</p>
        </div>
        <ForgotPasswordForm />
         <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TourFile Generator. (Versión: {appVersion})
        </p>
      </div>
    </div>
  );
}

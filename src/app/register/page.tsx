
import RegistrationForm from '@/components/auth/RegistrationForm';
import { UserRoundPlus } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registrar Usuario - TourFile Generator',
  description: 'Crea una nueva cuenta para usar el generador de reportes.',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <UserRoundPlus className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Crear Cuenta</h1>
          <p className="text-muted-foreground">Regístrate para empezar a usar TourFile Generator.</p>
        </div>
        <RegistrationForm />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} TourFile Generator.
        </p>
      </div>
    </div>
  );
}

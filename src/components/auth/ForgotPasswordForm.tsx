
"use client";

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Send, UserSearch, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ForgotPasswordStep = "enterUsername" | "enterEmail";

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<ForgotPasswordStep>("enterUsername");
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const { sendPasswordResetEmail, isLoading: isSendingEmail, checkUsernameExists } = useAuth();
  const { toast } = useToast();

  const handleUsernameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim()) {
      toast({
        title: "Nombre de Usuario Requerido",
        description: "Por favor, ingresa tu nombre de usuario.",
        variant: "destructive",
      });
      return;
    }
    setIsCheckingUsername(true);
    const exists = await checkUsernameExists(username.trim());
    setIsCheckingUsername(false);

    if (exists) {
      setStep("enterEmail");
      toast({
        title: "Usuario Verificado",
        description: `Ahora ingresa el correo electrónico asociado a ${username}.`,
      });
    } else {
      toast({
        title: "Usuario No Encontrado",
        description: `El usuario "${username}" no fue encontrado en nuestros registros.`,
        variant: "destructive",
      });
    }
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast({
        title: "Correo Requerido",
        description: "Por favor, ingresa tu correo electrónico.",
        variant: "destructive",
      });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        toast({
            title: "Correo Inválido",
            description: "Por favor, ingresa un formato de correo electrónico válido.",
            variant: "destructive",
        });
        return;
    }

    await sendPasswordResetEmail(email, username);
  };

  return (
    <Card className="shadow-xl w-full max-w-md">
      {step === "enterUsername" && (
        <>
          <CardHeader>
            <CardTitle className="text-xl text-center flex items-center justify-center">
              <UserSearch className="mr-2 h-6 w-6 text-primary"/>
              Verificar Usuario
            </CardTitle>
            <CardDescription className="text-center">
              Primero, ingresa tu nombre de usuario para verificar tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUsernameSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="tu.usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isCheckingUsername || !username.trim()}>
                {isCheckingUsername ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                {isCheckingUsername ? 'Verificando...' : 'Siguiente'}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {step === "enterEmail" && (
        <>
          <CardHeader>
            <CardTitle className="text-xl text-center flex items-center justify-center">
                <Mail className="mr-2 h-6 w-6 text-primary"/>
                Correo de Recuperación
            </CardTitle>
            <CardDescription className="text-center">
              Ingresa el correo electrónico asociado a la cuenta <strong className="text-foreground">{username}</strong>.
              Te enviaremos un enlace para restablecer tu contraseña (funcionalidad simulada).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu.correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSendingEmail || !email.trim()}>
                <Send className="mr-2 h-5 w-5" />
                {isSendingEmail ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
              </Button>
            </form>
            <Button variant="link" onClick={() => { setStep("enterUsername"); setEmail(''); }} className="mt-4 w-full text-primary">
                Volver a ingresar usuario
            </Button>
          </CardContent>
        </>
      )}
      <CardFooter className="pt-4">
        <p className="text-center text-sm w-full">
            <Link href="/login" className="font-medium text-primary hover:underline">
                Volver a Iniciar Sesión
            </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

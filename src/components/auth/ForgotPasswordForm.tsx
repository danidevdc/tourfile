
"use client";

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth'; // Ensure useAuth is updated for Firebase Auth
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Send, Mail, CheckCircle2 } from 'lucide-react'; // UserSearch, ArrowRight removed
import { PlaneSpinner } from '@/components/ui/plane-spinner';
import { useToast } from '@/hooks/use-toast';

type ForgotPasswordStep = "enterEmail" | "confirmation"; // Renamed step

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<ForgotPasswordStep>("enterEmail");
  const [emailToReset, setEmailToReset] = useState('');
  
  const { sendPasswordReset, isLoading: isSendingEmail } = useAuth(); // Renamed to sendPasswordReset
  const { toast } = useToast();

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailToReset.trim()) {
      toast({
        title: "Correo Requerido",
        description: "Por favor, ingresa tu correo electrónico.",
        variant: "destructive",
      });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(emailToReset.trim())) { // Basic email validation
        toast({
            title: "Correo Inválido",
            description: "Por favor, ingresa un formato de correo electrónico válido.",
            variant: "destructive",
        });
        return;
    }

    await sendPasswordReset(emailToReset.trim()); 
    // Firebase Auth's sendPasswordResetEmail handles success/error toasts via useAuth
    // We can still move to a confirmation step for better UX
    setStep("confirmation"); 
  };

  return (
    <Card className="shadow-xl w-full max-w-md">
      {step === "enterEmail" && (
        <>
          <CardHeader>
            <CardTitle className="text-xl text-center flex items-center justify-center">
                <Mail className="mr-2 h-6 w-6 text-primary"/>
                Recuperar Contraseña
            </CardTitle>
            <CardDescription className="text-center">
              Ingresa tu correo electrónico. Te enviaremos un enlace para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="emailToReset">Correo Electrónico Registrado</Label>
                <Input
                  id="emailToReset"
                  type="email"
                  placeholder="tu.correo@ejemplo.com"
                  value={emailToReset}
                  onChange={(e) => setEmailToReset(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSendingEmail || !emailToReset.trim()}>
                {isSendingEmail ? <PlaneSpinner className="mr-2 h-5 w-5" /> : <Send className="mr-2 h-5 w-5" />}
                {isSendingEmail ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {step === "confirmation" && (
         <>
          <CardHeader>
            <CardTitle className="text-xl text-center flex items-center justify-center">
                <CheckCircle2 className="mr-2 h-6 w-6 text-green-500"/>
                Verifica tu Correo
            </CardTitle>
            <CardDescription className="text-center">
              Si una cuenta existe para <strong className="text-foreground">{emailToReset}</strong>, hemos enviado un correo con instrucciones para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
             <p className="text-sm text-muted-foreground">
                Por favor, revisa tu bandeja de entrada (y la carpeta de spam).
             </p>
            <Button variant="link" onClick={() => { setStep("enterEmail"); setEmailToReset(''); }} className="mt-4 w-full text-primary">
                Intentar con otro correo
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

    
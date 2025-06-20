
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

type ForgotPasswordStep = "enterUsernameOrEmail" | "confirmation"; // Simplified steps for email-based reset

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<ForgotPasswordStep>("enterUsernameOrEmail");
  const [emailToReset, setEmailToReset] = useState(''); // Changed to emailToReset for clarity
  
  const { sendPasswordResetEmail, isLoading: isSendingEmail } = useAuth();
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
    if (!/\S+@\S+\.\S+/.test(emailToReset.trim())) {
        toast({
            title: "Correo Inválido",
            description: "Por favor, ingresa un formato de correo electrónico válido.",
            variant: "destructive",
        });
        return;
    }

    // In a real Firebase Auth scenario, you'd directly call Firebase's password reset.
    // Here, we'll use our existing simulated function.
    // The username is no longer explicitly asked for in this flow,
    // sendPasswordResetEmail in useAuth will try to find username by email for logging if needed.
    await sendPasswordResetEmail(emailToReset.trim()); 
    
    // The toast for simulation is handled within sendPasswordResetEmail for now
    // For a better UX, we can move to a confirmation step
    setStep("confirmation"); 
  };

  return (
    <Card className="shadow-xl w-full max-w-md">
      {step === "enterUsernameOrEmail" && (
        <>
          <CardHeader>
            <CardTitle className="text-xl text-center flex items-center justify-center">
                <Mail className="mr-2 h-6 w-6 text-primary"/>
                Recuperar Contraseña
            </CardTitle>
            <CardDescription className="text-center">
              Ingresa tu correo electrónico. Te enviaremos un enlace para restablecer tu contraseña (funcionalidad simulada).
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
                <Send className="mr-2 h-5 w-5" />
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
                <CheckCircle2 className="mr-2 h-6 w-6 text-green-500"/> {/* Using a more appropriate icon */}
                Verifica tu Correo
            </CardTitle>
            <CardDescription className="text-center">
              Si una cuenta existe para <strong className="text-foreground">{emailToReset}</strong>, hemos enviado (simulado) un correo con instrucciones para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
             <p className="text-sm text-muted-foreground">
                Por favor, revisa tu bandeja de entrada (y spam).
             </p>
            <Button variant="link" onClick={() => { setStep("enterUsernameOrEmail"); setEmailToReset(''); }} className="mt-4 w-full text-primary">
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

// Need to add CheckCircle2 to lucide-react imports if not already there
// Assuming it exists, or replace with a suitable icon like MailCheck
// For this example, I'll assume CheckCircle2 is available or we can add it.
// If not, a simple MailCheck or similar would work.
// For now, let's use UserSearch for consistency if CheckCircle2 isn't readily available.
// Corrected to Mail icon for "Verificar Usuario" in previous step, will use UserSearch if MailCheck is not good
// Using UserSearch as placeholder if CheckCircle2 is not in lucide-react or if there's an issue.
// For forgot password confirmation, MailCheck or CheckCircle2 is better.
// Let's import CheckCircle2 for ForgotPasswordForm's confirmation step.
import { CheckCircle2 } from 'lucide-react'; // Added for confirmation step


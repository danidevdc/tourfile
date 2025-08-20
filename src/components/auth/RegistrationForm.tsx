
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Eye, EyeOff, AlertTriangle, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';


const calculatePasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 6) strength += 25; // Firebase min is 6
  if (password.match(/[a-z]/)) strength += 15;
  if (password.match(/[A-Z]/)) strength += 15;
  if (password.match(/[0-9]/)) strength += 15;
  if (password.match(/[^a-zA-Z0-9]/)) strength += 15; 
  if (password.length >= 10) strength += 15; // Stronger length
  return Math.min(strength, 100);
};

const getStrengthColor = (strength: number) => {
  if (strength < 30) return "bg-destructive";
  if (strength < 60) return "bg-orange-500"; // Weak (but meets Firebase min)
  if (strength < 85) return "bg-yellow-500"; // Good
  return "bg-primary"; // Strong
};

export default function RegistrationForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isFormValid, setIsFormValid] = useState(false);

  const { register, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(password));
  }, [password]);


  useEffect(() => {
    const emailFormatValid = /\S+@\S+\.\S+/.test(email.trim());
    const allFieldsFilled =
      email.trim() !== '' &&
      password !== '' &&
      confirmPassword !== '';
    const passwordsMatch = password === confirmPassword;
    const passwordIsStrongEnough = passwordStrength >= 25; // Firebase min is 6 chars, so low strength bar

    setIsFormValid(
      allFieldsFilled &&
      emailFormatValid &&
      passwordsMatch &&
      passwordIsStrongEnough &&
      !isLoading 
    );
  }, [
    email,
    password,
    confirmPassword,
    passwordStrength,
    isLoading
  ]);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isFormValid) {
       toast({
        title: "Error de Registro",
        description: "Por favor, completa y corrige todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }
    
    // Pass only email and password to register
    await register(email.trim(), password);
  };

  return (
    <Card className="shadow-xl w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Registro de Usuario</CardTitle>
        <CardDescription className="text-center">Crea tu cuenta para acceder al sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Correo Electrónico</Label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="email"
                    type="email"
                    placeholder="tu.correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background pl-10"
                />
            </div>
            {email.trim() && !/\S+@\S+\.\S+/.test(email.trim()) && (
                 <p className="text-xs text-destructive mt-1">Formato de correo inválido.</p>
            )}
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Crea una contraseña (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {password && (
              <div className="mt-1">
                 <Progress value={passwordStrength} className="h-2" indicatorClassName={getStrengthColor(passwordStrength)} />
                <p className="text-xs mt-1 text-muted-foreground">
                  Fortaleza: {passwordStrength < 30 ? "Muy débil" : passwordStrength < 60 ? "Débil" : passwordStrength < 85 ? "Buena" : "Fuerte"}
                  {password.length > 0 && password.length < 6 && <span className="text-destructive"> (Mínimo 6 caracteres)</span>}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
             <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirma tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center mt-1"><AlertTriangle className="h-3 w-3 mr-1"/>Las contraseñas no coinciden.</p>
            )}
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

    

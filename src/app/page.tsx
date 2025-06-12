"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-headline text-primary">
            TourFile Generator
          </CardTitle>
          <CardDescription className="text-lg pt-2">
            Bienvenido al generador de archivos para tours.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <p className="text-center">
            Haz clic en el botón de abajo para comenzar a generar tus cajas chicas.
          </p>
          <Link href="/generator" passHref>
            <Button size="lg" className="w-full">
              Generador de Cajas Chicas
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}


"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-xl shadow-lg rounded-xl">
        <CardContent className="p-10">
          {/* Greeting Section */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-primary">
              Bienvenido!
            </h1>
            <p className="text-xl text-muted-foreground mt-2">
              Selecciona una opción
            </p>
          </div>

          {/* Action Buttons Section */}
          <div className="grid grid-cols-1 gap-6">
            <Link href="/generator" passHref>
              <Button
                variant="default"
                className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
              >
                <FileSpreadsheet className="h-12 w-12 mr-6 text-primary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-2xl font-bold text-primary-foreground">
                    Generador de Cajas Chicas
                  </span>
                  <span className="block text-md text-primary-foreground/80 mt-1">
                    Accede a la herramienta para crear tus reportes.
                  </span>
                </div>
                <ArrowRight className="h-8 w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>
            {/* 
            Example of a second button if features expand:
            <Button
              variant="secondary" // Or "outline"
              className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
            >
              <Grid3X3 className="h-12 w-12 mr-6 text-secondary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
              <div className="text-left flex-grow">
                <span className="block text-2xl font-bold text-secondary-foreground">
                  Otra Funcionalidad
                </span>
                <span className="block text-md text-secondary-foreground/80 mt-1">
                  Descripción de la otra sección.
                </span>
              </div>
               <ArrowRight className="h-8 w-8 ml-auto text-secondary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
            </Button>
            */}
          </div>
        </CardContent>
      </Card>
       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

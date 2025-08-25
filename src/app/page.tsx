
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ClipboardList, Settings, Plane } from "lucide-react";
import { useAuth } from "@/hooks/useAuth"; 
import { version } from '../../package.json';

export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth(); 

  const appVersion = process.env.NEXT_PUBLIC_APP_ENV && process.env.NEXT_PUBLIC_APP_ENV !== "production"
    ? `${version}-${process.env.NEXT_PUBLIC_APP_ENV}`
    : version;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-xl">
        <CardContent className="p-10">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-primary">
              Bienvenido!
            </h1>
            <p className="text-xl text-muted-foreground mt-2">
              Selecciona una opción
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Link href="/city-selection" passHref>
              <Button
                variant="default"
                className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
              >
                <FileSpreadsheet className="h-12 w-12 mr-6 text-primary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-2xl font-bold text-primary-foreground">
                    Generar Caja Chica
                  </span>
                </div>
                <ArrowRight className="h-8 w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            <Link href="/service-order" passHref>
              <Button
                className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <ClipboardList className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-2xl font-bold">
                    Generar Órdenes de Servicio
                  </span>
                </div>
                <ArrowRight className="h-8 w-8 ml-auto text-accent-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            {!authLoading && isCurrentUserAdmin && (
              <>
                <Link href="/admin/dashboard" passHref>
                  <Button
                    variant="secondary" 
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
                  >
                    <Settings className="h-12 w-12 mr-6 text-secondary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold text-secondary-foreground">
                        Administrar
                      </span>
                      <span className="block text-sm font-normal text-secondary-foreground/80">
                        Gestionar datos, lógica y usuarios
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-secondary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>
                <Link href="/flight-search" passHref>
                  <Button
                    variant="outline" 
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group border-primary/20 hover:border-primary text-primary"
                  >
                    <Plane className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold">
                        Buscador de Vuelos
                      </span>
                      <span className="block text-sm font-normal text-muted-foreground">
                        Herramienta de prueba para IA
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-primary/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados. (Versión: {appVersion})</p>
      </footer>
    </div>
  );
}

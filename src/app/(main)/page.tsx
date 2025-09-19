
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ClipboardList, Settings, Plane, Database, ClipboardEdit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth"; 
import { version } from '../../../package.json';
import { useEffect, useState } from "react";
import { getIntermediateUserEmail } from "@/lib/appConfigService";


export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth(); 
  const [canSeeIntermediateButton, setCanSeeIntermediateButton] = useState(false);

  useEffect(() => {
    async function checkPermissions() {
        if (authLoading || !currentUser) {
            setCanSeeIntermediateButton(false);
            return;
        }
        if (isCurrentUserAdmin) {
            setCanSeeIntermediateButton(true);
            return;
        }
        const intermediateEmail = await getIntermediateUserEmail();
        setCanSeeIntermediateButton(!!intermediateEmail && currentUser.email === intermediateEmail);
    }
    checkPermissions();
  }, [authLoading, currentUser, isCurrentUserAdmin]);

  const appVersion = `${version} - DC`;

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

            {isAuthenticated && (
              <>
                <Link href="/service-order" passHref>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group border-primary text-primary hover:border-primary/80 hover:bg-primary/5 hover:text-primary"
                  >
                    <ClipboardList className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold">
                        Generar Órdenes de Servicio
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-primary/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>

                 <Link href="/admin/contribute" passHref>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/5"
                  >
                    <Database className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold">
                        Aportar Datos
                      </span>
                       <span className="block text-sm font-normal text-muted-foreground">
                        Añade nuevos guías, hoteles, vuelos, etc. a la base de datos
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-blue-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>
              </>
            )}

            {!authLoading && canSeeIntermediateButton && (
              <Link href="/admin/edit-service-order-logic" passHref>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5"
                  >
                    <ClipboardEdit className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold">
                        Editar Lógica de Órdenes
                      </span>
                       <span className="block text-sm font-normal text-muted-foreground">
                        Modificar las reglas de generación de órdenes de servicio
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-amber-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>
            )}

            {!authLoading && isCurrentUserAdmin && (
              <>
                <Link href="/flight-search" passHref>
                  <Button
                    variant="default" 
                    className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plane className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-2xl font-bold">
                        Buscador de Vuelos
                      </span>
                      <span className="block text-sm font-normal text-primary-foreground/80">
                        Consulta el estado de vuelos en tiempo real
                      </span>
                    </div>
                    <ArrowRight className="h-8 w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>

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


"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ClipboardList, Settings, Plane, Database, ClipboardEdit, Calendar, CalendarOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { version } from '../../../package.json';
import { useEffect, useState } from "react";
import { getIntermediateUserEmail } from "@/lib/appConfigService";
import { LiveTimeline } from "@/components/LiveTimeline";
import { MonthlyDownloadModal } from "@/components/service-order/MonthlyDownloadModal";


export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();
  const [canSeeIntermediateButton, setCanSeeIntermediateButton] = useState(false);
  const [isTimelineActive, setIsTimelineActive] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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
    <div className="flex flex-col items-center justify-center min-h-screen mobile-padding bg-background">
      <Card className="w-full max-w-5xl shadow-lg rounded-xl">
        <CardContent className="p-6 sm:p-8 md:p-10">
          <div className="mb-8 sm:mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary">
              Bienvenido!
            </h1>
            <p className="mobile-text-lg text-muted-foreground mt-2">
              Selecciona una opción
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Link href="/city-selection" passHref>
              <Button
                variant="default"
                className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group"
              >
                <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 text-primary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold text-primary-foreground">
                    Cajas Chicas
                  </span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            {isAuthenticated && (
              <Link href="/service-order" passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-primary text-primary hover:bg-transparent hover:text-primary"
                >
                  <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">
                      Órdenes de Servicio
                    </span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-primary/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {isAuthenticated && (
              <Link href="/admin/contribute" passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-transparent hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Database className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">
                      Aportar Datos
                    </span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-blue-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={() => setIsDownloadModalOpen(true)}
                className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-green-600/20 text-green-700 dark:text-green-400 hover:bg-transparent hover:text-green-800 dark:hover:text-green-300"
              >
                <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold">
                    Reportes Mensuales
                  </span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-green-600/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            )}

            {!authLoading && canSeeIntermediateButton && (
              <Link href="/admin/edit-service-order-logic" passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-transparent hover:text-amber-600 dark:hover:text-amber-400"
                >
                  <ClipboardEdit className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">
                      Editar Lógica
                    </span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-amber-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {!authLoading && isCurrentUserAdmin && (
              <>
                <Link href="/flight-search" passHref>
                  <Button
                    variant="default"
                    className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plane className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-xl sm:text-2xl font-bold">
                        Buscador de Vuelos
                      </span>
                    </div>
                    <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>

                <Link href="/admin/dashboard" passHref>
                  <Button
                    variant="secondary"
                    className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group"
                  >
                    <Settings className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 text-secondary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                    <div className="text-left flex-grow">
                      <span className="block text-xl sm:text-2xl font-bold text-secondary-foreground">
                        Administrar
                      </span>
                    </div>
                    <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-secondary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Timeline - Beta Feature */}
      {!authLoading && isAuthenticated && (
        <div className="w-full max-w-7xl mt-6 sm:mt-8">
          {!isTimelineActive ? (
            <Card className="shadow-lg">
              <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                <Calendar className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <h3 className="mobile-text-xl font-semibold mb-2">Timeline de Órdenes</h3>
                <p className="mobile-text-base text-muted-foreground mb-6 max-w-md">
                  Visualiza todas tus órdenes de servicio en un calendario interactivo en tiempo real.
                </p>
                <Button
                  onClick={() => setIsTimelineActive(true)}
                  size="lg"
                  className="gap-2 touch-target"
                >
                  <Calendar className="h-5 w-5" />
                  Activar Timeline
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50">
                <Button
                  onClick={() => setIsTimelineActive(false)}
                  variant="outline"
                  size="sm"
                  className="gap-2 touch-target text-sm"
                >
                  <CalendarOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Desactivar Timeline</span>
                  <span className="sm:hidden">Ocultar</span>
                </Button>
              </div>
              <LiveTimeline isActive={isTimelineActive} />
            </div>
          )}
        </div>
      )}

      <MonthlyDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados. (Versión: {appVersion})</p>
      </footer>
    </div>
  );
}

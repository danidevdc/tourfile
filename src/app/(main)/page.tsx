
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ArrowLeft, ClipboardList, Settings, Plane, Database, ClipboardEdit, Calendar, CheckCircle2, XCircle, RefreshCw, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { version } from '../../../package.json';
import { useEffect, useState } from "react";
import { checkDatabaseConnection } from "@/lib/dbConnectionCheck";
import { getIntermediateUserEmails } from "@/lib/appConfigService";
import { LiveTimeline } from "@/components/LiveTimeline";
import { MonthlyDownloadModal } from "@/components/service-order/MonthlyDownloadModal";
import { checkForMasterDataUpdates } from "@/lib/serviceOrderService";


export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();
  const [canSeeIntermediateButton, setCanSeeIntermediateButton] = useState(false);
  const [isTimelineActive, setIsTimelineActive] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

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
      const allowedEmails = await getIntermediateUserEmails();
      setCanSeeIntermediateButton(allowedEmails.includes(currentUser.email || ""));
    }
    checkPermissions();
  }, [authLoading, currentUser, isCurrentUserAdmin]);

  // Check database connection on mount
  useEffect(() => {
    verifyDatabaseConnection();
  }, []);

  // Smart reconnection: verify connection when user returns to tab after being away
  useEffect(() => {
    let lastVisibilityChange = Date.now();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastCheck = Date.now() - lastVisibilityChange;
        // Only verify if tab was hidden for more than 2 minutes
        if (timeSinceLastCheck > 2 * 60 * 1000) {
          console.log('Tab regained focus after inactivity, verifying database connection...');
          verifyDatabaseConnection();
        }
        lastVisibilityChange = Date.now();
      } else {
        lastVisibilityChange = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const verifyDatabaseConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const isConnected = await checkDatabaseConnection();
      setDbConnected(isConnected);
    } catch (error) {
      console.error('Error checking database connection:', error);
      setDbConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Check for master data updates periodically and on visibility change
  useEffect(() => {
    // Check once on mount
    checkForMasterDataUpdates();

    const interval = setInterval(async () => {
      await checkForMasterDataUpdates();
    }, 5 * 60 * 1000); // Every 5 minutes

    const handleMasterDataVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await checkForMasterDataUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleMasterDataVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleMasterDataVisibilityChange);
    };
  }, []);

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

            {/* Database Connection Status */}
            <div className="mt-6 flex justify-center">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-all duration-300 ${dbConnected === null ? 'border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700' :
                dbConnected ? 'border-green-500 bg-green-50 dark:bg-emerald-950/20 dark:border-emerald-500/50' : 'border-red-500 bg-red-50 dark:bg-red-950/20 dark:border-red-500/50'
                }`}>
                {isCheckingConnection ? (
                  <>
                    <RefreshCw className="h-5 w-5 text-gray-500 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verificando conexión...</span>
                  </>
                ) : dbConnected === null ? (
                  <>
                    <Database className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verificando base de datos...</span>
                  </>
                ) : dbConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-green-700 dark:text-emerald-400">Base de datos conectada</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <span className="text-sm font-semibold text-red-700 dark:text-red-400">Sin conexión a la base de datos</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={verifyDatabaseConnection}
                        disabled={isCheckingConnection}
                        className="border-red-400 text-red-700 dark:text-red-400 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50 h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reconectar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Link href="/city-selection" passHref>
              <Button
                variant="outline"
                className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-transparent hover:text-teal-700 dark:hover:text-teal-300"
              >
                <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold">
                    Cajas Chicas
                  </span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-teal-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            {isAuthenticated && (
              <Link href="/service-order" passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-primary/20 text-primary hover:bg-transparent hover:text-primary"
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
              <Link href="/guide-liquidation" passHref>
                <Button
                  variant="outline"
                  className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-transparent hover:text-cyan-700 dark:hover:text-cyan-300"
                >
                  <Wallet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">
                      Liquidación de Guías
                    </span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-cyan-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
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

            {/* Live Timeline Option */}
            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={() => setIsTimelineActive(true)}
                className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-transparent hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold">
                    Timeline de Órdenes
                  </span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-indigo-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
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

      {/* Full Screen Timeline Overlay */}
      {isTimelineActive && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-7xl mx-auto flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 bg-muted/30 p-4 rounded-xl border border-indigo-500/10">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-indigo-500" />
                <h2 className="text-xl font-bold text-primary">Timeline de Órdenes de Servicio</h2>
              </div>
              <Button
                onClick={() => setIsTimelineActive(false)}
                variant="outline"
                size="sm"
                className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Cerrar y volver al menú
              </Button>
            </div>

            <div className="flex-grow overflow-auto rounded-xl border shadow-sm">
              <LiveTimeline isActive={isTimelineActive} />
            </div>
          </div>
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


"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ArrowLeft, ClipboardList, Settings, Plane, Database, ClipboardEdit, Calendar, CheckCircle2, XCircle, RefreshCw, Wallet } from "lucide-react";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { version } from '../../../package.json';
import { useEffect, useState } from "react";
import { checkDatabaseConnection } from "@/lib/dbConnectionCheck";
import { LiveTimeline } from "@/components/LiveTimeline";
import { MonthlyDownloadModal } from "@/components/service-order/MonthlyDownloadModal";
import { checkForMasterDataUpdates } from "@/lib/serviceOrderService";


// ─── Nothing-style Doto typewriter ────────────────────────────────────────
// Fuente Doto (dot-matrix, ya cargada en layout.tsx).
// Cada letra aparece de izquierda a derecha con animación fade+drop pura CSS.
// Cero JS, cero re-renders, cero timers.

const WELCOME = "BIENVENIDO!";

function WelcomeDisplay() {
  return (
    <>
      <style>{`
        @keyframes letter-in {
          0%   { opacity: 0; transform: translateY(-8px); }
          60%  { opacity: 1; transform: translateY(1px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
        .welcome-letter {
          display: inline-block;
          opacity: 0;
          animation: letter-in 300ms ease-out forwards;
        }
      `}</style>
      <div className="flex items-center justify-center gap-[2px] sm:gap-[3px] select-none mb-1">
        {WELCOME.split("").map((char, i) => (
          <span
            key={i}
            className="welcome-letter"
            style={{
              fontFamily: "'Roboto', sans-serif",
              fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
              lineHeight: 1,
              letterSpacing: "0.12em",
              fontWeight: 700,
              color: "hsl(var(--primary))",
              animationDelay: `${i * 80}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </div>
    </>
  );
}


// ─── Main page ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();
  const [isTimelineActive, setIsTimelineActive] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  const hasModule = (mod: AppModule): boolean => {
    if (!isAuthenticated) return false;
    if (isCurrentUserAdmin) return true;
    return (currentUser?.profile?.modules || []).includes(mod);
  };

  useEffect(() => { verifyDatabaseConnection(); }, []);

  useEffect(() => {
    let lastVisibilityChange = Date.now();
    const handle = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastVisibilityChange > 2 * 60 * 1000) verifyDatabaseConnection();
        lastVisibilityChange = Date.now();
      } else {
        lastVisibilityChange = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  const verifyDatabaseConnection = async () => {
    setIsCheckingConnection(true);
    try {
      setDbConnected(await checkDatabaseConnection());
    } catch {
      setDbConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  useEffect(() => {
    if (authLoading || !currentUser) return;

    checkForMasterDataUpdates();
    const interval = setInterval(() => checkForMasterDataUpdates(), 5 * 60 * 1000);
    const handle = () => { if (document.visibilityState === 'visible') checkForMasterDataUpdates(); };
    document.addEventListener('visibilitychange', handle);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handle); };
  }, [authLoading, currentUser?.uid]);

  const appVersion = `${version} - DC`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen mobile-padding bg-background">
      <Card className="w-full max-w-5xl shadow-lg rounded-xl">
        <CardContent className="p-6 sm:p-8 md:p-10">

          {/* Admin button — top left */}
          {!authLoading && isCurrentUserAdmin && (
            <div className="flex justify-start mb-4">
              <Link href="/admin/dashboard" passHref>
                <button className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted/80 hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm hover:shadow-md">
                  <Settings className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" />
                  <span className="text-xs font-medium">Panel de Administración</span>
                  <ArrowRight className="h-3 w-3 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </Link>
            </div>
          )}

          {/* Header */}
          <div className="mb-8 sm:mb-10 text-center">
            <div className="mb-5">
              <WelcomeDisplay />
            </div>

            {/* DB status */}
            <div className="flex justify-center">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-all duration-300 ${
                dbConnected === null
                  ? 'border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700'
                  : dbConnected
                  ? 'border-green-500 bg-green-50 dark:bg-emerald-950/20 dark:border-emerald-500/50'
                  : 'border-red-500 bg-red-50 dark:bg-red-950/20 dark:border-red-500/50'
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
                      <Button size="sm" variant="outline" onClick={verifyDatabaseConnection} disabled={isCheckingConnection}
                        className="border-red-400 text-red-700 dark:text-red-400 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50 h-7 text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reconectar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Module grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

            {hasModule('cajas-chicas') && (
              <Link href="/city-selection" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-transparent hover:text-teal-700 dark:hover:text-teal-300">
                  <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Cajas Chicas</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-teal-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {hasModule('ordenes') && (
              <Link href="/service-order" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-primary/20 text-primary hover:bg-transparent hover:text-primary">
                  <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Órdenes de Servicio</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-primary/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {hasModule('liquidacion') && (
              <Link href="/guide-liquidation" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-transparent hover:text-cyan-700 dark:hover:text-cyan-300">
                  <Wallet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Liquidación de Guías</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-cyan-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {hasModule('aportar-datos') && (
              <Link href="/admin/contribute" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-transparent hover:text-blue-600 dark:hover:text-blue-400">
                  <Database className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Aportar Datos</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-blue-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {hasModule('reportes') && (
              <Button variant="outline" onClick={() => setIsDownloadModalOpen(true)} className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-green-600/20 text-green-700 dark:text-green-400 hover:bg-transparent hover:text-green-800 dark:hover:text-green-300">
                <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold">Reportes Mensuales</span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-green-600/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            )}

            {!authLoading && hasModule('editar-logica') && (
              <Link href="/admin/edit-service-order-logic" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-transparent hover:text-amber-600 dark:hover:text-amber-400">
                  <ClipboardEdit className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-3" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Editar Lógica</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-amber-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}

            {hasModule('timeline') && (
              <Button variant="outline" onClick={() => setIsTimelineActive(true)} className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 sm:px-8 group border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-transparent hover:text-indigo-600 dark:hover:text-indigo-400">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                <div className="text-left flex-grow">
                  <span className="block text-xl sm:text-2xl font-bold">Timeline de Órdenes</span>
                </div>
                <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-indigo-500/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            )}

            {!authLoading && hasModule('vuelos') && (
              <Link href="/flight-search" passHref>
                <Button variant="outline" className="w-full h-auto min-h-[80px] py-5 sm:py-6 mobile-text-lg flex flex-row items-center justify-start shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_14px_34px_hsl(var(--primary)/0.18)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.28),0_18px_42px_hsl(var(--primary)/0.28)] transition-all duration-300 rounded-xl px-6 sm:px-8 group border-primary/25 text-primary hover:bg-transparent hover:text-primary dark:text-primary dark:hover:text-primary">
                  <Plane className="h-10 w-10 sm:h-12 sm:w-12 mr-4 sm:mr-6 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  <div className="text-left flex-grow">
                    <span className="block text-xl sm:text-2xl font-bold">Buscador de Vuelos</span>
                  </div>
                  <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 ml-auto text-primary/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
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
              <Button onClick={() => setIsTimelineActive(false)} variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
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

      <MonthlyDownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados. (Versión: {appVersion})</p>
      </footer>
    </div>
  );
}

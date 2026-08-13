
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, FilePenLine, Users, ArrowRight, Settings, Loader2, ClipboardEdit, BarChart3, LineChart, Save, LayoutGrid, Plane, Radio } from "lucide-react";
import { useAuth, type UserProfile, type AppModule } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { getAllReportsFromFirestore } from '@/lib/reportService';
import { setUserModules } from '@/lib/appConfigService';
import { getFlightSearchUsageStats, type FlightSearchUsageStats } from '@/lib/flightSearchCounterService';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Legend,
  LineChart as RechartsLineChart
} from 'recharts';


interface AdminLinkCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

interface GuideUsageData {
  name: string;
  count: number;
}

interface MonthlyReportData {
  month: string;
  reportes: number;
}

const formatUsd = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 });


const AdminLinkCard: React.FC<AdminLinkCardProps> = ({ href, icon: Icon, title, description }) => (
  <Link href={href} passHref>
    <Card className="hover:border-primary hover:shadow-lg transition-all duration-300 group h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardContent className="pt-0">
        <Button variant="link" className="p-0 text-primary group-hover:underline">
          Ir a {title}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  </Link>
);


export default function AdminDashboardPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading, getAllUserProfiles } = useAuth();
  const { toast } = useToast();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [guideUsage, setGuideUsage] = useState<GuideUsageData[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportData[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userModules, setUserModules_state] = useState<Record<string, AppModule[]>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [flightUsage, setFlightUsage] = useState<FlightSearchUsageStats | null>(null);
  const [airLabsUsage, setAirLabsUsage] = useState<FlightSearchUsageStats | null>(null);

  const ALL_MODULES: { key: AppModule; label: string }[] = [
    { key: 'cajas-chicas', label: 'Cajas Chicas' },
    { key: 'ordenes', label: 'Órdenes de Servicio' },
    { key: 'liquidacion', label: 'Liquidación de Guías' },
    { key: 'aportar-datos', label: 'Aportar Datos' },
    { key: 'reportes', label: 'Reportes Mensuales' },
    { key: 'timeline', label: 'Timeline de Órdenes' },
    { key: 'editar-logica', label: 'Editar Lógica' },
    { key: 'vuelos', label: 'Buscador de Vuelos' },
  ];


  useEffect(() => {
    if (!authLoading) {
      if (!isCurrentUserAdmin) {
        toast({
          title: "Acceso Denegado",
          description: "No tienes permisos para acceder a esta sección.",
          variant: "destructive",
        });
        router.replace('/');
      } else {
        const fetchData = async () => {
          setIsLoadingData(true);
          try {
            // Fetch all data in parallel
            const [reports, userProfiles, flightStats, airLabsStats] = await Promise.all([
              getAllReportsFromFirestore(),
              getAllUserProfiles(),
              getFlightSearchUsageStats('aeroapi'),
              getFlightSearchUsageStats('airlabs'),
            ]);
            setFlightUsage(flightStats);
            setAirLabsUsage(airLabsStats);

            const nonAdminUsers = userProfiles
              .filter((u: UserProfile) => u.email && !u.isAdmin)
              .sort((a: UserProfile, b: UserProfile) => (a.email || "").localeCompare(b.email || ""));
            setAllUsers(nonAdminUsers);

            const modulesMap: Record<string, AppModule[]> = {};
            nonAdminUsers.forEach((u: UserProfile) => {
              modulesMap[u.uid] = (u.modules as AppModule[]) || [];
            });
            setUserModules_state(modulesMap);

            if (reports.length > 0) {
              // Process guide usage data
              const guideCounts: { [key: string]: number } = {};
              reports.forEach((report: import('@/lib/reportService').ReportInfo) => {
                const guideName = report.guideName || "Desconocido";
                guideCounts[guideName] = (guideCounts[guideName] || 0) + 1;
              });
              const guideData = Object.entries(guideCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10); // Top 10 guides
              setGuideUsage(guideData);

              // Process monthly report data for the last 6 months
              const monthlyCounts: { [key: string]: number } = {};
              reports.forEach((report: import('@/lib/reportService').ReportInfo) => {
                if (report.generationDate && typeof report.generationDate.toDate === 'function') {
                  const date = report.generationDate.toDate();
                  const monthKey = format(date, 'yyyy-MM');
                  monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
                }
              });

              const last6Months: MonthlyReportData[] = [];
              const today = new Date();
              for (let i = 5; i >= 0; i--) {
                const date = subMonths(today, i);
                const monthKey = format(date, 'yyyy-MM');
                const monthName = format(date, 'MMMM', { locale: es });
                const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                last6Months.push({
                  month: capitalizedMonthName,
                  reportes: monthlyCounts[monthKey] || 0,
                });
              }
              setMonthlyReports(last6Months);
            }

          } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos del panel.", variant: "destructive" });
          } finally {
            setIsLoadingData(false);
          }
        };
        fetchData();
      }
    }
  }, [authLoading, isCurrentUserAdmin, router, toast, getAllUserProfiles]);

  useEffect(() => {
    if (authLoading || !isCurrentUserAdmin) return;

    const refreshFlightUsage = async () => {
      try {
        const [flightStats, airLabsStats] = await Promise.all([
          getFlightSearchUsageStats('aeroapi'),
          getFlightSearchUsageStats('airlabs'),
        ]);
        setFlightUsage(flightStats);
        setAirLabsUsage(airLabsStats);
      } catch (error) {
        console.error("Failed to refresh flight usage stats:", error);
      }
    };

    const intervalId = window.setInterval(refreshFlightUsage, 30000);
    return () => window.clearInterval(intervalId);
  }, [authLoading, isCurrentUserAdmin]);

  const toggleModule = (uid: string, mod: AppModule) => {
    setUserModules_state(prev => {
      const current = prev[uid] || [];
      const updated = current.includes(mod)
        ? current.filter(m => m !== mod)
        : [...current, mod];
      return { ...prev, [uid]: updated };
    });
  };

  const handleSaveUserModules = async (uid: string) => {
    setSavingUid(uid);
    try {
      await setUserModules(uid, userModules[uid] || []);
      toast({ title: "Módulos guardados", variant: "success" });
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los módulos.", variant: "destructive" });
    } finally {
      setSavingUid(null);
    }
  };

  const flightPeak = flightUsage?.today.reduce(
    (peak, item) => item.searches > peak.searches ? item : peak,
    { hour: "--", searches: 0 }
  );

  if (authLoading || (!isCurrentUserAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8 space-y-6">
      <div className="w-full max-w-6xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go home">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-6xl shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-lg border">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-3xl font-headline text-primary">Panel de Administración</CardTitle>
              <CardDescription>Gestiona los datos, la lógica de negocio y los usuarios de la aplicación.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AdminLinkCard
              href="/admin/data"
              icon={Database}
              title="Administrar Datos Maestros"
              description="Añade, edita o elimina guías, hoteles, choferes y actividades."
            />
            <AdminLinkCard
              href="/admin/edit-petty-cash-logic"
              icon={FilePenLine}
              title="Editar Lógica de Caja Chica"
              description="Modifica las reglas de gastos automáticos para La Paz."
            />
            <AdminLinkCard
              href="/admin/edit-service-order-logic"
              icon={ClipboardEdit}
              title="Editar Lógica de Órdenes"
              description="Define las reglas para la generación de órdenes de servicio."
            />
            <AdminLinkCard
              href="/admin/users"
              icon={Users}
              title="Administrar Usuarios"
              description="Visualiza todos los usuarios registrados y sus estadísticas de uso."
            />
          </div>
        </CardContent>
      </Card>

      <div className="w-full max-w-6xl">
        <Card className="shadow-lg overflow-hidden border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Plane className="text-primary" /> Control de consultas de vuelos
                </CardTitle>
                <CardDescription>
                  Contadores separados para FlightAware y AirLabs. NAABOL no consume estos cupos.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit gap-2 border-primary/30 bg-primary/5 text-primary">
                <Radio className="h-3.5 w-3.5" />
                Actualiza cada 30s
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingData && !flightUsage ? (
              <div className="flex justify-center items-center h-44">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : flightUsage ? (
              <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] gap-6">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <div className="text-sm font-semibold">Flujo del buscador</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Hoy: NAABOL, luego AirLabs, luego FlightAware. Fechas futuras: FlightAware.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">FlightAware hoy</div>
                      <div className="mt-2 text-3xl font-bold text-primary">{flightUsage.todayTotal}</div>
                      <div className="text-xs text-muted-foreground">
                        {flightUsage.todayRemaining} de {flightUsage.dailyLimit} disponibles
                      </div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Mes actual</div>
                      <div className="mt-2 text-3xl font-bold text-primary">{flightUsage.monthTotal}</div>
                      <div className="text-xs text-muted-foreground">{formatUsd(flightUsage.estimatedMonthCost)}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">AirLabs hoy</div>
                      <div className="mt-2 text-3xl font-bold text-primary">{airLabsUsage?.todayTotal ?? 0}</div>
                      <div className="text-xs text-muted-foreground">
                        {airLabsUsage?.todayRemaining ?? 0} de {airLabsUsage?.dailyLimit ?? 0} disponibles
                      </div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">AirLabs mes</div>
                      <div className="mt-2 text-3xl font-bold text-primary">{airLabsUsage?.monthTotal ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Contador separado</div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Límite diario FlightAware</div>
                        <div className="text-xs text-muted-foreground">
                          Usadas {flightUsage.todayTotal} de {flightUsage.dailyLimit}. Estimado hoy: {formatUsd(flightUsage.estimatedTodayCost)}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary">{flightUsage.limitUsedPercent.toFixed(1)}%</div>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${flightUsage.limitUsedPercent}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <span>Costo por búsqueda: {formatUsd(flightUsage.costPerResultSet)}</span>
                      <span className="text-right">Crédito mensual restante: {formatUsd(flightUsage.remainingCreditUsd)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-background/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Consultas por hora</div>
                      <div className="text-xs text-muted-foreground">
                        Última lectura: {format(flightUsage.lastUpdated, 'HH:mm:ss')}
                      </div>
                    </div>
                    <Badge variant="secondary">{flightUsage.todayTotal} hoy</Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={flightUsage.today} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                      <Bar dataKey="searches" fill="hsl(var(--primary))" name="Consultas" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground">No se pudieron cargar las estadísticas de vuelos.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <LayoutGrid className="text-primary" /> Asignar Módulos por Usuario
            </CardTitle>
            <CardDescription>
              Activa o desactiva los módulos que cada usuario puede ver en el menú principal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No hay usuarios registrados.</div>
            ) : (
              <div className="space-y-4">
                {allUsers.map(user => (
                  <div key={user.uid} className="border rounded-xl p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold truncate">{user.email}</span>
                      <Button
                        size="sm"
                        onClick={() => handleSaveUserModules(user.uid)}
                        disabled={savingUid === user.uid}
                        className="shrink-0"
                      >
                        {savingUid === user.uid
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          : <Save className="h-4 w-4 mr-1" />}
                        Guardar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {ALL_MODULES.map(mod => {
                        const active = (userModules[user.uid] || []).includes(mod.key);
                        return (
                          <div
                            key={mod.key}
                            onClick={() => toggleModule(user.uid, mod.key)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all select-none",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                            )}
                          >
                            <Checkbox
                              checked={active}
                              onCheckedChange={() => toggleModule(user.uid, mod.key)}
                              className="pointer-events-none"
                            />
                            {mod.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Card className="shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <LineChart className="text-primary" /> Reportes por Mes
            </CardTitle>
            <CardDescription>Reportes descargados en los últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : monthlyReports.some(d => d.reportes > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={monthlyReports} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--foreground))' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="reportes" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Reportes Descargados" />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-muted-foreground">No hay suficientes datos de reportes.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-6xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="text-primary" /> Uso por Guía
            </CardTitle>
            <CardDescription>Top 10 guías con más reportes generados.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : guideUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={guideUsage} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'hsl(var(--foreground))' }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Reportes" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p className="text-muted-foreground">No hay suficientes datos de reportes.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

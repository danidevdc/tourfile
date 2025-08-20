
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, FilePenLine, Users, ArrowRight, Settings, Loader2, ClipboardEdit, BarChart3, LineChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { getAllReportsFromFirestore, type ReportInfo } from '@/lib/reportService';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [guideUsage, setGuideUsage] = useState<GuideUsageData[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportData[]>([]);


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
                const reports = await getAllReportsFromFirestore();
                
                if (reports.length > 0) {
                    // Process guide usage data
                    const guideCounts: { [key: string]: number } = {};
                    reports.forEach(report => {
                        guideCounts[report.guideName] = (guideCounts[report.guideName] || 0) + 1;
                    });
                    const guideData = Object.entries(guideCounts)
                        .map(([name, count]) => ({ name, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10); // Top 10 guides
                    setGuideUsage(guideData);

                    // Process monthly report data for the last 6 months
                    const monthlyCounts: { [key: string]: number } = {};
                    reports.forEach(report => {
                        const date = report.generationDate.toDate();
                        const monthKey = format(date, 'yyyy-MM');
                        monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
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
                toast({ title: "Error", description: "No se pudieron cargar los datos del panel.", variant: "destructive"});
              } finally {
                setIsLoadingData(false);
              }
            };
            fetchData();
        }
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8 space-y-6">
      <div className="w-full max-w-6xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
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
              title="Administrar Datos"
              description="Añade, edita o elimina hoteles, choferes y actividades."
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
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="text-primary"/> Uso por Guía
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
                  <BarChart data={guideUsage} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Reportes" barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-64">
                    <p className="text-muted-foreground">No hay suficientes datos de reportes.</p>
                </div>
              )}
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <LineChart className="text-primary"/> Reportes por Mes
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
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="reportes" stroke="hsl(var(--primary))" strokeWidth={2} name="Reportes Descargados" />
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

    </div>
  );
}

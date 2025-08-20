
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, ShieldCheck, ShieldOff, Trash2, BarChart3, LineChart } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { getAllReportsFromFirestore, type ReportInfo } from '@/lib/reportService';
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
  LineChart as RechartsLineChart // Renamed to avoid conflict with lucide-react icon
} from 'recharts';


interface GuideUsageData {
  name: string;
  count: number;
}

interface MonthlyReportData {
  month: string;
  reportes: number;
}

export default function AdminUsersPage() {
  const { isCurrentUserAdmin, isLoading: authLoading, getAllUserProfiles, deleteUserFromFirestore, currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  const [guideUsage, setGuideUsage] = useState<GuideUsageData[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportData[]>([]);


  useEffect(() => {
    if (!authLoading) {
      if (!isCurrentUserAdmin) {
        toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder a esta página.", variant: "destructive"});
        router.replace('/'); 
      } else {
        const fetchData = async () => {
          setIsLoadingData(true);
          try {
            const [userProfiles, reports] = await Promise.all([
              getAllUserProfiles(),
              getAllReportsFromFirestore()
            ]);
            
            setUsers(userProfiles);

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
            console.error("Failed to fetch admin data:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos de administración.", variant: "destructive"});
          } finally {
            setIsLoadingData(false);
          }
        };
        fetchData();
      }
    }
  }, [isCurrentUserAdmin, authLoading, router, getAllUserProfiles, toast]);

  const handleDeleteUser = async () => {
    if (!userToDelete || !userToDelete.uid) return;
    if (userToDelete.uid === currentUser?.uid) {
      toast({ title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta.", variant: "destructive" });
      setUserToDelete(null);
      return;
    }
    
    if (userToDelete.email === 'daniish77@gmail.com' && userToDelete.uid !== currentUser?.uid) {
        toast({ title: "Acción no permitida", description: "No se puede eliminar la cuenta de administrador principal.", variant: "destructive" });
        setUserToDelete(null);
        return;
    }

    try {
      await deleteUserFromFirestore(userToDelete.uid);
      setUsers(prevUsers => prevUsers.filter(user => user.uid !== userToDelete.uid));
      toast({ title: "Usuario Eliminado", description: "El perfil del usuario ha sido eliminado. La cuenta de autenticación debe ser eliminada manualmente desde Firebase Console.", className: "bg-green-100 dark:bg-green-900 border-green-500", duration: 7000 });

    } catch (error) {
      // Error toast is handled within deleteUserFromFirestore
    } finally {
      setUserToDelete(null); 
    }
  };


  if (authLoading || (!isCurrentUserAdmin && !authLoading) ) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8 space-y-6">
      <div className="w-full max-w-4xl">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Administración de Usuarios</CardTitle>
          <CardDescription className="text-center">
            Lista de todos los usuarios registrados en el sistema. Para añadir un nuevo usuario/guía, utiliza la <Link href="/register" className="text-primary underline">página de registro</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Cargando usuarios...</p>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No hay usuarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo Electrónico</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead className="text-center">Reportes Generados</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-center">
                        {user.isAdmin ? (
                          <ShieldCheck className="h-5 w-5 text-green-500 mx-auto" title="Administrador" />
                        ) : (
                          <ShieldOff className="h-5 w-5 text-muted-foreground mx-auto" title="Usuario regular" />
                        )}
                      </TableCell>
                      <TableCell>
                        {user.createdAt instanceof Timestamp
                          ? format(user.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: es })
                          : user.createdAt?.toString() || 'N/A'}
                      </TableCell>
                       <TableCell className="text-center font-medium">{user.generatedReportsCount || 0}</TableCell>
                      <TableCell className="text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button
                                variant="destructive"
                                size="icon"
                                title="Eliminar Perfil de Usuario"
                                disabled={user.uid === currentUser?.uid || (user.email === 'daniish77@gmail.com' && user.uid !== currentUser?.uid)}
                                onClick={() => setUserToDelete(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          {userToDelete && userToDelete.uid === user.uid && ( 
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro de eliminar este perfil?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el perfil de Firestore para <strong className="text-foreground">{userToDelete.email}</strong>.
                                  El usuario correspondiente en Firebase Authentication no será eliminado por esta acción y deberá gestionarse manualmente si es necesario. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteUser}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  Sí, eliminar perfil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          )}
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
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


"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ArrowLeft, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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


export default function AdminUsersPage() {
  const { isCurrentUserAdmin, isLoading: authLoading, getAllUserProfiles, deleteUserFromFirestore, currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [monthlyReportCounts, setMonthlyReportCounts] = useState<{ [email: string]: { [month: string]: number } }>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const [reportMonths, setReportMonths] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (!isCurrentUserAdmin) {
        toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder a esta página.", variant: "destructive"});
        router.replace('/'); 
      } else {
        const fetchData = async () => {
          setIsLoadingData(true);
          try {
            const [userProfiles, allReports] = await Promise.all([
                getAllUserProfiles(),
                getAllReportsFromFirestore()
            ]);
            setUsers(userProfiles);

            const counts: { [email: string]: { [month: string]: number } } = {};
            const months = new Set<string>();

            allReports.forEach(report => {
                if (report.generatedBy && report.generationDate && typeof report.generationDate.toDate === 'function') {
                    const email = report.generatedBy.toLowerCase();
                    const date = report.generationDate.toDate();
                    const monthKey = format(date, 'MMMM', { locale: es });
                    const capitalizedMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

                    months.add(capitalizedMonth);
                    
                    if (!counts[email]) {
                        counts[email] = {};
                    }
                    counts[email][capitalizedMonth] = (counts[email][capitalizedMonth] || 0) + 1;
                }
            });
            
            const sortedMonths = Array.from(months).sort((a, b) => {
              const order = ['Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
              return (order.indexOf(a) - order.indexOf(b));
            });

            setReportMonths(sortedMonths);
            setMonthlyReportCounts(counts);

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

 const processedUsers = useMemo(() => {
    return users.map(user => {
      const email = user.email ? user.email.toLowerCase() : '';
      const monthlyData = monthlyReportCounts[email] || {};
      const totalFromMonths = reportMonths.reduce((sum, month) => sum + (monthlyData[month] || 0), 0);
      
      const historicalTotal = user.generatedReportsCount || 0;
      const julioCount = Math.max(0, historicalTotal - totalFromMonths);

      return {
        ...user,
        monthlyData: {
          'Julio': julioCount,
          ...monthlyData
        },
      };
    });
  }, [users, monthlyReportCounts, reportMonths]);

  const finalMonthsHeader = ['Julio', ...reportMonths];

  const totals = useMemo(() => {
    return finalMonthsHeader.reduce((acc, month) => {
      acc[month] = processedUsers.reduce((sum, user) => sum + (user.monthlyData[month] || 0), 0);
      return acc;
    }, {} as { [key: string]: number });
  }, [processedUsers, finalMonthsHeader]);


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
      toast({ title: "Usuario Eliminado", description: "El perfil del usuario ha sido eliminado. La cuenta de autenticación debe ser eliminada manually desde Firebase Console.", className: "bg-green-100 dark:bg-green-900 border-green-500", duration: 7000 });

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
      <div className="w-full max-w-7xl">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-7xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Administración de Usuarios</CardTitle>
          <CardDescription className="text-center">
            Lista de todos los usuarios registrados en el sistema y su actividad por mes.
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
                    <TableHead>Último Ingreso</TableHead>
                    {finalMonthsHeader.map(month => (
                      <TableHead key={month} className="text-center">Reportes {month}</TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedUsers.map((user) => (
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
                        {user.createdAt ? format(user.createdAt, 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {user.lastSignInTime ? format(user.lastSignInTime, 'dd/MM/yyyy HH:mm', { locale: es }) : 'Nunca'}
                      </TableCell>
                      {finalMonthsHeader.map(month => (
                         <TableCell key={month} className="text-center font-medium">{user.monthlyData[month] || 0}</TableCell>
                      ))}
                      <TableCell className="text-center font-bold">{user.generatedReportsCount || 0}</TableCell>
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
                <TableFooter>
                    <TableRow className="bg-muted/50 hover:bg-muted">
                        <TableCell colSpan={4} className="font-bold text-right">TOTALES</TableCell>
                        {finalMonthsHeader.map(month => (
                          <TableCell key={`total-${month}`} className="text-center font-bold">{totals[month] || 0}</TableCell>
                        ))}
                        <TableCell className="text-center font-bold">
                          {Object.values(totals).reduce((sum, count) => sum + count, 0)}
                        </TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

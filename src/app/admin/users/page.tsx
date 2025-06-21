
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserProfile } from '@/hooks/useAuth'; // UserProfile debe ser exportado desde useAuth
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
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

export default function AdminUsersPage() {
  const { isCurrentUserAdmin, isLoading: authLoading, getAllUserProfiles, deleteUserFromFirestore, currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!isCurrentUserAdmin) {
        toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder a esta página.", variant: "destructive"});
        router.replace('/'); 
      } else {
        const fetchUsers = async () => {
          setIsLoadingUsers(true);
          try {
            const userProfiles = await getAllUserProfiles();
            setUsers(userProfiles);
          } catch (error) {
            // Toast for error fetching users is handled in getAllUserProfiles
            console.error("Failed to fetch users for admin page:", error);
          } finally {
            setIsLoadingUsers(false);
          }
        };
        fetchUsers();
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
    // Assuming ADMIN_EMAIL is 'daniish77@gmail.com' as per useAuth
    if (userToDelete.email === 'daniish77@gmail.com' && userToDelete.uid !== currentUser?.uid) {
        toast({ title: "Acción no permitida", description: "No se puede eliminar la cuenta de administrador principal.", variant: "destructive" });
        setUserToDelete(null);
        return;
    }

    try {
      await deleteUserFromFirestore(userToDelete.uid);
      setUsers(prevUsers => prevUsers.filter(user => user.uid !== userToDelete.uid));
      // Positive toast is handled within deleteUserFromFirestore
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
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Administración de Usuarios</CardTitle>
          <CardDescription className="text-center">
            Lista de todos los usuarios registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
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
                    <TableHead className="text-center">Reportes</TableHead>
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
                      <TableCell className="text-center">{user.generatedReportsCount || 0}</TableCell>
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
    </div>
  );
}

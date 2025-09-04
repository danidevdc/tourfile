
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { 
  getServiceOrderRules,
  saveServiceOrderRules,
  deleteServiceOrderRule,
  initializeDefaultServiceOrderRules,
  type ServiceOrderRule,
} from '@/lib/serviceOrderRuleService';
import { getActivitiesFromFirestore, type Activity } from '@/lib/serviceOrderService';
import { getIntermediateUserEmail } from '@/lib/appConfigService';
import { Switch } from '@/components/ui/switch';


export default function EditServiceOrderLogicPage() {
  const { isCurrentUserAdmin, currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rules, setRules] = useState<ServiceOrderRule[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<ServiceOrderRule | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
        if (authLoading) return;

        setIsCheckingPermission(true);
        if (isCurrentUserAdmin) {
            setHasPermission(true);
            setIsCheckingPermission(false);
            return;
        }

        try {
            const intermediateEmail = await getIntermediateUserEmail();
            if (currentUser?.email && currentUser.email === intermediateEmail) {
                setHasPermission(true);
            } else {
                setHasPermission(false);
                toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder a esta página.", variant: "destructive" });
                router.replace('/');
            }
        } catch (error) {
            console.error("Permission check failed:", error);
            setHasPermission(false);
            toast({ title: "Error de Permisos", description: "No se pudo verificar tu nivel de acceso.", variant: "destructive" });
            router.replace('/');
        } finally {
            setIsCheckingPermission(false);
        }
    }
    checkPermissions();
  }, [authLoading, isCurrentUserAdmin, currentUser, router, toast]);

  useEffect(() => {
    async function fetchLogicData() {
      if (hasPermission) {
        setIsLoading(true);
        try {
          await initializeDefaultServiceOrderRules(); 
          
          const [fetchedRules, fetchedActivities] = await Promise.all([
            getServiceOrderRules(),
            getActivitiesFromFirestore(),
          ]);

          setRules(fetchedRules.sort((a, b) => a.order - b.order));
          setActivities(fetchedActivities);
        } catch (error) {
          console.error("Error loading logic data:", error);
          toast({ title: "Error", description: "No se pudieron cargar las reglas y actividades.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    }
    if (!authLoading && hasPermission) {
      fetchLogicData();
    }
  }, [hasPermission, authLoading, toast]);


  const handleInputChange = (id: string, field: keyof ServiceOrderRule, value: string | boolean) => {
    setRules(prevRules =>
      prevRules.map(rule =>
        rule.id === id ? { ...rule, [field]: value } : rule
      )
    );
  };

  const handleAddNewRule = () => {
    const newRule: ServiceOrderRule = {
      id: `new_${Date.now()}`,
      keyword: '',
      activity: '',
      isActive: true,
      order: rules.length > 0 ? Math.max(...rules.map(r => r.order)) + 1 : 0,
    };
    setRules(prevRules => [...prevRules, newRule]);
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    
    if (ruleToDelete.id.startsWith('new_')) {
      setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
      toast({ title: "Regla Removida", description: "La nueva regla ha sido descartada.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      setRuleToDelete(null);
      return;
    }

    try {
      await deleteServiceOrderRule(ruleToDelete.id);
      setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
      toast({ title: "Regla Eliminada", description: "La regla ha sido eliminada permanentemente.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la regla.", variant: "destructive" });
    } finally {
      setRuleToDelete(null);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Save all current rules (new and existing) to Firestore
      await saveServiceOrderRules(rules);
      
      // After saving, re-fetch all rules from Firestore to get a fresh list
      // with new IDs assigned by the database and to confirm the state.
      const fetchedRules = await getServiceOrderRules();
      setRules(fetchedRules.sort((a, b) => a.order - b.order));
      
      toast({ title: "Éxito", description: "Todas las reglas han sido guardadas.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } catch (error) {
      toast({ title: "Error al Guardar", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const activityOptions = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name }));

  if (authLoading || isCheckingPermission || isLoading || !hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4 flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className='flex gap-2'>
            <Button onClick={handleAddNewRule} variant='outline'>
                <PlusCircle className="mr-2 h-5 w-5" />
                Añadir Regla
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Guardar Cambios
            </Button>
        </div>
      </div>
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Editor de Lógica de Órdenes de Servicio</CardTitle>
          <CardDescription className="text-center">
            Define las reglas para la generación automatizada de órdenes de servicio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[100px]'>Activa</TableHead>
                  <TableHead className='w-[40%]'>Palabra Clave (del Excel)</TableHead>
                  <TableHead className='w-[40%]'>Actividad (de la Base de Datos)</TableHead>
                  <TableHead className='w-[100px] text-center'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(value) => handleInputChange(rule.id, 'isActive', value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={rule.keyword}
                        onChange={(e) => handleInputChange(rule.id, 'keyword', e.target.value)}
                        placeholder="Ej: CITY TOUR"
                      />
                    </TableCell>
                    <TableCell>
                       <Combobox
                          options={activityOptions}
                          value={rule.activity}
                          onSelect={(value) => handleInputChange(rule.id, 'activity', value)}
                          placeholder="Seleccionar actividad..."
                       />
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title="Eliminar Regla" onClick={() => setRuleToDelete(rule)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          {ruleToDelete?.id === rule.id && (
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Estás seguro de eliminar esta regla?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará la regla para <strong className="text-foreground">{ruleToDelete.keyword}</strong>. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setRuleToDelete(null)}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive hover:bg-destructive/90">
                                    Sí, eliminar
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
        </CardContent>
      </Card>
    </div>
  );
}

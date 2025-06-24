
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
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
  getExpenseRulesFromFirestore, 
  saveExpenseRulesToFirestore,
  deleteExpenseRuleFromFirestore,
  type ExpenseRule,
  initializeDefaultRules, 
} from '@/lib/ruleService';
import { Switch } from '@/components/ui/switch';


export default function EditLogicPage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rules, setRules] = useState<ExpenseRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<ExpenseRule | null>(null);

  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  useEffect(() => {
    async function fetchRules() {
      if (isCurrentUserAdmin) {
        setIsLoading(true);
        try {
          await initializeDefaultRules(); // Ensures defaults exist if collection is empty
          const fetchedRules = await getExpenseRulesFromFirestore('La Paz');
          setRules(fetchedRules.sort((a, b) => a.order - b.order));
        } catch (error) {
          toast({ title: "Error", description: "No se pudieron cargar las reglas.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    }
    if (!authLoading) {
        fetchRules();
    }
  }, [isCurrentUserAdmin, authLoading, toast]);


  const handleInputChange = (id: string, field: keyof ExpenseRule, value: string | number | boolean) => {
    setRules(prevRules =>
      prevRules.map(rule =>
        rule.id === id ? { ...rule, [field]: value } : rule
      )
    );
  };

  const handleAddNewRule = () => {
    const newRule: ExpenseRule = {
      id: `new_${Date.now()}`,
      keyword: '',
      detail: '',
      unitPrice: 0,
      quantityFormula: '1',
      city: 'La Paz',
      isActive: true,
      order: rules.length > 0 ? Math.max(...rules.map(r => r.order)) + 1 : 0,
    };
    setRules(prevRules => [...prevRules, newRule]);
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    
    // If it's a new rule not yet saved, just remove from state
    if (ruleToDelete.id.startsWith('new_')) {
      setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
      toast({ title: "Regla Removida", description: "La nueva regla ha sido descartada.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      setRuleToDelete(null);
      return;
    }

    // If it's a saved rule, delete from Firestore
    try {
      await deleteExpenseRuleFromFirestore(ruleToDelete.id);
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
      await saveExpenseRulesToFirestore(rules);
      // Refetch to get Firestore-generated IDs for new rules
      const fetchedRules = await getExpenseRulesFromFirestore('La Paz');
      setRules(fetchedRules.sort((a, b) => a.order - b.order));
      toast({ title: "Éxito", description: "Todas las reglas han sido guardadas.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } catch (error) {
      toast({ title: "Error al Guardar", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-6xl mb-4 flex justify-between items-center">
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
      <Card className="w-full max-w-6xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Editor de Lógica (La Paz)</CardTitle>
          <CardDescription className="text-center">
            Define las reglas para generar los reportes de caja chica. Usa `=$G$3` para el N° de PAX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[100px]'>Activa</TableHead>
                  <TableHead className='w-[200px]'>Palabra Clave (en Excel)</TableHead>
                  <TableHead>Detalle del Gasto (en Reporte)</TableHead>
                  <TableHead className='w-[150px]'>Precio Unitario</TableHead>
                  <TableHead className='w-[180px]'>Fórmula Cantidad</TableHead>
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
                        placeholder="Ej: desaguadero"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={rule.detail}
                        onChange={(e) => handleInputChange(rule.id, 'detail', e.target.value)}
                        placeholder="Ej: MALETAS FRONTERA"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rule.unitPrice}
                        onChange={(e) => handleInputChange(rule.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="Ej: 3.00"
                      />
                    </TableCell>
                     <TableCell>
                      <Input
                        value={rule.quantityFormula}
                        onChange={(e) => handleInputChange(rule.id, 'quantityFormula', e.target.value)}
                        placeholder="Ej: =$G$3+1"
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
                                    Se eliminará la regla para <strong className="text-foreground">{ruleToDelete.detail}</strong>. Esta acción no se puede deshacer.
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

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import {
  getDeletedOrdersPaginated,
  type StoredServiceOrder,
  updateServiceOrder,
  type OrderStatus,
} from '@/lib/serviceOrderStorage';
import { type QueryDocumentSnapshot } from 'firebase/firestore';
import { getFamilyId, shortPerson } from "@/lib/serviceOrderFamily";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trash2, RefreshCw, ChevronLeft, ChevronRight, User, Car } from "lucide-react";
import { PlaneSpinner } from "@/components/ui/plane-spinner";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 10;

export default function DeletedOrdersPage() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [orderToRestore, setOrderToRestore] = useState<StoredServiceOrder | null>(null);
  const [lastDocs, setLastDocs] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasMore, setHasMore] = useState(false);

  const families = useMemo(() => {
    const byId = new Map(orders.map(o => [o.id, o]));
    const familyGroups = new Map<string, { parent: StoredServiceOrder; children: StoredServiceOrder[] }>();

    for (const order of orders) {
      if (!order.data) continue;
      const familyId = getFamilyId(order);
      const parentOrder = byId.get(familyId);

      if (parentOrder) {
        if (!familyGroups.has(familyId)) {
          familyGroups.set(familyId, { parent: parentOrder, children: [] });
        }
        if (order.id !== familyId) {
          const existingChildren = familyGroups.get(familyId)!.children;
          if (!existingChildren.some(c => c.id === order.id)) {
            existingChildren.push(order);
          }
        }
      }
    }

    return Array.from(familyGroups.values())
      .map(group => ({
        ...group,
        children: group.children.sort((a, b) => a.orderName.localeCompare(b.orderName))
      }))
      .sort((a, b) => b.parent.createdAt.getTime() - a.parent.createdAt.getTime());
  }, [orders]);

  const fetchDeletedOrders = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const cursor = lastDocs[page - 1];
      const { orders: fetchedOrders, lastDoc } = await getDeletedOrdersPaginated(ITEMS_PER_PAGE, cursor);
      setOrders(fetchedOrders);

      if (lastDoc && page >= lastDocs.length) {
        setLastDocs(prev => {
          const nextCursors = [...prev];
          nextCursors[page] = lastDoc;
          return nextCursors;
        });
      }
      setHasMore(!!lastDoc);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar las órdenes eliminadas.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUser) {
      if (!isCurrentUserAdmin) {
        toast({ title: "Acceso Denegado", description: "Solo los administradores pueden ver esta página.", variant: "destructive" });
        router.push('/');
        return;
      }
      fetchDeletedOrders(currentPage);
    }
  }, [currentUser, authLoading, currentPage, isCurrentUserAdmin]);

  const handleRestoreOrder = async (order: StoredServiceOrder) => {
    if (!order) return;
    try {
      await updateServiceOrder(order.id, 'editado' as OrderStatus);
      toast({ title: "Éxito", description: `Orden ${order.orderName} restaurada correctamente.` });
      setOrderToRestore(null);
      fetchDeletedOrders(currentPage);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo restaurar la orden.", variant: "destructive" });
    }
  };

  const toggleFamilyExpansion = (familyId: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PlaneSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-[1600px]">
      <Card className="shadow-lg border-2">
        <CardHeader className="pb-3 border-b-2 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => router.push('/service-order')}
                className="hover:bg-white/50 dark:hover:bg-black/30"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                <CardTitle className="text-xl sm:text-2xl font-bold text-red-800 dark:text-red-200">
                  Órdenes Eliminadas
                </CardTitle>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-2 sm:p-4">
          {families.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">No hay órdenes eliminadas</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-r border-border/40">Nombre de la Orden</TableHead>
                      <TableHead className="border-r border-border/40">Responsable(s)</TableHead>
                      <TableHead className="border-r border-border/40">Creado Por</TableHead>
                      <TableHead className="w-[120px] border-r border-border/40">Fecha de registro</TableHead>
                      <TableHead className="text-left">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {families.map(({ parent, children }) => {
                      const isExpanded = expandedFamilies.has(parent.id);
                      const hasChildren = children.length > 0;
                      const date = format(parent.createdAt, 'dd/MM/yyyy', { locale: es });

                      const allResponsibles = new Set<string>();
                      if (parent.data?.guia) allResponsibles.add(parent.data.guia);
                      parent.data?.services?.forEach(s => {
                        if (s.guia) allResponsibles.add(s.guia);
                      });

                      return (
                        <React.Fragment key={parent.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell className="border-r border-border/40 font-medium">
                              <div className="flex items-center gap-2">
                                {hasChildren && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleFamilyExpansion(parent.id)}
                                  >
                                    {isExpanded ? '−' : '+'}
                                  </Button>
                                )}
                                <span className="break-words">{parent.orderName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="border-r border-border/40">
                              <div className="flex flex-wrap gap-1">
                                {Array.from(allResponsibles).map((resp, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {shortPerson(resp)}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="border-r border-border/40 text-xs">
                              {parent.createdBy || 'N/A'}
                            </TableCell>
                            <TableCell className="border-r border-border/40 text-xs">{date}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setOrderToRestore(parent)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Restaurar
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && children.map((child) => {
                            const isGuideChild = child.orderName.includes('— G-');
                            const Icon = isGuideChild ? User : Car;
                            const childDate = format(child.createdAt, 'dd/MM/yyyy', { locale: es });

                            return (
                              <TableRow key={child.id} className="bg-muted/20">
                                <TableCell className="border-r border-border/40 pl-12">
                                  <div className="flex items-center gap-2">
                                    <Icon className={cn("h-4 w-4", isGuideChild ? "text-purple-500" : "text-orange-500")} />
                                    <span className="text-sm">{child.orderName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="border-r border-border/40 text-xs text-muted-foreground">
                                  Orden hija
                                </TableCell>
                                <TableCell className="border-r border-border/40 text-xs">
                                  {child.createdBy || 'N/A'}
                                </TableCell>
                                <TableCell className="border-r border-border/40 text-xs">{childDate}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage}
                </span>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={!hasMore}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!orderToRestore} onOpenChange={() => setOrderToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas restaurar la orden <strong>{orderToRestore?.orderName}</strong>?
              Su estado cambiará a &quot;editado&quot; y volverá a aparecer en la lista principal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => orderToRestore && handleRestoreOrder(orderToRestore)}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

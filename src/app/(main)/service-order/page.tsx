
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import {
  getServiceOrdersPaginated,
  getTotalServiceOrdersCount,
  deleteBulkServiceOrders,
  updateServiceOrder,
  type StoredServiceOrder,
  saveServiceOrder,
  type OrderStatus,
  getChildrenByParentId,
  softCancelServiceOrder,
  saveEditedServiceOrder,
  deleteServiceOrder,
  getAllServiceOrders,
  runMigrateRoots,
} from '@/lib/serviceOrderStorage';
import { expandSearchResultsWithFamilies, smartSearch } from '@/lib/serviceOrderSearch';
import { checkDatabaseConnection } from "@/lib/dbConnectionCheck";
import { logger } from "@/lib/logger";
import { type QueryDocumentSnapshot } from 'firebase/firestore';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { getFamilyId, childNameFrom, getBaseName, shortPerson } from "@/lib/serviceOrderFamily";
import { showSimplePreviewModal } from '@/lib/simplePreviewModal';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, FilePlus, ListOrdered, Eye, Printer, Search, FilePenLine, Bot, ShieldAlert, FileDown, ChevronDown, ChevronLeft, ChevronRight, Image, Split, User, Car, CheckCircle2, XCircle, RefreshCw, Database, ClipboardEdit, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Receipt, MoreHorizontal } from "lucide-react";
import { LiquidationViewerModal } from "@/components/guide-liquidation/LiquidationViewerModal";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ServiceOrderGeneratorSheet } from "@/components/service-order/ServiceOrderGeneratorSheet";
import { ServiceOrderEditModal } from "@/components/service-order/ServiceOrderEditModal";
import ServiceOrderPreviewModal from "@/components/service-order/ServiceOrderPreviewModal";
import { getGuidesFromFirestore, getDriversFromFirestore, getHotelsFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore, getBusesFromFirestore, type ServiceOrderGuide, type Driver, type Hotel, type Activity, type PredefinedFlight, type Bus } from "@/lib/serviceOrderService";
import { Checkbox } from "@/components/ui/checkbox";
import { ServiceOrderMobileCard } from "@/components/service-order/ServiceOrderMobileCard";
import { agency } from "@/config/agency";


const defaultObsText = '';
const defaultNotaText = agency.defaultServiceOrderNote;

const initialOrderDataState: ServiceOrderData = {
  guia: '', file: '', ref: '', nPax: '', hotel: '', services: [],
  observations: defaultObsText, nota: defaultNotaText
};

const ITEMS_PER_PAGE = 10;
const DEFAULT_ORDER_WINDOW_DAYS = 28;

// Extend the Window interface to include our global function
declare global {
  interface Window {
    showSimplePreviewModal: (order: StoredServiceOrder, onStatusUpdate?: (orderId: string) => void) => void;
    __serviceOrdersMap: Map<string, StoredServiceOrder>;
    __handleStatusUpdate: (orderId: string) => void;
  }
}


export default function ServiceOrderListPage() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [flights, setFlights] = useState<PredefinedFlight[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalRootOrders, setTotalRootOrders] = useState<number | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAutomatedMode, setIsAutomatedMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [orderToEdit, setOrderToEdit] = useState<StoredServiceOrder | null>(null);
  const [orderToPreview, setOrderToPreview] = useState<StoredServiceOrder | null>(null);
  const [intermediateOrderData, setIntermediateOrderData] = useState<ServiceOrderData>(initialOrderDataState);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<StoredServiceOrder | null>(null);
  const [isPrintingPdfId, setIsPrintingPdfId] = useState<string | null>(null);
  const [liquidationViewerFile, setLiquidationViewerFile] = useState<string | null>(null);
  const canAccessLiquidation =
    isCurrentUserAdmin ||
    (currentUser?.profile?.modules || []).includes('liquidacion');

  const hasModule = (mod: AppModule): boolean => {
    if (!currentUser) return false;
    if (isCurrentUserAdmin) return true;
    return (currentUser?.profile?.modules || []).includes(mod);
  };

  // Pagination states
  const [lastDocs, setLastDocs] = useState<(QueryDocumentSnapshot | null)[]>([null]);

  // Sorting states
  type SortField = 'orderName' | 'status' | 'createdBy' | 'createdAt';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Search state improvement
  const [activeSearchTerm, setActiveSearchTerm] = useState(""); // This is the term actually being searched
  const recentOrdersSince = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - DEFAULT_ORDER_WINDOW_DAYS);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const families = useMemo(() => {
    // Siempre mostrar solo órdenes activas (excluir eliminadas y canceladas)
    const orderIsVisible = (order: StoredServiceOrder) => {
      const isInactive = order.status === 'eliminado' || order.status === 'cancelado';
      return !isInactive;
    };

    const visibleOrders = orders.filter(orderIsVisible);

    const searchedOrders = visibleOrders;

    const byId = new Map(searchedOrders.map(o => [o.id, o]));
    const familyGroups = new Map<string, { parent: StoredServiceOrder; children: StoredServiceOrder[] }>();

    for (const order of searchedOrders) {
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

    const sortedFamilies = Array.from(familyGroups.values())
      .map(group => ({
        ...group,
        children: group.children.sort((a, b) => a.orderName.localeCompare(b.orderName))
      }));

    // Apply sorting based on sortField and sortDirection
    sortedFamilies.sort((a, b) => {
      let compareResult = 0;
      
      switch (sortField) {
        case 'orderName':
          compareResult = a.parent.orderName.localeCompare(b.parent.orderName);
          break;
        case 'status':
          compareResult = (a.parent.status || '').localeCompare(b.parent.status || '');
          break;
        case 'createdBy':
          compareResult = (a.parent.createdBy || '').localeCompare(b.parent.createdBy || '');
          break;
        case 'createdAt':
        default:
          compareResult = a.parent.createdAt.getTime() - b.parent.createdAt.getTime();
          break;
      }
      
      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return sortedFamilies;

  }, [orders, activeSearchTerm, isCurrentUserAdmin, sortField, sortDirection]);

  const displayedFamilies = useMemo(() => {
    if (activeSearchTerm.trim().length > 0) {
      // Paginate search results (10 per page) for consistent UI
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return families.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }
    return families;
  }, [families, activeSearchTerm, currentPage]);

  const fetchOrders = async (page: number = 1) => {
    setIsLoading(true);
    try {
      if (activeSearchTerm.trim().length > 0) {
        // Smart Search Mode: Use optimized field-specific queries
        logger.debug(`🔍 Smart Search: "${activeSearchTerm}"`);
        const searchResults = await smartSearch(activeSearchTerm);
        const expandedSearchResults = await expandSearchResultsWithFamilies(searchResults.results);
        setOrders(expandedSearchResults);
        setHasMore(false); // Not used in search mode as we have the full list
        
        // Show REAL search efficiency based on actual system data
        const actualReads = expandedSearchResults.length;
        
        if (totalRootOrders !== null) {
          // Calcular ahorro real comparado con descargar todo
          const savedReads = totalRootOrders - actualReads;
          const reductionPercent = totalRootOrders > 0 ? Math.round((savedReads / totalRootOrders) * 100) : 0;
          
          logger.debug(`✅ Smart Search completed: ${actualReads} reads`);
          logger.debug(`   💰 Ahorro real: ${savedReads} lecturas (${reductionPercent}% vs descargar todas las ${totalRootOrders} órdenes)`);
          logger.debug(`   📊 Método: ${searchResults.method}`);
        } else {
          logger.debug(`✅ Smart Search completed: ${actualReads} reads`);
          logger.debug(`   📊 Método: ${searchResults.method}`);
        }
      } else {
        // Paginated Mode: Fetch only one page
        const cursor = lastDocs[page - 1];
        logger.debug(`Paging: Page ${page}, using cursor index ${page - 1}`, cursor);
        // Excluir órdenes eliminadas/canceladas para todos los usuarios (admin usa filtros en UI)
        const { orders: fetchedOrders, lastDoc } = await getServiceOrdersPaginated(
          ITEMS_PER_PAGE,
          cursor,
          true,
          { since: recentOrdersSince }
        );
        setOrders(fetchedOrders);

        // Record the cursor for the NEXT page (index 'page')
        if (lastDoc && page >= lastDocs.length) {
          setLastDocs(prev => {
            const nextCursors = [...prev];
            nextCursors[page] = lastDoc;
            return nextCursors;
          });
        }
        setHasMore(!!lastDoc);
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar las órdenes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUser) {
      if (activeSearchTerm.trim().length === 0) {
        // Reset to real pagination when search is cleared
        setCurrentPage(1);
        setLastDocs([null]);
        fetchOrders(1);
        
        // Recargar total de páginas y total de órdenes root
        getTotalServiceOrdersCount({ since: recentOrdersSince }).then(count => {
          setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
          setTotalRootOrders(count); // Actualizar con el valor real
        }).catch(err => {
          logger.error('Error obteniendo total de páginas:', err);
        });
      } else {
        // Fetch all for global search
        setCurrentPage(1);
        fetchOrders(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearchTerm, authLoading, currentUser?.uid]);

  const handleExecuteSearch = () => {
    setActiveSearchTerm(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setActiveSearchTerm("");
  };



  const fetchInitialData = async () => {
    try {
      const [fetchedGuides, fetchedDrivers, fetchedHotels, fetchedActivities, fetchedFlights, fetchedBuses] = await Promise.all([
        getGuidesFromFirestore(),
        getDriversFromFirestore(),
        getHotelsFromFirestore(),
        getActivitiesFromFirestore(),
        getFlightsFromFirestore(),
        getBusesFromFirestore(),
      ]);
      setGuides(fetchedGuides);
      setDrivers(fetchedDrivers);
      setHotels(fetchedHotels);
      setActivities(fetchedActivities);
      setFlights(fetchedFlights);
      setBuses(fetchedBuses);

    } catch (error) {
      logger.error("Error fetching metadata:", error);
    }
  };

  const verifyDatabaseConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const isConnected = await checkDatabaseConnection();
      setDbConnected(isConnected);
    } catch (error) {
      logger.error('Error checking database connection:', error);
      setDbConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  useEffect(() => {
    verifyDatabaseConnection();

    // Solo cargamos datos si la autenticación ya terminó
    if (!authLoading && currentUser) {
      fetchInitialData(); // Cargar guías, hoteles, etc.
    }
  }, [isCurrentUserAdmin, authLoading, currentUser?.uid]);

  const handleStatusUpdate = async (orderId: string) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const isUpdatableStatus = !['excel', 'enviado', 'impreso', 'eliminado', 'cancelado'].includes(orderToUpdate.status);
    if (isUpdatableStatus) {
      try {
        await updateServiceOrder(orderId, 'enviado');
        setOrders(prevOrders =>
          prevOrders.map(o => o.id === orderId ? { ...o, status: 'enviado' } : o)
        );
      } catch (error) {
        logger.error("Failed to update order status:", error);
        toast({ title: "Error", description: "No se pudo actualizar el estado de la orden.", variant: "destructive" });
      }
    }
  };


  // Expose the modal function and data globally
  useEffect(() => {
    window.showSimplePreviewModal = (order, onStatusUpdate) => {
      // Always show the specific order (child or parent), not the parent when clicking a child
      showSimplePreviewModal(order, onStatusUpdate);
    };

    // Make handleStatusUpdate available globally for the raw HTML button to call
    window.__handleStatusUpdate = handleStatusUpdate;

    const ordersMap = new Map<string, StoredServiceOrder>();
    orders.forEach(order => ordersMap.set(order.id, order));
    window.__serviceOrdersMap = ordersMap;
  }, [orders, families]);

  useEffect(() => {
    // Reset to page 1 when search changes
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  }, [searchTerm]);


  const handleNewOrderClick = () => {
    setIsAutomatedMode(false);
    setIsSheetOpen(true);
  };

  const handleAutomatedOrderClick = () => {
    setIsAutomatedMode(true);
    setIsSheetOpen(true);
  };

  const handleEditOrderClick = (order: StoredServiceOrder) => {
    setOrderToEdit(order);
    setIsEditModalOpen(true);
  };

  const handlePreviewOrderClick = async (order: StoredServiceOrder) => {
    // Always show the specific order (child or parent), not the parent when clicking a child
    setOrderToPreview(order);
    setIsPreviewModalOpen(true);
  };

  const handleSaveFromEditModal = async (updatedOrderData: ServiceOrderData) => {
    if (!orderToEdit || !currentUser?.email || isSaving) return;

    setIsSaving(true);
    try {
      await saveEditedServiceOrder(orderToEdit, updatedOrderData, currentUser.email);
      toast({ title: "Éxito", description: "La orden ha sido actualizada y/o dividida exitosamente.", variant: "success" });
      await fetchOrders(); // Wait for orders to load before closing modal
      setIsEditModalOpen(false);
      setOrderToEdit(null);
    } catch (error: any) {
      logger.error("Error saving/splitting order:", error);
      toast({ title: "Error al Guardar", description: error.message || "No se pudo guardar la orden.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  const searchTotalPages = useMemo(() => {
    if (activeSearchTerm.trim().length > 0) {
      return Math.ceil(families.length / ITEMS_PER_PAGE) || 1;
    }
    return 1;
  }, [activeSearchTerm, families.length]);

  const showPagination = useMemo(() => {
    if (activeSearchTerm.trim().length > 0) {
      return searchTotalPages > 1;
    }
    return currentPage > 1 || hasMore;
  }, [activeSearchTerm, searchTotalPages, currentPage, hasMore]);

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;
    setCurrentPage(newPage);
    if (activeSearchTerm.trim().length === 0) {
      fetchOrders(newPage);
    }
  };

  // Genera los números de página a mostrar con puntos suspensivos
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    // En modo búsqueda: mostrar todas las páginas (datos completos en cliente)
    if (activeSearchTerm.trim().length > 0) {
      const maxPages = searchTotalPages;
      if (maxPages === 0) return [];
      
      const pages: (number | 'ellipsis')[] = [];
      const showEllipsis = maxPages > 7;
      
      if (!showEllipsis) {
        for (let i = 1; i <= maxPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        
        if (currentPage <= 3) {
          pages.push(2, 3, 4);
          pages.push('ellipsis');
        } else if (currentPage >= maxPages - 2) {
          pages.push('ellipsis');
          pages.push(maxPages - 3, maxPages - 2, maxPages - 1);
        } else {
          pages.push('ellipsis');
          pages.push(currentPage - 1, currentPage, currentPage + 1);
          pages.push('ellipsis');
        }
        
        pages.push(maxPages);
      }
      
      return pages;
    }
    
    // En modo paginación server-side: solo mostrar páginas accesibles
    // Con cursor pagination, solo puedes ir a la siguiente página consecutiva
    const pages: (number | 'ellipsis')[] = [];
    
    // Mostrar solo hasta la página siguiente a la última visitada
    const maxAccessiblePage = lastDocs.length; // lastDocs tiene cursores hasta esta página
    
    if (maxAccessiblePage <= 1) {
      // Primera carga, solo mostrar página 1
      pages.push(1);
    } else {
      // Mostrar páginas 1 hasta la máxima accesible
      for (let i = 1; i <= Math.min(maxAccessiblePage, currentPage + 1); i++) {
        pages.push(i);
      }
      
      // Mostrar indicador de más páginas si hay
      if (hasMore && maxAccessiblePage < totalPages) {
        pages.push('ellipsis');
        if (totalPages > 0) {
          pages.push(totalPages);
        }
      }
    }
    
    return pages;
  };


  const handleDeleteOrder = async () => {
    if (!orderToDelete || !orderToDelete.id || !currentUser?.email) return;

    try {
      await deleteServiceOrder(orderToDelete.id, currentUser.email);
      toast({ title: "Éxito", description: `La orden "${getBaseName(orderToDelete.orderName)}" ha sido marcada como eliminada.`, variant: "success" });

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === orderToDelete.id
            ? { ...o, status: 'eliminado', deletedBy: currentUser.email || undefined, updatedAt: new Date() }
            : o
        )
      );
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la orden.", variant: "destructive" });
    } finally {
      setOrderToDelete(null);
    }
  };


  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedOrderIds);
    if (idsToDelete.length === 0 || !currentUser?.email) return;

    try {
      await deleteBulkServiceOrders(idsToDelete, currentUser.email);
      toast({ title: "Eliminación Exitosa", description: `${idsToDelete.length} órdenes marcadas como eliminadas.`, variant: "success" });
      setSelectedOrderIds(new Set());

      // Optimización: Actualizar estado local en lugar de recargar desde Firebase
      setOrders(prevOrders =>
        prevOrders.map(o =>
          idsToDelete.includes(o.id)
            ? { ...o, status: 'eliminado', deletedBy: currentUser.email || undefined, updatedAt: new Date() }
            : o
        )
      );
    } catch (error) {
      toast({ title: "Error de Eliminación", description: "No se pudieron eliminar las órdenes.", variant: "destructive" });
    }
  };

  const handleDownloadExcel = async (order: StoredServiceOrder) => {
    setIsDownloadingId(order.id);
    try {
      if (!order.id) throw new Error("ID de orden no válido");

      const buffer = await generateServiceOrderExcel(order.data);
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileName = order.orderName
        .replace(/\s*—\s*/g, '_')
        .replace(/:/g, '_')
        .replace(/[\s/]/g, '_');

      link.download = `${fileName}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (order.status !== 'excel' && order.status !== 'eliminado' && order.status !== 'cancelado') {
        await updateServiceOrder(order.id, 'excel');

        // Optimización: Actualizar estado local en lugar de recargar desde Firebase
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.id === order.id
              ? { ...o, status: 'excel', updatedAt: new Date() }
              : o
          )
        );
      }

    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const handlePrintToPdf = async (order: StoredServiceOrder) => {
    setIsPrintingPdfId(order.id);
    try {
      if (order.status !== 'impreso' && order.status !== 'eliminado' && order.status !== 'cancelado' && order.status !== 'enviado' && order.status !== 'excel') {
        await updateServiceOrder(order.id, 'impreso');

        // Optimización: Actualizar estado local en lugar de recargar desde Firebase
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.id === order.id
              ? { ...o, status: 'impreso', updatedAt: new Date() }
              : o
          )
        );
      }
      const orderDataString = encodeURIComponent(JSON.stringify(order));
      const url = `/service-order-print?order=${orderDataString}`;
      window.open(url, '_blank');
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsPrintingPdfId(null);
    }
  };

  const onSave = () => {
    setIsSheetOpen(false);
    setIntermediateOrderData(initialOrderDataState);
    fetchOrders(1);
  };

  const onSheetClose = () => {
    setIsSheetOpen(false);
  }

  const onClearAndNew = () => {
    setIntermediateOrderData(initialOrderDataState);
    setOrderToEdit(null);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = new Set<string>();
    if (checked) {
      families.forEach(({ parent, children }) => {
        if (parent.status !== 'eliminado' && parent.status !== 'cancelado') newSelectedIds.add(parent.id)
        children.forEach(child => {
          if (child.status !== 'eliminado' && child.status !== 'cancelado') newSelectedIds.add(child.id)
        })
      });
    }
    setSelectedOrderIds(newSelectedIds);
  };

  const handleSelectOne = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(orderId);
      else newSet.delete(orderId);
      return newSet;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4 inline" />
      : <ArrowDown className="ml-1 h-4 w-4 inline" />;
  };

  const toggleFamilyExpansion = (familyId: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyId)) {
        newSet.delete(familyId);
      } else {
        newSet.add(familyId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (order: StoredServiceOrder, childCount = 0) => {
    const status = order.status || 'creado';
    let baseBadge: React.ReactNode;

    switch (status) {
      case 'eliminado': baseBadge = <Badge variant="destructive" className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Eliminado</Badge>; break;
      case 'cancelado': baseBadge = <Badge variant="destructive" className="bg-yellow-600 hover:bg-yellow-700">Cancelado</Badge>; break;
      case 'enviado': baseBadge = <Badge variant="default" className="bg-lime-600 hover:bg-lime-700">Enviado</Badge>; break;
      case 'impreso': baseBadge = <Badge variant="default" className="bg-red-500 hover:bg-red-600">PDF</Badge>; break;
      case 'excel': baseBadge = <Badge variant="default" className="bg-green-600 hover:bg-green-700">Excel</Badge>; break;
      case 'editado': baseBadge = <Badge variant="secondary" className="bg-orange-500 text-white hover:bg-orange-600">Editado</Badge>; break;
      default: baseBadge = <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Creado</Badge>;
    }

    if (childCount > 0) {
      const isSplitSeparated = order.data?.isSplitSeparated === true;
      const splitBadge = isSplitSeparated
        ? <Badge className="bg-yellow-600 hover:bg-yellow-700"><Split className="h-3 w-3 mr-1" />Separada</Badge>
        : <Badge className="bg-purple-600 hover:bg-purple-700"><Split className="h-3 w-3 mr-1" />Dividida</Badge>;
      return <div className="flex items-center gap-1">{baseBadge}{splitBadge}</div>;
    }
    return baseBadge;
  };

  const getDeletionAlertDescription = () => {
    if (!orderToDelete) return "";
    const family = families.find(f => f.parent.id === orderToDelete.id);
    const childCount = family ? family.children.length : 0;

    let baseMessage = `La orden "${getBaseName(orderToDelete.orderName)}" será marcada como eliminada.`;
    if (childCount > 0) {
      baseMessage += ` Sus ${childCount} órdenes hijas también serán eliminadas.`;
    }
    baseMessage += " Los administradores podrán verla y recuperarla.";
    return baseMessage;
  };

  const numSelected = selectedOrderIds.size;
  const numInPage = families.reduce((acc: number, { parent, children }) => {
    let count = (parent.status !== 'eliminado' && parent.status !== 'cancelado') ? 1 : 0;
    count += children.filter(c => c.status !== 'eliminado' && c.status !== 'cancelado').length;
    return acc + count;
  }, 0);
  const isAllSelected = numInPage > 0 && numSelected === numInPage;

  const renderOrderActions = (order: StoredServiceOrder) => {
    const canEdit = !!currentUser;
    const canDelete = !!currentUser;
    const isDeleted = order.status === 'eliminado' || order.status === 'cancelado';

    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Ver orden" onClick={() => handlePreviewOrderClick(order)} className="h-9 w-9 text-primary border-primary/50 hover:bg-primary/10"><Eye className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Vista previa (WhatsApp)</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Editar orden" onClick={() => handleEditOrderClick(order)} disabled={!canEdit || isDeleted} className="h-9 w-9 text-indigo-600 border-indigo-600/50 hover:bg-indigo-100/80"><FilePenLine className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5" aria-label="Más acciones de la orden"><MoreHorizontal className="h-4 w-4" /><span>Más</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={() => handleDownloadExcel(order)} disabled={isDownloadingId === order.id || isDeleted}><FileDown className="h-4 w-4" /> Descargar Excel</DropdownMenuItem>
            {isCurrentUserAdmin && <DropdownMenuItem onSelect={() => handlePrintToPdf(order)} disabled={isPrintingPdfId === order.id || isDeleted}><Printer className="h-4 w-4" /> Imprimir PDF</DropdownMenuItem>}
            {canAccessLiquidation && order.hasLiquidation && order.data?.file && <DropdownMenuItem onSelect={() => setLiquidationViewerFile(order.data.file)}><Receipt className="h-4 w-4" /> Ver liquidación</DropdownMenuItem>}
            {!isDeleted && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setOrderToDelete(order)} disabled={!canDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Eliminar orden</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };


  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><PlaneSpinner className="h-12 w-12" /></div>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] mobile-padding bg-background space-y-4 sm:space-y-6">
        <div className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go home" className="touch-target">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${dbConnected === null ? 'border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-800' :
              dbConnected ? 'border-green-200 bg-green-50 dark:bg-emerald-950/20 dark:border-emerald-500/30' : 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-500/30'
              }`}>
              {isCheckingConnection ? (
                <>
                  <RefreshCw className="h-4 w-4 text-gray-500 animate-spin" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Verificando...</span>
                </>
              ) : dbConnected === null ? (
                <>
                  <Database className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">DB Status</span>
                </>
              ) : dbConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-green-600 dark:text-emerald-400">Conectado</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">Offline</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={verifyDatabaseConnection}
                    disabled={isCheckingConnection}
                    className="h-6 w-6 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 p-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleNewOrderClick}
                    size="sm"
                    variant="outline"
                    aria-label="Nueva Orden de Servicio"
                    className="h-12 sm:h-14 rounded-xl border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 shadow-md touch-target shrink-0 gap-2 px-3"
                  >
                    <FilePlus className="h-5 w-5" />
                    <span>Nueva orden</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Nueva Orden de Servicio</p></TooltipContent>
              </Tooltip>

              {hasModule('aportar-datos') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/admin/contribute" passHref>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Aportar Datos"
                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-transparent hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-600/50 shadow-md touch-target shrink-0"
                      >
                        <Database className="h-6 w-6 sm:h-7 sm:w-7" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent><p>Aportar Datos</p></TooltipContent>
                </Tooltip>
              )}

              {hasModule('editar-logica') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/admin/edit-service-order-logic" passHref>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Editar Lógica"
                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-transparent hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-600/50 shadow-md touch-target shrink-0"
                      >
                        <ClipboardEdit className="h-6 w-6 sm:h-7 sm:w-7" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent><p>Editar Lógica</p></TooltipContent>
                </Tooltip>
              )}

              <Button
                onClick={handleAutomatedOrderClick}
                className="h-12 sm:h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-md touch-target text-sm sm:text-base shrink-0"
              >
                <Bot className="mr-2 h-5 w-5" />
                <span className="hidden sm:inline">Generar Orden Automatizada</span>
                <span className="sm:hidden">Orden Automatizada</span>
              </Button>
            </div>
          </div>
        </div>

        <Card className="w-full max-w-7xl shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <ListOrdered className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline text-primary">Órdenes de Servicio</CardTitle>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-2">
                {isCurrentUserAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/deleted-orders')}
                    className="gap-2 border-red-200 hover:bg-red-50 text-red-700 dark:border-red-800 dark:hover:bg-red-950 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Ver Eliminadas</span>
                  </Button>
                )}
                <div className="relative w-full sm:w-auto flex-grow flex gap-2">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por file, orden o responsable..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleExecuteSearch();
                        if (e.key === 'Escape') handleClearSearch();
                      }}
                      className="pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-primary min-w-[200px]"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearSearch}
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={handleExecuteSearch}
                    variant="secondary"
                    className="shrink-0 gap-2 border shadow-sm"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden md:inline">Buscar</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {numSelected > 0 && (
              <div className="p-3 mb-4 bg-muted/50 flex justify-between items-center rounded-lg">
                <span className="text-sm font-medium">{numSelected} seleccionado(s)</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="touch-target">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Estás seguro de que quieres eliminar {numSelected} orden(es)? Esta acción las marcará como eliminadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                        Sí, eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Mobile Card View - Visible only on mobile */}
            <div className="mobile-card-view space-y-3">
              {displayedFamilies.length > 0 ? displayedFamilies.map(({ parent, children }) => {
                const parentName = getBaseName(parent.orderName);
                const canEdit = !!currentUser;
                const canDelete = !!currentUser;

                return (
                  <ServiceOrderMobileCard
                    key={parent.id}
                    order={parent}
                    childOrders={children}
                    parentName={parentName}
                    isExpanded={expandedFamilies.has(parent.id)}
                    isSelected={selectedOrderIds.has(parent.id)}
                    canModify={canEdit}
                    canDelete={canDelete}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    isDownloadingId={isDownloadingId}
                    isPrintingPdfId={isPrintingPdfId}
                    onToggleExpand={() => toggleFamilyExpansion(parent.id)}
                    onSelect={(checked) => handleSelectOne(parent.id, checked)}
                    onPreview={handlePreviewOrderClick}
                    onEdit={handleEditOrderClick}
                    onDownload={handleDownloadExcel}
                    onPrint={handlePrintToPdf}
                    onDelete={setOrderToDelete}
                    onViewLiquidation={canAccessLiquidation ? (file) => setLiquidationViewerFile(file) : undefined}
                    getStatusBadge={getStatusBadge}
                  />
                );
              }) : (
                <Card className="p-8 text-center text-muted-foreground">
                  {searchTerm ? `No se encontraron órdenes para "${searchTerm}"` : "No se han encontrado órdenes de servicio."}
                </Card>
              )}
            </div>

            {/* Desktop Table View - Hidden on mobile */}
            <div className="desktop-table-view border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isCurrentUserAdmin && <TableHead className="w-12 border-r border-border/40"><Checkbox checked={isAllSelected} onCheckedChange={(checked) => handleSelectAll(!!checked)} aria-label="Seleccionar todas" disabled={false} /></TableHead>}
                    <TableHead className="border-r border-border/40 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('orderName')}>
                      Nombre de la Orden{getSortIcon('orderName')}
                    </TableHead>
                    <TableHead className="border-r border-border/40">Responsable(s)</TableHead>
                    <TableHead className="border-r border-border/40 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                      Estado{getSortIcon('status')}
                    </TableHead>
                    <TableHead className="border-r border-border/40 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('createdBy')}>
                      Creado Por{getSortIcon('createdBy')}
                    </TableHead>
                    <TableHead className="w-[120px] border-r border-border/40 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('createdAt')}>
                      Fecha de registro{getSortIcon('createdAt')}
                    </TableHead>
                    <TableHead className="w-[158px] min-w-[158px] text-left">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedFamilies.length > 0 ? displayedFamilies.map(({ parent, children }) => {
                    const parentName = getBaseName(parent.orderName);
                    const childCount = children.length;
                    const isExpanded = expandedFamilies.has(parent.id);

                    const allGuidsInFamily = new Set<string>();
                    const allDriversInFamily = new Set<string>();

                    if (parent.data && parent.data.services) {
                      parent.data.services.forEach(service => {
                        if (service.guia) allGuidsInFamily.add(service.guia);
                        if (service.chofer) allDriversInFamily.add(service.chofer);
                      });
                      if (parent.data.guia) allGuidsInFamily.add(parent.data.guia);
                    }

                    const displayedGuides = Array.from(allGuidsInFamily).filter(Boolean);
                    const displayedDrivers = Array.from(allDriversInFamily).filter(Boolean);

                    return (
                      <React.Fragment key={parent.id}>
                        <TableRow>
                          {isCurrentUserAdmin && (
                            <TableCell className="border-r border-border/40"><Checkbox checked={selectedOrderIds.has(parent.id)} onCheckedChange={(c) => handleSelectOne(parent.id, !!c)} aria-label={`Seleccionar ${parentName}`} disabled={parent.status === 'eliminado' || parent.status === 'cancelado'} /></TableCell>
                          )}
                          <TableCell className="font-semibold border-r border-border/40">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleFamilyExpansion(parent.id)}
                                disabled={childCount === 0}
                                className="flex items-center gap-1 text-left hover:underline p-0 bg-transparent border-none disabled:cursor-default disabled:no-underline"
                              >
                                <span>{parentName}</span>
                                {childCount > 0 && <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-border/40">
                            <div className="flex items-center gap-1 flex-wrap">
                              {displayedGuides.map(g => <Badge key={g} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100"><User size={12} className="mr-1" />{shortPerson(g)}</Badge>)}
                              {displayedDrivers.map(d => <Badge key={d} className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-100"><Car size={12} className="mr-1" />{shortPerson(d)}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-border/40">{getStatusBadge(parent, childCount)}</TableCell>
                          <TableCell className="border-r border-border/40">{parent.createdBy}</TableCell>
                          <TableCell className="border-r border-border/40">{format(parent.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                          <TableCell className="whitespace-nowrap">{renderOrderActions(parent)}</TableCell>
                        </TableRow>

                        {isExpanded && children.map(child => {
                          const isDriverPerspective = child.orderName.includes(" — C-");
                          const isGuidePerspective = child.orderName.includes(" — G-");
                          return (
                            <TableRow key={child.id} className="bg-muted/30 hover:bg-muted/50">
                              {isCurrentUserAdmin && <TableCell className="border-r border-border/40"><Checkbox checked={selectedOrderIds.has(child.id)} onCheckedChange={(c) => handleSelectOne(child.id, !!c)} disabled={child.status === 'eliminado' || child.status === 'cancelado'} /></TableCell>}
                              <TableCell className="pl-12 border-r border-border/40">
                                <div className="text-sm">
                                  <span className="font-medium">{child.orderName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="border-r border-border/40">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {isGuidePerspective && child.data.guia && <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100"><User size={12} className="mr-1" />{shortPerson(child.data.guia)}</Badge>}
                                  {isDriverPerspective && Array.from(new Set(child.data.services?.map(s => s.chofer).filter(Boolean))).map(c =>
                                    <Badge key={c} className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-100"><Car size={12} className="mr-1" />{shortPerson(c as string)}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="border-r border-border/40">{getStatusBadge(child)}</TableCell>
                              <TableCell className="border-r border-border/40">{child.createdBy}</TableCell>
                              <TableCell className="border-r border-border/40">{format(child.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                              <TableCell className="whitespace-nowrap">{renderOrderActions(child)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    )
                  }) : (
                    <TableRow><TableCell colSpan={isCurrentUserAdmin ? 7 : 5} className="text-center h-24 text-muted-foreground">{activeSearchTerm ? `No se encontraron órdenes para "${activeSearchTerm}"` : "No se han encontrado órdenes de servicio."}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {showPagination && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border/40 mt-4">
                {/* Botón Anterior */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="h-9 w-9 p-0 hover:bg-primary/5 transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Números de página */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pageNum, idx) => {
                    if (pageNum === 'ellipsis') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    
                    const isActive = pageNum === currentPage;
                    
                    // En modo sin búsqueda (cursor pagination): solo permitir páginas secuenciales
                    // Solo se puede ir a páginas ya visitadas (con cursor) o la siguiente
                    const isAccessible = activeSearchTerm.trim().length > 0 
                      ? true  // En búsqueda, todas las páginas son accesibles
                      : pageNum <= lastDocs.length; // Sin búsqueda, solo páginas con cursor
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => isAccessible && handlePageChange(pageNum)}
                        disabled={isLoading || !isAccessible}
                        className={cn(
                          "h-9 w-9 p-0 transition-colors",
                          isActive 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                            : isAccessible 
                              ? "hover:bg-primary/5" 
                              : "opacity-40 cursor-not-allowed"
                        )}
                        title={
                          !isAccessible 
                            ? "Usa las flechas para navegar secuencialmente" 
                            : `Ir a página ${pageNum}`
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                {/* Botón Siguiente */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeSearchTerm.trim().length > 0) {
                      if (currentPage < searchTotalPages) {
                        handlePageChange(currentPage + 1);
                      }
                    } else {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                  disabled={
                    isLoading || 
                    (activeSearchTerm.trim().length > 0 
                      ? currentPage >= searchTotalPages 
                      : (totalPages > 0 ? currentPage >= totalPages : !hasMore))
                  }
                  className="h-9 w-9 p-0 hover:bg-primary/5 transition-colors"
                  title="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => { if (!open) setOrderToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar esta orden?</AlertDialogTitle><AlertDialogDescription>{getDeletionAlertDescription()}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cerrar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isEditModalOpen && orderToEdit && (
          <ServiceOrderEditModal
            order={orderToEdit} guides={guides} activities={activities} drivers={drivers} flights={flights} hotels={hotels} buses={buses}
            onSave={handleSaveFromEditModal}
            onClose={() => { setIsEditModalOpen(false); setOrderToEdit(null); }}
            isSaving={isSaving}
          />
        )}

        {isPreviewModalOpen && orderToPreview && (
          <ServiceOrderPreviewModal
            order={orderToPreview}
            onClose={() => { setIsPreviewModalOpen(false); setOrderToPreview(null); }}
            onStatusUpdate={handleStatusUpdate}
          />
        )}

        <ServiceOrderGeneratorSheet
          isOpen={isSheetOpen}
          onClose={onSheetClose}
          onSave={onSave}
          orderData={intermediateOrderData}
          setOrderData={setIntermediateOrderData}
          onClearAndNew={onClearAndNew}
          isAutomatedMode={isAutomatedMode}
          guides={guides}
          activities={activities}
          drivers={drivers}
          flights={flights}
          hotels={hotels}
          buses={buses}
        />

        {canAccessLiquidation && liquidationViewerFile && (
          <LiquidationViewerModal
            fileNumber={liquidationViewerFile}
            open={!!liquidationViewerFile}
            onClose={() => setLiquidationViewerFile(null)}
            onLastDeleted={() => { setLiquidationViewerFile(null); fetchOrders(currentPage); }}
          />
        )}
      </div>
    </TooltipProvider >
  );
}


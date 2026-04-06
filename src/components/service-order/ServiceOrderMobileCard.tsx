"use client";

import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Eye, FilePenLine, FileDown, Printer, Trash2, Loader2,
  ChevronDown, User, Car, Calendar, MoreVertical, Receipt
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { shortPerson } from "@/lib/serviceOrderFamily";
import type { StoredServiceOrder } from '@/lib/serviceOrderStorage';

interface ServiceOrderMobileCardProps {
  order: StoredServiceOrder;
  childOrders: StoredServiceOrder[];
  parentName: string;
  isExpanded: boolean;
  isSelected: boolean;
  canModify: boolean;
  canDelete: boolean;
  isCurrentUserAdmin: boolean;
  isDownloadingId: string | null;
  isPrintingPdfId: string | null;
  onToggleExpand: () => void;
  onSelect: (checked: boolean) => void;
  onPreview: (order: StoredServiceOrder) => void;
  onEdit: (order: StoredServiceOrder) => void;
  onDownload: (order: StoredServiceOrder) => void;
  onPrint: (order: StoredServiceOrder) => void;
  onDelete: (order: StoredServiceOrder) => void;
  onViewLiquidation?: (fileNumber: string) => void;
  getStatusBadge: (order: StoredServiceOrder, childCount?: number) => React.ReactNode;
  getDeletionDescription: (order: StoredServiceOrder) => string;
}

export function ServiceOrderMobileCard({
  order,
  childOrders,
  parentName,
  isExpanded,
  isSelected,
  canModify,
  canDelete,
  isCurrentUserAdmin,
  isDownloadingId,
  isPrintingPdfId,
  onToggleExpand,
  onSelect,
  onPreview,
  onEdit,
  onDownload,
  onPrint,
  onDelete,
  onViewLiquidation,
  getStatusBadge,
  getDeletionDescription,
}: ServiceOrderMobileCardProps) {
  const childCount = childOrders.length;
  const isDeleted = order.status === 'eliminado' || order.status === 'cancelado';

  // Collect guides and drivers from order
  const allGuidsInFamily = new Set<string>();
  const allDriversInFamily = new Set<string>();

  if (order.data && order.data.services) {
    order.data.services.forEach(service => {
      if (service.guia) allGuidsInFamily.add(service.guia);
      if (service.chofer) allDriversInFamily.add(service.chofer);
    });
    if (order.data.guia) allGuidsInFamily.add(order.data.guia);
  }

  const displayedGuides = Array.from(allGuidsInFamily).filter(Boolean);
  const displayedDrivers = Array.from(allDriversInFamily).filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Parent Order Card */}
      <Card className={cn("shadow-md border-2", isDeleted && "opacity-60 border-muted")}>
        <CardHeader className="pb-3">
          {/* Header Row: Checkbox + Name + Expand */}
          <div className="flex items-start gap-3">
            {isCurrentUserAdmin && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                disabled={isDeleted}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <button
                onClick={onToggleExpand}
                disabled={childCount === 0}
                className="flex items-center gap-2 w-full text-left group"
              >
                <h3 className="font-bold text-base leading-tight break-words flex-1">
                  {parentName}
                </h3>
                {childCount > 0 && (
                  <div className="shrink-0 flex items-center gap-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                      {childCount}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-primary transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-2 mt-3">
            {getStatusBadge(order, childCount)}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Metadata Section */}
          {isCurrentUserAdmin && (
            <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span className="font-medium truncate">{order.createdBy}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{format(order.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              </div>
            </div>
          )}

          {/* Team Section */}
          {(displayedGuides.length > 0 || displayedDrivers.length > 0) && (
            <div className="space-y-2">
              {displayedGuides.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                    <User className="h-3 w-3" />
                    Guías:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayedGuides.map(g => (
                      <Badge key={g} variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-normal">
                        {shortPerson(g)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {displayedDrivers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                    <Car className="h-3 w-3" />
                    Choferes:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayedDrivers.map(d => (
                      <Badge key={d} variant="secondary" className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 text-xs font-normal">
                        {shortPerson(d)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Actions Section - Icon Only Buttons */}
          <div className="flex items-center justify-start gap-2 flex-wrap">
            {/* Vista Previa */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPreview(order)}
              className="h-10 w-10 touch-target text-primary border-primary/50 hover:bg-primary/10"
              title="Vista Previa"
            >
              <Eye className="h-5 w-5" />
            </Button>

            {/* Editar */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onEdit(order)}
              disabled={!canModify || isDeleted}
              className="h-10 w-10 touch-target text-indigo-600 border-indigo-600/50 hover:bg-indigo-100/80 disabled:opacity-50"
              title="Editar"
            >
              <FilePenLine className="h-5 w-5" />
            </Button>

            {/* Descargar Excel */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDownload(order)}
              disabled={isDownloadingId === order.id || isDeleted}
              className="h-10 w-10 touch-target text-green-600 border-green-600/50 hover:bg-green-100/80 disabled:opacity-50"
              title="Descargar Excel"
            >
              {isDownloadingId === order.id ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileDown className="h-5 w-5" />
              )}
            </Button>

            {/* PDF (solo admin) */}
            {isCurrentUserAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPrint(order)}
                disabled={isPrintingPdfId === order.id || isDeleted}
                className="h-10 w-10 touch-target text-red-600 border-red-600/50 hover:bg-red-100/80 disabled:opacity-50"
                title="Imprimir PDF"
              >
                {isPrintingPdfId === order.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* Ver Liquidación */}
            {order.hasLiquidation && order.data?.file && onViewLiquidation && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onViewLiquidation(order.data.file)}
                className="h-10 w-10 touch-target text-cyan-600 border-cyan-500/50 hover:bg-cyan-100/80 dark:text-cyan-400 dark:border-cyan-400/50 dark:hover:bg-cyan-950/40"
                title="Ver Liquidación"
              >
                <Receipt className="h-5 w-5" />
              </Button>
            )}

            {/* Eliminar */}
            {!isDeleted && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canDelete}
                    className="h-10 w-10 touch-target text-destructive border-destructive/50 hover:bg-destructive/10 disabled:opacity-50"
                    title="Eliminar Orden"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base">
                      ¿Estás seguro de eliminar esta orden?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
                      {getDeletionDescription(order)}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(order)}
                      className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                    >
                      Sí, eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Child Orders */}
      {isExpanded && childOrders.map(child => {
        const isChildDeleted = child.status === 'eliminado' || child.status === 'cancelado';
        const isDriverPerspective = child.orderName.includes(" — C-");
        const isGuidePerspective = child.orderName.includes(" — G-");
        const canModifyChild = canModify;

        return (
          <Card
            key={child.id}
            className={cn(
              "shadow-sm ml-6 border-l-4 border-l-primary/30",
              isChildDeleted && "opacity-60"
            )}
          >
            <CardContent className="p-3 space-y-2.5">
              {/* Child Header */}
              <div>
                <h4 className="font-semibold text-sm leading-tight break-words">
                  {child.orderName}
                </h4>
              </div>

              {/* Child Team */}
              <div className="flex flex-wrap gap-1.5">
                {isGuidePerspective && child.data.guia && (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs">
                    <User size={10} className="mr-1" />
                    {shortPerson(child.data.guia)}
                  </Badge>
                )}
                {isDriverPerspective && Array.from(new Set(child.data.services?.map(s => s.chofer).filter(Boolean))).map(c => (
                  <Badge key={c} variant="secondary" className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 text-xs">
                    <Car size={10} className="mr-1" />
                    {shortPerson(c as string)}
                  </Badge>
                ))}
              </div>

              {/* Child Status */}
              <div>
                {getStatusBadge(child)}
              </div>

              <Separator className="my-2" />

              {/* Child Actions - Icon Only */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPreview(child)}
                  className="h-9 w-9 touch-target"
                  title="Vista Previa"
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onEdit(child)}
                  disabled={!canModifyChild || isChildDeleted}
                  className="h-9 w-9 touch-target disabled:opacity-50"
                  title="Editar"
                >
                  <FilePenLine className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onDownload(child)}
                  disabled={isDownloadingId === child.id || isChildDeleted}
                  className="h-9 w-9 touch-target disabled:opacity-50"
                  title="Descargar Excel"
                >
                  {isDownloadingId === child.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                </Button>

                {/* Dropdown for more actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 touch-target" title="Más opciones">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {isCurrentUserAdmin && (
                      <DropdownMenuItem
                        onClick={() => onPrint(child)}
                        disabled={isPrintingPdfId === child.id || isChildDeleted}
                        className="cursor-pointer"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir PDF
                      </DropdownMenuItem>
                    )}
                    {!isChildDeleted && canDelete && (
                      <>
                        {isCurrentUserAdmin && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={() => onDelete(child)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

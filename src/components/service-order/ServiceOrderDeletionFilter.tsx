
"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, ListChecks } from "lucide-react";

export type FilterState = 'active' | 'all';

interface ServiceOrderDeletionFilterProps {
  value: FilterState;
  onValueChange: (value: FilterState)=> void;
}

export function ServiceOrderDeletionFilter({ value, onValueChange }: ServiceOrderDeletionFilterProps) {
  return (
    <Tabs value={value} onValueChange={(val) => onValueChange(val as FilterState)} className="w-full sm:w-auto">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="active" className="flex items-center gap-2">
          <List className="h-4 w-4"/>
          Activas
        </TabsTrigger>
        <TabsTrigger value="all" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4"/>
            Todas
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

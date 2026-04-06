"use client";

import { useState } from "react";
import { Search, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getGuidesByFileNumber } from "@/lib/guideLiquidationService";
import { toast } from "sonner";

interface GuideLiquidationFormProps {
  isSearching: boolean;
  hasResults: boolean;
  onSearch: (fileNumber: string, guideId: string, guideName: string) => void;
}

export function GuideLiquidationForm({
  isSearching,
  hasResults,
  onSearch,
}: GuideLiquidationFormProps) {
  const [fileNumber, setFileNumber] = useState("");
  const [selectedGuide, setSelectedGuide] = useState("");
  const [guides, setGuides] = useState<string[]>([]);
  const [isLoadingGuides, setIsLoadingGuides] = useState(false);
  // fileLookedUp: true cuando el usuario ya apretó la lupa para este file
  const [fileLookedUp, setFileLookedUp] = useState(false);

  const lookupFile = async () => {
    const trimmed = fileNumber.trim();
    if (!trimmed) return;
    setIsLoadingGuides(true);
    setSelectedGuide("");
    setGuides([]);
    setFileLookedUp(false);
    try {
      const found = await getGuidesByFileNumber(trimmed);
      setGuides(found);
      setFileLookedUp(true);
      if (found.length === 1) setSelectedGuide(found[0]);
      if (found.length > 0) {
        toast.success(`File ${trimmed.toUpperCase()} encontrado`, {
          description: `${found.length} guía${found.length !== 1 ? "s" : ""} encontrado${found.length !== 1 ? "s" : ""}.`,
        });
      } else {
        toast.error(`Sin guías en el file ${trimmed.toUpperCase()}`, {
          description: "Verificá que el número de file sea correcto.",
        });
      }
    } finally {
      setIsLoadingGuides(false);
    }
  };

  // Al cambiar el file manualmente, resetear estado de búsqueda
  const handleFileChange = (val: string) => {
    setFileNumber(val);
    setFileLookedUp(false);
    setGuides([]);
    setSelectedGuide("");
  };

  const handleSearchServices = () => {
    if (!fileNumber.trim() || !selectedGuide) return;
    onSearch(fileNumber.trim().toUpperCase(), selectedGuide, selectedGuide);
  };

  const fileReady = fileNumber.trim().length > 0;
  const guideSelectDisabled = !fileLookedUp || isLoadingGuides || guides.length <= 1;
  const searchDisabled = !fileLookedUp || !selectedGuide || isSearching;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end gap-4">

        {/* FILE + botón lupa */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            File
          </Label>
          <div className="flex items-center gap-1.5">
            <div className="relative w-36">
              <Folder
                className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors pointer-events-none ${
                  hasResults ? "text-green-500" : "text-primary"
                }`}
              />
              <Input
                className={`pl-8 h-10 text-sm bg-background transition-all ${
                  hasResults
                    ? "border-green-500 ring-2 ring-green-500/30 focus-visible:ring-green-500/40"
                    : ""
                }`}
                placeholder="Ej. 0089"
                value={fileNumber}
                onChange={(e) => handleFileChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupFile()}
              />
            </div>
            {/* Botón lupa cuadrado */}
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={lookupFile}
              disabled={!fileReady || isLoadingGuides}
              title="Buscar file"
            >
              {isLoadingGuides ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* GUÍA — solo visible después de buscar el file */}
        {fileLookedUp && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-48">
            <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Guía
            </Label>
            {guides.length === 0 ? (
              <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
                Sin guías en este file
              </div>
            ) : guides.length === 1 ? (
              <div className="h-10 flex items-center px-3 rounded-md border border-green-500 bg-green-50 dark:bg-green-900/20 text-sm font-semibold text-green-700 dark:text-green-400">
                {selectedGuide}
              </div>
            ) : (
              <Select
                value={selectedGuide}
                onValueChange={setSelectedGuide}
                disabled={guideSelectDisabled}
              >
                <SelectTrigger className="h-10 text-sm bg-background">
                  <SelectValue placeholder="Seleccionar guía..." />
                </SelectTrigger>
                <SelectContent>
                  {guides.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* BUSCAR SERVICIOS — solo visible después de buscar el file */}
        {fileLookedUp && guides.length > 0 && (
          <Button
            variant="outline"
            className="h-10 border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2"
            onClick={handleSearchServices}
            disabled={searchDisabled}
          >
            <Search className="h-4 w-4" />
            {isSearching ? "Buscando..." : "Buscar Servicios"}
          </Button>
        )}

      </div>
    </div>
  );
}

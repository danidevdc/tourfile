"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
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
      if (found.length === 1) {
        setSelectedGuide(found[0]);
        // Auto-buscar servicios si hay exactamente 1 guía
        onSearch(trimmed.toUpperCase(), found[0], found[0]);
      }
      if (found.length > 0) {
        toast.success(`File ${trimmed.toUpperCase()} encontrado`, {
          description: `${found.length} guía${found.length !== 1 ? "s" : ""} encontrada${found.length !== 1 ? "s" : ""}.`,
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
    <div
      className="border border-border bg-card"
      style={{ borderRadius: "8px", padding: "20px 24px" }}
    >
      <div className="flex flex-wrap items-end gap-6">

        {/* FILE */}
        <div className="flex flex-col gap-2">
          <label
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
            className="text-muted-foreground"
          >
            File
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ej. 0089"
              value={fileNumber}
              onChange={(e) => handleFileChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupFile()}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                width: "128px",
                height: "40px",
                padding: "0 12px",
                borderRadius: "4px",
                outline: "none",
                textTransform: "uppercase",
              }}
              className={`bg-background border transition-all duration-150 text-foreground placeholder:text-muted-foreground/50 focus:border-primary ${
                hasResults ? "border-primary" : "border-border"
              }`}
            />
            <button
              onClick={lookupFile}
              disabled={!fileReady || isLoadingGuides}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 150ms ease-out",
              }}
              className="border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              title="Buscar file"
            >
              {isLoadingGuides ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* DIVISOR */}
        {fileLookedUp && (
          <div className="self-stretch w-px bg-border" style={{ marginBottom: "0px" }} />
        )}

        {/* GUÍA */}
        {fileLookedUp && (
          <div className="flex flex-col gap-2 flex-1" style={{ minWidth: "180px" }}>
            <label
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "11px",
                fontWeight: 400,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
              className="text-muted-foreground"
            >
              Guía
            </label>
            {guides.length === 0 ? (
              <div
                style={{
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  borderRadius: "4px",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                }}
                className="border border-border bg-muted/40 text-muted-foreground"
              >
                SIN GUÍAS
              </div>
            ) : guides.length === 1 ? (
              <div
                style={{
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  borderRadius: "4px",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
                className="border border-primary bg-primary/5 text-foreground"
              >
                {selectedGuide}
              </div>
            ) : (
              <Select
                value={selectedGuide}
                onValueChange={setSelectedGuide}
                disabled={guideSelectDisabled}
              >
                <SelectTrigger
                  style={{
                    height: "40px",
                    borderRadius: "4px",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "14px",
                  }}
                  className="bg-background border-border"
                >
                  <SelectValue placeholder="Seleccionar guía..." />
                </SelectTrigger>
                <SelectContent>
                  {guides.map((g) => (
                    <SelectItem key={g} value={g}
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* BUSCAR SERVICIOS */}
        {fileLookedUp && guides.length > 0 && (
          <button
            onClick={handleSearchServices}
            disabled={searchDisabled}
            style={{
              height: "40px",
              padding: "0 20px",
              borderRadius: "999px",
              fontFamily: "'Space Mono', monospace",
              fontSize: "12px",
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 150ms ease-out",
              flexShrink: 0,
            }}
            className="border border-primary text-primary bg-transparent hover:bg-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {isSearching ? "Buscando..." : "Buscar Servicios"}
          </button>
        )}

      </div>
    </div>
  );
}

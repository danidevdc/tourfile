
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Building, Mountain, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CitySelectionPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleUyuniClick = () => {
    toast({
      title: "Próximamente",
      description: "La funcionalidad para Uyuni estará disponible pronto.",
      variant: "default",
    });
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-xl mb-4"> {/* Aumentado max-w-md a max-w-xl */}
        <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go to home" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-xl shadow-lg"> {/* Aumentado max-w-md a max-w-xl */}
        <CardHeader className="text-center">
          <MapPin className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-3xl font-headline text-primary">Selecciona Lugar</CardTitle> {/* Texto cambiado */}
          {/* CardDescription eliminada */}
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          <Link href="/generator" passHref>
            <Button
              variant="default"
              className="w-full h-20 text-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg group"
            >
              <Building className="h-8 w-8 mr-4 transition-transform duration-300 group-hover:scale-110" />
              La Paz
            </Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full h-20 text-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg group"
            onClick={handleUyuniClick}
          >
            <Mountain className="h-8 w-8 mr-4 transition-transform duration-300 group-hover:scale-110" />
            Uyuni (Próximamente)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

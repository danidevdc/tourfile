"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // CardDescription removed as it's not used
import { MapPin, Building, Mountain, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth"; // Import useAuth

export default function CitySelectionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isCurrentUserAdmin, isLoading: authIsLoading } = useAuth(); // Get admin status and loading state

  const handleUyuniClick = () => {
    toast({
      title: "Próximamente",
      description: "La funcionalidad para Uyuni estará disponible pronto.",
      variant: "default",
    });
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.push('/home')} aria-label="Go to home" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="text-center">
          <MapPin className="h-16 w-16 mx-auto text-teal-600 dark:text-teal-400 mb-4" />
          <CardTitle className="text-3xl font-headline text-teal-600 dark:text-teal-400">Selecciona Lugar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          <Link href="/generator" passHref>
            <Button
              variant="outline"
              className="w-full h-20 text-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg group border-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-transparent hover:text-teal-700 dark:hover:text-teal-300"
            >
              <Building className="h-8 w-8 mr-4 transition-transform duration-300 group-hover:scale-110" />
              La Paz
            </Button>
          </Link>
          {!authIsLoading && isCurrentUserAdmin && ( // Conditionally render if not loading and user is admin
            <Button
              variant="outline"
              className="w-full h-20 text-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg group border-teal-500/10 text-teal-600/60 dark:text-teal-400/60 hover:bg-transparent"
              onClick={handleUyuniClick}
            >
              <Mountain className="h-8 w-8 mr-4 transition-transform duration-300 group-hover:scale-110 opacity-60" />
              Uyuni (Próximamente)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

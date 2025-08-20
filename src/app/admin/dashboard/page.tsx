
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, FilePenLine, Users, ArrowRight, Settings, Loader2, ClipboardEdit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface AdminLinkCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

const AdminLinkCard: React.FC<AdminLinkCardProps> = ({ href, icon: Icon, title, description }) => (
  <Link href={href} passHref>
    <Card className="hover:border-primary hover:shadow-lg transition-all duration-300 group h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardContent className="pt-0">
         <Button variant="link" className="p-0 text-primary group-hover:underline">
          Ir a {title}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  </Link>
);


export default function AdminDashboardPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({
        title: "Acceso Denegado",
        description: "No tienes permisos para acceder a esta sección.",
        variant: "destructive",
      });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
         <CardHeader>
          <div className="flex items-center space-x-4">
             <div className="p-3 bg-primary/10 rounded-lg border">
                <Settings className="h-8 w-8 text-primary" />
             </div>
             <div>
                <CardTitle className="text-3xl font-headline text-primary">Panel de Administración</CardTitle>
                <CardDescription>Gestiona los datos, la lógica de negocio y los usuarios de la aplicación.</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AdminLinkCard 
              href="/admin/data"
              icon={Database}
              title="Administrar Datos"
              description="Añade, edita o elimina hoteles, choferes y actividades."
            />
             <AdminLinkCard 
              href="/admin/edit-petty-cash-logic"
              icon={FilePenLine}
              title="Editar Lógica de Caja Chica"
              description="Modifica las reglas de gastos automáticos para La Paz."
            />
             <AdminLinkCard 
              href="/admin/edit-service-order-logic"
              icon={ClipboardEdit}
              title="Editar Lógica de Órdenes"
              description="Define las reglas para la generación de órdenes de servicio."
            />
             <AdminLinkCard 
              href="/admin/users"
              icon={Users}
              title="Administrar Usuarios"
              description="Visualiza todos los usuarios registrados y sus estadísticas de uso."
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

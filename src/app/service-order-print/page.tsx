"use client";

import { Suspense } from "react";
import { ServiceOrderPrintPage } from "@/components/service-order/ServiceOrderPreviewModal";
import { Loader2 } from "lucide-react";

function Fallback() {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Cargando...</p>
        </div>
    )
}

export default function PrintPage() {
    return (
        <Suspense fallback={<Fallback />}>
            <ServiceOrderPrintPage />
        </Suspense>
    );
}

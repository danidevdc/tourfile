

"use client";

import React, { useMemo, useRef, useState } from "react";
import { parse } from "date-fns";
import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";
import { copiarVistaPreviaAlClipboard } from "@/lib/copyPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// The React component is now effectively deprecated and we are using the pure JS version.
// This file is kept to avoid breaking imports but its content is not directly used for rendering the modal.
export default function ServiceOrderSimplePreviewModal({ order, onClose }: any) {
    return null;
}

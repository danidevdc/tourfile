// This file is no longer used for PDF or image generation and can be removed.
// Kept for reference in case a server-side route is needed again.
// To re-enable, you would need to add back puppeteer dependencies and fix environment issues.

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json(
        { error: "This endpoint is deprecated.", details: "PDF generation is now handled on the client-side." },
        { status: 410 } // 410 Gone
    );
}


import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse("Missing URL", { status: 400 });
    }

    // Logic to extract ID and construct robust Google Drive URL
    // Legacy Code logic: https://drive.google.com/uc?export=download&id={file_id}
    let targetUrl = url;
    
    try {
        let fileId = null;
        if (url.includes('/d/')) {
            fileId = url.split('/d/')[1].split('/')[0];
        } else if (url.includes('id=')) {
            fileId = url.split('id=')[1].split('&')[0];
        }

        if (fileId) {
            targetUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        }

        const response = await fetch(targetUrl);

        if (!response.ok) {
            console.error(`Proxy Error fetching ${targetUrl}: ${response.status} ${response.statusText}`);
            return new NextResponse("Failed to fetch image", { status: 502 });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(Buffer.from(arrayBuffer), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            }
        });

    } catch (error) {
        console.error("Proxy Exception:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

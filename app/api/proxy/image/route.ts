
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse("Missing URL", { status: 400 });
    }

    // Logic to extract ID and construct robust Google Drive URL
    let targetUrl = url;
    
    try {
        // If it's already a direct lh3 content URL, use it but ensure it has proper size/auth params if needed
        if (url.includes('lh3.googleusercontent.com')) {
            targetUrl = url;
        } else {
            let fileId = null;
            if (url.includes('/d/')) {
                fileId = url.split('/d/')[1].split('/')[0];
            } else if (url.includes('id=')) {
                fileId = url.split('id=')[1].split('&')[0];
            }

            if (fileId) {
                targetUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
        }

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Proxy Error fetching ${targetUrl}: ${response.status} ${response.statusText}`);
            // Fallback: If construction failed, try the original URL directly if we haven't already
            if (targetUrl !== url) {
                const retryRes = await fetch(url);
                if (retryRes.ok) {
                    const contentType = retryRes.headers.get('content-type') || 'image/png';
                    const arrayBuffer = await retryRes.arrayBuffer();
                    return new NextResponse(Buffer.from(arrayBuffer), {
                        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' }
                    });
                }
            }
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

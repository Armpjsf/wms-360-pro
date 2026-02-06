// Production URL on Vercel
export const API_BASE_URL = 'https://wms-360-pro.vercel.app'; 

export const getApiUrl = (path: string) => {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Check if running on localhost
    const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1');

    // If localhost, always use relative path
    if (isLocalhost) {
        return cleanPath;
    }

    // Mobile (Capacitor) ONLY -> Use Full URL
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Capacitor) {
        return `${API_BASE_URL}${cleanPath}`;
    }

    // Default: Relative Path
    return cleanPath;
};

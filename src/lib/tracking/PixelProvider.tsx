"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { initPixel } from "./pixel";

type PixelProviderProps = {
    pixelId?: string;
    children: React.ReactNode;
};

export function PixelProvider({ pixelId, children }: PixelProviderProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // On route change, we can trigger PageView. 
    // In Next.js app router, this runs on mounting and path changes.
    useEffect(() => {
        if (pixelId) {
            initPixel(pixelId);
        }
    }, [pathname, searchParams, pixelId]);

    if (!pixelId) {
        return <>{children}</>;
    }

    return (
        <>
            <Script
                id="fb-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
                }}
            />
            {children}
        </>
    );
}

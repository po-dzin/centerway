"use client";

import { createContext, useContext } from "react";

export type ZenPreviewNavigation = { returnToBuilder: () => void };

export const ZenPreviewContext = createContext<ZenPreviewNavigation | null>(null);
export const useZenPreview = () => useContext(ZenPreviewContext);

"use client";

import { createContext } from "react";

/**
 * How the chat tells the page which session is open.
 *
 * `TrueForgeUI` renders a custom `layout` inside its own provider stack, and the
 * active session id only exists in there. React context reaches into that tree
 * without the SDK needing to know anything about the panel beside it.
 */
export const ReportSession = createContext<(id: string | undefined) => void>(() => {});

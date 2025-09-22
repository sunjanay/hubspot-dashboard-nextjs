'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import type { ReactElement } from 'react';

/**
 * Theme provider component that wraps the application with theme context.
 *
 * Provides theme switching capabilities and persists theme preferences
 * across browser sessions.
 *
 * @component
 * @param props - The theme provider props
 * @returns The theme provider wrapper
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps): ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
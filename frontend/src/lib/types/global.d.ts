// frontend/src/types/global.d.ts
import { useInteractiveScraper } from '@/lib/hooks/useInteractiveScraper';

declare global {
  interface Window {
    interactiveScraper?: ReturnType<typeof useInteractiveScraper>;
  }
}
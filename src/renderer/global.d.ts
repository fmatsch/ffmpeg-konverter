import type { ConverterApi } from '@shared/api';

declare global {
  interface Window {
    api: ConverterApi;
  }
}

export {};

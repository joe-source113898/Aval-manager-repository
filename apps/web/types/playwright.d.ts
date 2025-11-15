declare module "@playwright/test" {
  export const defineConfig: (...args: any[]) => any;
  export const devices: Record<string, Record<string, unknown>>;
}

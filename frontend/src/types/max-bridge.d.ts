export {};

declare global {
  interface Window {
    WebApp?: {
      platform?: "ios" | "android" | "desktop" | "web";
      initData?: string;
      initDataUnsafe?: {
        user?: {
          id: string | number;
          first_name: string;
          last_name?: string;
          username?: string;
          photo_url?: string;
        };
      };
      BackButton?: {
        show(): void;
        hide(): void;
        onClick(callback: () => void): void;
        offClick(callback: () => void): void;
      };
      HapticFeedback?: {
        notificationOccurred(type: "success" | "error" | "warning"): void;
      };
    };
  }
}

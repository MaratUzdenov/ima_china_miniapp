import {
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  expandViewport,
  hideBackButton,
  init,
  isTMA,
  miniAppReady,
  mockTelegramEnv,
  mountBackButton,
  mountMiniAppSync,
  mountThemeParamsSync,
  mountViewport,
  offBackButtonClick,
  onBackButtonClick,
  retrieveRawInitData,
  showBackButton,
} from '@telegram-apps/sdk';

// Открыли не в Telegram (обычный браузер, разработка) — подставляем «Telegram понарошку»,
// чтобы экран выглядел так же. Цвета здесь — только для браузера: в Telegram берутся из его темы.
function mockOutsideTelegram(): void {
  mockTelegramEnv({
    launchParams: {
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'tdesktop',
      tgWebAppThemeParams: {
        bg_color: '#ffffff',
        secondary_bg_color: '#f1f1f4',
        section_bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#8e8e93',
        subtitle_text_color: '#8e8e93',
        link_color: '#2481cc',
        accent_text_color: '#2481cc',
        button_color: '#2481cc',
        button_text_color: '#ffffff',
        destructive_text_color: '#e53935',
        section_separator_color: '#e0e0e5',
        header_bg_color: '#ffffff',
        bottom_bar_bg_color: '#ffffff',
      },
    },
  });
}

export const insideTelegram = isTMA();

export function setupTelegram(): void {
  if (!insideTelegram) mockOutsideTelegram();
  init();
  mountThemeParamsSync();
  mountMiniAppSync();
  bindThemeParamsCssVars(); // --tg-theme-bg-color, --tg-theme-text-color, …
  bindMiniAppCssVars();
  mountBackButton();
  // Разворачиваем на весь экран: списки заказов длинные.
  mountViewport()
    .then(() => expandViewport())
    .catch(() => { /* старый клиент Telegram — останется в половину экрана, не страшно */ });
  miniAppReady();
}

// Подписанная строка от Telegram. Бэкенд проверяет её подпись; без неё API ничего не отдаёт.
export function getInitData(): string {
  if (!insideTelegram) return '';
  try {
    return retrieveRawInitData() || '';
  } catch {
    return '';
  }
}

// Системная кнопка «Назад» в шапке Telegram. Возвращает функцию отписки.
export function useTelegramBack(handler: (() => void) | null): () => void {
  if (!handler) {
    hideBackButton();
    return () => {};
  }
  showBackButton();
  onBackButtonClick(handler);
  return () => {
    offBackButtonClick(handler);
    hideBackButton();
  };
}

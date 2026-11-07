import {
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  expandViewport,
  hapticFeedbackNotificationOccurred,
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
  openLink,
  onBackButtonClick,
  retrieveRawInitData,
  showBackButton,
} from '@telegram-apps/sdk';

// Открыли не в Telegram (обычный браузер, разработка) — подставляем «Telegram понарошку»,
// чтобы экран выглядел так же. Цвета здесь — только для браузера: в Telegram берутся из его темы.
function mockOutsideTelegram(): void {
  try { sessionStorage.setItem(MOCK_FLAG, '1'); } catch { /* приватный режим — не страшно */ }
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

// Метка «это мы подставили Telegram понарошку»: SDK запоминает подставные данные в sessionStorage,
// и после перезагрузки страницы isTMA() начинает верить, что мы в Telegram.
const MOCK_FLAG = 'tgMocked';
function wasMocked(): boolean {
  try { return sessionStorage.getItem(MOCK_FLAG) === '1'; } catch { return false; }
}
export const insideTelegram = isTMA() && !wasMocked();

export function setupTelegram(): void {
  try {
    setupTelegramUnsafe();
  } catch (err) {
    // Экран всё равно покажем — без темы и кнопки «Назад», но с данными.
    console.error('Не удалось подключиться к Telegram', err);
  }
}

function setupTelegramUnsafe(): void {
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

// Ссылки (1688, Taobao) — во внешнем браузере: внутри Mini App они откроются криво или не откроются.
export function openExternal(url: string): void {
  try {
    if (insideTelegram) { openLink(url); return; }
  } catch { /* старый клиент — откроем обычным способом */ }
  window.open(url, '_blank', 'noopener');
}

// Лёгкая вибрация «готово» после сохранения. Нет поддержки — просто ничего не происходит.
export function notifySuccess(): void {
  try {
    if (insideTelegram) hapticFeedbackNotificationOccurred('success');
  } catch { /* не важно */ }
}

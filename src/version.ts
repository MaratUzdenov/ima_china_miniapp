// Автообновление: GitHub Pages разрешает кэшировать страницу до 10 минут, и Telegram показывает старую версию.
// При запуске сверяем номер сборки с файлом version.json (его запрашиваем мимо кэша).
// Есть новее — перезагружаем страницу с другим адресом (?v=…), чтобы кэш точно не сработал.
const BUILD_ID = __BUILD_ID__;
const RELOAD_FLAG = 'reloadedFor';

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json() as { build?: string };
    if (!build || build === BUILD_ID) return;
    // Защита от бесконечной перезагрузки, если новая версия почему-то не подтягивается.
    if (sessionStorage.getItem(RELOAD_FLAG) === build) return;
    sessionStorage.setItem(RELOAD_FLAG, build);
    const url = new URL(location.href);
    url.searchParams.set('v', build);
    location.replace(url.toString()); // хеш с данными Telegram (#tgWebAppData…) сохраняется
  } catch {
    /* нет сети или sessionStorage недоступен — работаем на текущей версии */
  }
}

/**
 * Puts a page back in the address bar after a reload on GitHub Pages
 * (#942). Pages serves only real files, so reloading a demo page such as
 * /platform-main/helpdesk/agent lands on the site's 404.html, which comes
 * back to the demo as /platform-main/helpdesk/?route=%2Fagent. Run before
 * the app starts, this turns that into /platform-main/helpdesk/agent, so
 * the router opens the page the visitor was on. Only a path within the demo
 * is accepted (one leading slash), never another site.
 */
export function restoreRoute(
  location: Pick<Location, 'href'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
  baseUri: string = document.baseURI
): void {
  const route = new URL(location.href).searchParams.get('route');
  if (route === null || !route.startsWith('/') || route.startsWith('//')) {
    return;
  }
  const base = new URL(baseUri).pathname.replace(/\/$/, '');
  history.replaceState(null, '', base + route);
}

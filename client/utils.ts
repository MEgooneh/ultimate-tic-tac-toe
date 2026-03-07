function getPlayerToken(): string {
  let token = localStorage.getItem('uttt_player_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('uttt_player_token', token);
  }
  return token;
}

function getBaseUrl(): string {
  return window.location.origin;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

function getPlayerName(): string {
  return localStorage.getItem('uttt_player_name') || '';
}

function setPlayerName(name: string): void {
  localStorage.setItem('uttt_player_name', name.trim().slice(0, 20));
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

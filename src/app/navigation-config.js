export const NAV_ITEMS = Object.freeze([
  { id: 'girls', label: '女孩', mode: 'girls', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>' },
  { id: 'events', label: '行程', mode: 'events', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>' },
  { id: 'schedule', label: '班表', mode: 'schedule', modes: ['schedule', 'matches'], icon: '<path d="M4 4h16v16H4zM8 2v4M16 2v4M4 9h16M8 13h3M13 13h3M8 17h3"/>' },
  { id: 'my', label: '我的', mode: 'my', modes: ['my', 'passport'], icon: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>' },
  { id: 'more', label: '更多', mode: 'more', modes: ['more', 'news', 'games', 'vote', 'minigame', 'dreamteam', 'agency', 'feedback', 'themes', 'allstar'], icon: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>' }
]);

export function parentForMode(mode) {
  return NAV_ITEMS.find(item => (item.modes || [item.mode]).includes(mode))?.id || 'more';
}

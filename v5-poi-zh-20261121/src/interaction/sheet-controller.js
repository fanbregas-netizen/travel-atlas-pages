/* Standalone Travel Atlas sheet state machine; no map, DOM or storage access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravelAtlasSheet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LEVELS = Object.freeze(['closed', 'peek', 'half', 'full']);
  const OPEN_LEVELS = Object.freeze(['peek', 'half', 'full']);
  function gestureDirection(g) {
    if (!g || g.interactive || g.multiTouch) return null;
    const dx = Number(g.deltaX), dy = Number(g.deltaY), ms = Number(g.durationMs);
    if (![dx,dy,ms].every(Number.isFinite) || ms <= 0) return null;
    if (Math.abs(dx) > Math.abs(dy) * 0.8) return null;
    const flick = ms <= 650 && Math.abs(dy) / ms >= 0.65;
    if (Math.abs(dy) < 48 && !(flick && Math.abs(dy) >= 24)) return null;
    if (dy > 0 && g.fromContent && Number(g.scrollTop) > 1) return null;
    return dy < 0 ? 'up' : 'down';
  }
  function createSheetController(options) {
    const subscribers = new Set();
    if (options && typeof options.onChange === 'function') subscribers.add(options.onChange);
    let selectedPlaceId = null, sheet = 'closed', revision = 0;
    const state = () => Object.freeze({ selectedPlaceId, sheet, revision });
    function emit(previous, reason) {
      const next = state();
      if (next.selectedPlaceId !== previous.selectedPlaceId || next.sheet !== previous.sheet) {
        for (const fn of [...subscribers]) fn(next, previous, reason);
      }
      return next;
    }
    function open(placeId) {
      if (typeof placeId !== 'string' || !placeId.trim()) throw new TypeError('placeId must be a non-empty string');
      const id = placeId.trim(), previous = state();
      if (id !== selectedPlaceId || sheet === 'closed') revision++;
      selectedPlaceId = id;
      sheet = id === previous.selectedPlaceId && previous.sheet !== 'closed' ? previous.sheet : 'peek';
      return emit(previous, 'open');
    }
    function close() {
      const previous = state();
      if (sheet === 'closed') return previous;
      revision++; selectedPlaceId = null; sheet = 'closed';
      return emit(previous, 'close');
    }
    function toggle(placeId) {
      return selectedPlaceId === placeId && sheet !== 'closed' ? close() : open(placeId);
    }
    function snapTo(level) {
      if (!OPEN_LEVELS.includes(level)) throw new RangeError('snap level must be peek, half, or full');
      if (sheet === 'closed') return state();
      const previous = state(); sheet = level; return emit(previous, 'snap');
    }
    function swipe(gesture) {
      if (sheet === 'closed') return state();
      const direction = gestureDirection(gesture);
      if (!direction) return state();
      const next = LEVELS.indexOf(sheet) + (direction === 'up' ? 1 : -1);
      return next <= 0 ? close() : snapTo(LEVELS[Math.min(next, 3)]);
    }
    const requestTicket = () => Object.freeze({ placeId: selectedPlaceId, revision });
    const isCurrent = ticket => !!ticket && sheet !== 'closed' && ticket.placeId === selectedPlaceId && ticket.revision === revision;
    function subscribe(fn) {
      if (typeof fn !== 'function') throw new TypeError('subscriber must be a function');
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    }
    return Object.freeze({ getState: state, open, close, toggle, snapTo, swipe, requestTicket, isCurrent, subscribe });
  }
  return Object.freeze({ LEVELS, OPEN_LEVELS, gestureDirection, createSheetController });
});

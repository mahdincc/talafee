/**
 * Talafee Price Alerts Client
 * Push subscription management, alert CRUD, and the in-page alarm sound.
 */

const TalafeeAlerts = (function () {
  'use strict';

  function resolveApiBase() {
    const { protocol, hostname } = window.location;
    if (protocol === 'file:') return 'http://localhost:3001/api/v1';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api/v1';
    }
    return '/api/v1';
  }

  const API_BASE = resolveApiBase();

  let audioContext = null;

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  async function getRegistration() {
    return navigator.serviceWorker.register('/sw.js');
  }

  /**
   * Ensure notification permission + push subscription exist.
   * Returns 'unsupported' | 'denied' | 'ready'.
   */
  async function setup() {
    if (!isSupported()) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const registration = await getRegistration();
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const { publicKey } = await request('/alerts/vapid-public-key');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await request('/alerts/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription.toJSON()),
    });

    return 'ready';
  }

  /** Endpoint of the existing subscription, or null (never prompts). */
  async function getEndpoint() {
    if (!isSupported() || Notification.permission !== 'granted') return null;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return null;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? subscription.endpoint : null;
  }

  async function createAlert(fields) {
    const endpoint = await getEndpoint();
    if (!endpoint) throw new Error('no-subscription');
    const { data } = await request('/alerts', {
      method: 'POST',
      body: JSON.stringify({ endpoint, ...fields }),
    });
    return data;
  }

  async function listAlerts() {
    const endpoint = await getEndpoint();
    if (!endpoint) return [];
    const { data } = await request(`/alerts?endpoint=${encodeURIComponent(endpoint)}`);
    return data;
  }

  async function updateAlert(id, patch) {
    const endpoint = await getEndpoint();
    if (!endpoint) throw new Error('no-subscription');
    const { data } = await request(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ endpoint, ...patch }),
    });
    return data;
  }

  async function deleteAlert(id) {
    const endpoint = await getEndpoint();
    if (!endpoint) throw new Error('no-subscription');
    await request(`/alerts/${id}?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
  }

  /** Call from a user gesture so the alarm can sound later without one. */
  function unlockAudio() {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioContext = new Ctx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function playAlarm() {
    unlockAudio();
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'square';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + i * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.6, now + i * 0.45 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.45 + 0.4);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + i * 0.45);
      osc.stop(now + i * 0.45 + 0.42);
    }
  }

  /** Play the alarm and re-dispatch SW push messages as DOM events. */
  function startAlarmListener() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'price-alert') {
        playAlarm();
        window.dispatchEvent(new CustomEvent('talafee:price-alert', { detail: event.data }));
      }
    });
  }

  return {
    isSupported,
    setup,
    getEndpoint,
    createAlert,
    listAlerts,
    updateAlert,
    deleteAlert,
    unlockAudio,
    playAlarm,
    startAlarmListener,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TalafeeAlerts;
}

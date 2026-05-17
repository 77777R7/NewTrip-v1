const selectors = {
  authId: document.querySelector('#authId'),
  resetPlayer: document.querySelector('#resetPlayer'),
  offlineHours: document.querySelector('#offlineHours'),
  statusLine: document.querySelector('#statusLine'),
  hudDistance: document.querySelector('#hudDistance'),
  hudRoute: document.querySelector('#hudRoute'),
  hudStatus: document.querySelector('#hudStatus'),
  vehicleName: document.querySelector('#vehicleName'),
  tripProgress: document.querySelector('#tripProgress'),
  fuelMeter: document.querySelector('#fuelMeter'),
  cleanMeter: document.querySelector('#cleanMeter'),
  durabilityMeter: document.querySelector('#durabilityMeter'),
  fuelValue: document.querySelector('#fuelValue'),
  cleanValue: document.querySelector('#cleanValue'),
  durabilityValue: document.querySelector('#durabilityValue'),
  summaryTab: document.querySelector('#summaryTab'),
  walletTab: document.querySelector('#walletTab'),
  questsTab: document.querySelector('#questsTab'),
  eventsTab: document.querySelector('#eventsTab'),
  rawTab: document.querySelector('#rawTab'),
};

const state = {
  player: null,
  currentTrip: null,
  routes: [],
  quests: null,
  analytics: [],
  risks: [],
  lastResult: null,
  tickSeq: 0,
};

const storedAuthId = localStorage.getItem('newtrip.debug.authId');
selectors.authId.value = storedAuthId || `debug-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;
localStorage.setItem('newtrip.debug.authId', selectors.authId.value);

selectors.authId.addEventListener('change', () => {
  localStorage.setItem('newtrip.debug.authId', selectors.authId.value.trim() || 'debug-client');
  void refreshAll('Player switched.');
});

selectors.resetPlayer.addEventListener('click', () => {
  selectors.authId.value = `debug-${Date.now()}`;
  localStorage.setItem('newtrip.debug.authId', selectors.authId.value);
  state.tickSeq = 0;
  void refreshAll('New player id created.');
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => runAction(button.dataset.action));
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    button.classList.add('active');
    document.querySelector(`#${button.dataset.tab}Tab`)?.classList.add('active');
  });
});

function authHeaders() {
  return {
    'content-type': 'application/json',
    'x-newtrip-auth-id': selectors.authId.value.trim() || 'debug-client',
  };
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    const error = new Error(Array.isArray(message) ? message.join(', ') : message);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function post(path, body = {}) {
  return api(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function refreshAll(message = 'State refreshed.') {
  const [playerState, currentTrip, routes, quests, analytics, risks] = await Promise.all([
    api('/player/state'),
    api('/trip/current').catch(() => null),
    api('/routes/available').catch(() => []),
    api('/quests/daily').catch(() => null),
    api('/admin/analytics-events?limit=150').catch(() => []),
    api('/admin/suspicious-events?limit=80').catch(() => []),
  ]);

  state.player = playerState;
  state.currentTrip = currentTrip;
  state.routes = routes;
  state.quests = quests;
  state.analytics = analytics;
  state.risks = risks;
  setStatus(message);
  render();
}

async function runAction(action) {
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach((button) => button.disabled = true);

  try {
    const result = await actions[action]();
    state.lastResult = result ?? state.lastResult;
    await refreshAll(actionLabels[action] ?? 'Action complete.');
  } catch (error) {
    setStatus(`${actionLabels[action] ?? 'Action'} failed: ${error.message}`, true);
    state.lastResult = error.payload ?? { error: error.message, status: error.status };
    render();
  } finally {
    buttons.forEach((button) => button.disabled = false);
  }
}

const actionLabels = {
  loadState: 'Player state loaded',
  startTutorial: 'Tutorial trip started',
  driveTick: 'Online drive tick sent',
  simulateOffline: 'Offline progress simulated',
  claimReport: 'Travel Report claimed',
  completeLandmark: 'Landmark completed',
  refuel: 'Vehicle refueled',
  clean: 'Vehicle cleaned',
  repair: 'Vehicle repaired',
  completeRoute: 'Route completed',
  unlockShortRoute: 'Short Route unlocked',
  runDemo: 'Demo script completed',
};

const actions = {
  loadState: () => api('/player/state'),
  async startTutorial() {
    const playerState = state.player ?? await api('/player/state');
    const route = state.routes.find((candidate) => candidate.routeType === 'Tutorial') ?? { routeId: 'tutorial_big_sur_hwy1_001' };
    const vehicle = playerState.vehicles?.[0];
    return post('/routes/start', {
      route_id: route.routeId ?? route.routeKey,
      player_vehicle_id: vehicle?.playerVehicleId,
      idempotency_key: `debug_start_${Date.now()}`,
    });
  },
  async driveTick() {
    const trip = await requireTrip();
    await post('/debug/prime-drive-tick', { seconds: 15 });
    state.tickSeq += 1;
    return post('/trip/drive-tick', {
      trip_id: trip.tripId,
      mode: preferredDriveMode(),
      client_tick_seq: state.tickSeq,
      idempotency_key: `debug_drive_${Date.now()}`,
    });
  },
  simulateOffline() {
    return post('/debug/simulate-offline', {
      hours: Number(selectors.offlineHours.value || 2),
    });
  },
  async claimReport() {
    const report = state.player?.pendingOfflineReport;
    if (!report) {
      throw new Error('No pending Travel Report.');
    }
    return post('/trip/claim-offline-report', {
      report_id: report.reportId,
      idempotency_key: `debug_claim_report_${Date.now()}`,
    });
  },
  async completeLandmark() {
    const trip = await requireTrip();
    const landmark = trip.route?.landmarks?.find((candidate) => candidate.requiredStop)
      ?? state.player?.pendingOfflineReport?.landmarkReached;
    if (!landmark) {
      throw new Error('No required landmark is available.');
    }
    return post('/trip/complete-landmark', {
      trip_id: trip.tripId,
      landmark_id: landmark.landmarkId,
      action: 'TAKE_PHOTO',
      idempotency_key: `debug_landmark_${Date.now()}`,
    });
  },
  async refuel() {
    const vehicle = await selectedVehicle();
    return post('/vehicle/refuel', {
      player_vehicle_id: vehicle.playerVehicleId,
      idempotency_key: `debug_refuel_${Date.now()}`,
    });
  },
  async clean() {
    const vehicle = await selectedVehicle();
    return post('/vehicle/clean', {
      player_vehicle_id: vehicle.playerVehicleId,
      idempotency_key: `debug_clean_${Date.now()}`,
    });
  },
  async repair() {
    const vehicle = await selectedVehicle();
    return post('/vehicle/repair', {
      player_vehicle_id: vehicle.playerVehicleId,
      idempotency_key: `debug_repair_${Date.now()}`,
    });
  },
  async completeRoute() {
    const trip = await requireTrip();
    return post('/trip/complete-route', {
      trip_id: trip.tripId,
      idempotency_key: `debug_complete_route_${Date.now()}`,
    });
  },
  async unlockShortRoute() {
    const route = state.routes.find((candidate) => candidate.routeType === 'Short')
      ?? { routeId: 'short_coast_to_town_001' };
    return post('/routes/unlock', {
      route_id: route.routeId ?? route.routeKey,
      idempotency_key: `debug_unlock_short_${Date.now()}`,
    });
  },
  async runDemo() {
    setStatus('Running demo script...');
    await actions.loadState();
    await refreshAll('Demo: player ready.');
    await actions.startTutorial().catch(ignoreExpected('ACTIVE_TRIP_EXISTS'));
    await refreshAll('Demo: tutorial active.');
    await actions.driveTick().catch(ignoreExpected('TRIP_NOT_ACTIVE'));
    await refreshAll('Demo: online tick recorded.');
    selectors.offlineHours.value = '2';
    await actions.simulateOffline();
    await refreshAll('Demo: first Travel Report generated.');
    await actions.claimReport();
    await refreshAll('Demo: report claimed.');
    await actions.completeLandmark();
    await refreshAll('Demo: landmark photo taken.');
    selectors.offlineHours.value = '8';
    await actions.simulateOffline();
    await refreshAll('Demo: route-end Travel Report generated.');
    if (state.player?.pendingOfflineReport) {
      await actions.claimReport();
      await refreshAll('Demo: route-end report claimed.');
    }
    await actions.refuel().catch(ignoreExpected('FULL_FUEL'));
    await actions.clean().catch(ignoreExpected('FULL_CLEANLINESS'));
    await actions.repair().catch(ignoreExpected('FULL_DURABILITY'));
    await refreshAll('Demo: vehicle maintained.');
    await actions.completeRoute();
    await refreshAll('Demo: tutorial route completed.');
    await actions.unlockShortRoute();
    return refreshAll('Demo script completed.');
  },
};

function ignoreExpected(code) {
  return (error) => {
    if (!String(error.message).includes(code)) {
      throw error;
    }
  };
}

async function requireTrip() {
  const trip = state.currentTrip ?? await api('/trip/current');
  if (!trip) {
    throw new Error('No active trip.');
  }
  return trip;
}

async function selectedVehicle() {
  const playerState = state.player ?? await api('/player/state');
  const vehicle = playerState.vehicles?.find((candidate) => candidate.isSelected) ?? playerState.vehicles?.[0];
  if (!vehicle) {
    throw new Error('No vehicle.');
  }
  return vehicle;
}

function preferredDriveMode() {
  const tutorialState = state.player?.profile?.tutorialState;
  return ['AUTO_DRIVING_UNLOCKED', 'FIRST_LANDMARK_REACHED', 'PHOTO_TAKEN', 'FULL_SYSTEM_UNLOCKED'].includes(tutorialState)
    ? 'AUTO_DRIVING'
    : 'HOLD_TO_DRIVE';
}

function setStatus(message, isError = false) {
  selectors.statusLine.textContent = message;
  selectors.statusLine.classList.toggle('error', isError);
}

function render() {
  const trip = state.currentTrip;
  const vehicle = state.player?.vehicles?.find((candidate) => candidate.isSelected) ?? state.player?.vehicles?.[0];
  const route = trip?.route;
  const distance = trip?.currentDistanceKm ?? 0;
  const total = route?.totalDistanceKm ?? 100;
  const percent = Math.min(100, Math.round((distance / total) * 100));

  selectors.hudDistance.textContent = `${distance.toFixed(1)} km`;
  selectors.hudRoute.textContent = route?.name ?? 'Big Sur Sunset Drive';
  selectors.hudStatus.textContent = trip ? `${trip.status}${trip.forcedStopReason ? ` / ${trip.forcedStopReason}` : ''}` : 'No active trip';
  selectors.vehicleName.textContent = vehicle?.displayName ?? 'Starter Vehicle';
  selectors.tripProgress.textContent = `${percent}%`;
  setMeter(selectors.fuelMeter, selectors.fuelValue, vehicle?.currentFuel, vehicle?.fuelCapacity);
  setMeter(selectors.cleanMeter, selectors.cleanValue, vehicle?.currentCleanliness, 100);
  setMeter(selectors.durabilityMeter, selectors.durabilityValue, vehicle?.currentDurability, 100);

  renderSummary(trip, vehicle);
  renderWallet();
  renderQuests();
  renderEvents();
  selectors.rawTab.textContent = JSON.stringify({
    player: state.player,
    currentTrip: state.currentTrip,
    quests: state.quests,
    lastResult: state.lastResult,
  }, null, 2);
}

function setMeter(meter, valueNode, value, max) {
  const safeMax = max || 100;
  const safeValue = value ?? 0;
  meter.max = safeMax;
  meter.value = safeValue;
  valueNode.textContent = value === undefined ? '--' : `${safeValue.toFixed(1)} / ${safeMax}`;
}

function renderSummary(trip, vehicle) {
  const profile = state.player?.profile;
  const report = state.player?.pendingOfflineReport;
  selectors.summaryTab.innerHTML = [
    kv('Tutorial', pill(profile?.tutorialState ?? 'none', profile?.tutorialState === 'FULL_SYSTEM_UNLOCKED' ? 'good' : 'warn')),
    kv('Trip', trip ? `${trip.currentDistanceKm.toFixed(1)} / ${trip.route?.totalDistanceKm ?? '--'} km` : 'No active trip'),
    kv('Stop', trip?.forcedStopReason ?? 'None'),
    kv('Vehicle', vehicle ? `${vehicle.displayName} L${vehicle.upgradeLevel}` : 'None'),
    kv('Pending Report', report ? `${report.distanceTravelledKm.toFixed(1)} km, ${report.roadCoinsPending} coins, ${report.travelTokensPending} tokens` : 'None'),
    kv('Next Route', routeLine()),
  ].join('');
}

function renderWallet() {
  const balances = state.player?.walletBalances ?? [];
  selectors.walletTab.innerHTML = balances.map((balance) => `
    <div class="wallet-row">
      <span>${escapeHtml(balance.currency)}</span>
      <strong>${Number(balance.balance).toLocaleString()}</strong>
    </div>
  `).join('') || '<p class="hint">No wallet state yet.</p>';
}

function renderQuests() {
  const quests = state.quests?.quests ?? [];
  selectors.questsTab.innerHTML = quests.map((quest) => `
    <div class="quest-row">
      <strong>${escapeHtml(quest.title)}</strong>
      <span class="list-label">${Number(quest.progressValue).toFixed(2)} / ${quest.targetValue} ${quest.claimed ? 'claimed' : quest.completed ? 'ready' : 'open'}</span>
      <span class="pill ${quest.claimed ? 'good' : quest.completed ? 'warn' : ''}">${escapeHtml(quest.reward.currency)} +${quest.reward.amount}</span>
    </div>
  `).join('') || '<p class="hint">No quests loaded.</p>';
}

function renderEvents() {
  const recentAnalytics = state.analytics.slice(-8).reverse();
  const recentRisks = state.risks.slice(-5).reverse();
  selectors.eventsTab.innerHTML = `
    <p class="list-label">Analytics</p>
    ${recentAnalytics.map((event) => eventRow(event.eventName, event.eventPayload)).join('') || '<p class="hint">No analytics yet.</p>'}
    <p class="list-label">Risk</p>
    ${recentRisks.map((event) => eventRow(event.riskType, event.serverSnapshot)).join('') || '<p class="hint">No suspicious events yet.</p>'}
  `;
}

function eventRow(name, payload) {
  return `
    <div class="event-row">
      <strong>${escapeHtml(name)}</strong>
      <span class="list-label">${escapeHtml(JSON.stringify(payload ?? {}))}</span>
    </div>
  `;
}

function routeLine() {
  const shortRoute = state.routes.find((route) => route.routeType === 'Short');
  if (!shortRoute) {
    return 'Hidden until tutorial completion';
  }
  return `${shortRoute.name} ${shortRoute.isUnlocked ? 'unlocked' : `${shortRoute.unlockCostStamps} Stamp`}`;
}

function kv(label, value) {
  return `<div class="kv"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function pill(value, tone = '') {
  return `<span class="pill ${tone}">${escapeHtml(value)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

void refreshAll('Ready.');

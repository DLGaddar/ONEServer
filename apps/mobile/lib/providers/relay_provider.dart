import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/relay_client.dart';
import '../core/secure_storage.dart';

// ──────────────────────────────────────────────────────────────────────────────
// Relay connection state notifier
// ──────────────────────────────────────────────────────────────────────────────

enum RelayStatus { disconnected, connecting, connected }

class RelayState {
  final RelayStatus status;
  final String? pairingCode;
  final String? relayUrl;

  const RelayState({
    this.status = RelayStatus.disconnected,
    this.pairingCode,
    this.relayUrl,
  });

  RelayState copyWith({
    RelayStatus? status,
    String? pairingCode,
    String? relayUrl,
  }) {
    return RelayState(
      status: status ?? this.status,
      pairingCode: pairingCode ?? this.pairingCode,
      relayUrl: relayUrl ?? this.relayUrl,
    );
  }
}

class RelayNotifier extends StateNotifier<RelayState> {
  final RelayClient _client;
  final SecureStorageService _storage;

  RelayNotifier(this._client, this._storage) : super(const RelayState()) {
    _client.onConnectionStateChange = (connected) {
      state = state.copyWith(
        status: connected ? RelayStatus.connected : RelayStatus.disconnected,
      );
    };
  }

  Future<void> tryRestoreSession() async {
    final code = await _storage.getPairingCode();
    final url = await _storage.getRelayUrl();
    if (code != null && url != null) {
      await connect(url, code);
    }
  }

  Future<void> connect(String relayUrl, String pairingCode) async {
    state = state.copyWith(
      status: RelayStatus.connecting,
      relayUrl: relayUrl,
      pairingCode: pairingCode,
    );
    await _storage.savePairingCode(pairingCode);
    await _storage.saveRelayUrl(relayUrl);
    _client.connect(relayUrl, pairingCode);
  }

  Future<void> reconnect() async {
    final code = state.pairingCode ?? await _storage.getPairingCode();
    final url = state.relayUrl ?? await _storage.getRelayUrl();
    if (code != null && url != null) {
      _client.disconnect();
      await connect(url, code);
    }
  }

  void disconnect() {
    _client.disconnect();
    _storage.clearAll();
    state = const RelayState(status: RelayStatus.disconnected);
  }

  Stream<Map<String, dynamic>> get metricsStream => _client.onMetrics;

  void sendCommand(String action, String serverId, {String? containerId}) {
    _client.sendCommand(action, serverId, containerId: containerId);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Providers
// ──────────────────────────────────────────────────────────────────────────────

final relayClientProvider = Provider<RelayClient>((ref) {
  final client = RelayClient();
  ref.onDispose(client.disconnect);
  return client;
});

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final relayProvider = StateNotifierProvider<RelayNotifier, RelayState>((ref) {
  return RelayNotifier(
    ref.read(relayClientProvider),
    ref.read(secureStorageProvider),
  );
});

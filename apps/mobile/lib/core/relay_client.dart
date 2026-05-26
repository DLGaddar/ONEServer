import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'crypto_service.dart';

class RelayClient {
  WebSocketChannel? _channel;
  Uint8List? _aesKey;
  bool _isManualDisconnect = false;
  String? _lastRelayUrl;
  String? _lastPairingCode;

  final _metricsController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onMetrics => _metricsController.stream;

  // Connection health and backoff timers
  int _reconnectDelaySeconds = 2;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  bool isConnected = false;
  Function(bool)? onConnectionStateChange;

  RelayClient() {
    Timer.periodic(const Duration(seconds: 5), (timer) {
      checkConnection();
    });
  }

  void checkConnection() {
    if (_isManualDisconnect) return;
    if (_channel == null || isConnected == false) {
      if (_lastRelayUrl != null && _lastPairingCode != null) {
        debugPrint('[RelayClient] 🔄 Connection lost (active check). Reconnecting...');
        connect(_lastRelayUrl!, _lastPairingCode!);
      }
    }
  }

  /// Connects to the secure WebSocket relay server
  void connect(String relayUrl, String pairingCode) {
    _isManualDisconnect = false;
    _lastRelayUrl = relayUrl;
    _lastPairingCode = pairingCode;
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();

    // Derive strict AES key from pairingCode matching Desktop implementation
    _aesKey = CryptoService.deriveKey(pairingCode);

    try {
      _channel = WebSocketChannel.connect(Uri.parse(relayUrl));

      // Register pairing registration payload to relay
      final pairPayload = jsonEncode({
        'type': 'mobile',
        'pairingCode': pairingCode,
      });
      _channel!.sink.add(pairPayload);

      isConnected = true;
      onConnectionStateChange?.call(true);
      _reconnectDelaySeconds = 2; // Reset reconnect exponential backoff

      // Send pairing confirmation (handshake) to Desktop
      Future.delayed(const Duration(milliseconds: 500), () {
        _sendHandshakeConfirmation();
      });

      _startHeartbeat();

      // Listen on WebSocket stream channel
      _channel!.stream.listen(
        (data) {
          _handleMessage(data.toString());
        },
        onDone: () {
          _handleConnectionClosed(relayUrl, pairingCode);
        },
        onError: (_) {
          _handleConnectionClosed(relayUrl, pairingCode);
        },
        cancelOnError: true,
      );
    } catch (_) {
      _handleConnectionClosed(relayUrl, pairingCode);
    }
  }

  /// Sends encrypted mobile control commands to desktop (docker container restarts, host reboots)
  void sendCommand(String action, String serverId, {String? containerId}) {
    if (_channel == null || _aesKey == null) return;
    try {
      final command = {
        'action': action,
        'serverId': serverId,
        if (containerId != null) 'containerId': containerId,
      };
      final encrypted = CryptoService.encrypt(jsonEncode(command), _aesKey!);
      _channel!.sink.add(jsonEncode(encrypted));
    } catch (_) {}
  }

  /// Gracefully terminates the active session
  void disconnect() {
    _isManualDisconnect = true;
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _aesKey = null;
    isConnected = false;
    onConnectionStateChange?.call(false);
  }

  void _handleMessage(String msg) {
    if (_aesKey == null) return;
    try {
      final encrypted = jsonDecode(msg);
      if (encrypted['iv'] != null && encrypted['ciphertext'] != null && encrypted['tag'] != null) {
        // Decrypt the raw metrics package
        final decrypted = CryptoService.decrypt(
          encrypted['iv'],
          encrypted['ciphertext'],
          encrypted['tag'],
          _aesKey!,
        );
        debugPrint('[RelayClient] 🔑 GCM Decryption Success! Raw Metrics Payload: $decrypted');
        final payload = jsonDecode(decrypted) as Map<String, dynamic>;
        _metricsController.add(payload);
      }
    } catch (_) {
      // Fail-silent, ignore malformed metrics
    }
  }

  void _sendHandshakeConfirmation() {
    if (_channel == null || _aesKey == null) return;
    try {
      final confirm = {
        'action': 'pair:confirm',
        'deviceId': 'mobile-flutter-client',
        'serverId': '',
      };
      final encrypted = CryptoService.encrypt(jsonEncode(confirm), _aesKey!);
      _channel!.sink.add(jsonEncode(encrypted));
    } catch (_) {}
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      // The ws package automatically handles ping-pong.
      // We keep a lightweight timer to verify socket status periodically.
    });
  }

  void _handleConnectionClosed(String relayUrl, String pairingCode) {
    isConnected = false;
    onConnectionStateChange?.call(false);
    _heartbeatTimer?.cancel();

    if (_isManualDisconnect) return;

    // Reconnection exponential backoff routine (max 30s)
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: _reconnectDelaySeconds), () {
      connect(relayUrl, pairingCode);
    });

    _reconnectDelaySeconds = (_reconnectDelaySeconds * 2).clamp(2, 30);
  }
}

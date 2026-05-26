import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/server_metrics.dart';
import 'relay_provider.dart';

// ──────────────────────────────────────────────────────────────────────────────
// Metrics state notifier – listens to the relay stream and keeps a snapshot
// ──────────────────────────────────────────────────────────────────────────────

class MetricsState {
  final List<ServerMetricsModel> servers;
  final DateTime? lastUpdated;
  final bool isLoading;

  const MetricsState({
    this.servers = const [],
    this.lastUpdated,
    this.isLoading = false,
  });

  MetricsState copyWith({
    List<ServerMetricsModel>? servers,
    DateTime? lastUpdated,
    bool? isLoading,
  }) {
    return MetricsState(
      servers: servers ?? this.servers,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class MetricsNotifier extends StateNotifier<MetricsState> {
  StreamSubscription<Map<String, dynamic>>? _sub;

  MetricsNotifier(Stream<Map<String, dynamic>> metricsStream)
      : super(const MetricsState(isLoading: true)) {
    _sub = metricsStream.listen(_onPayload, onError: (_) {});
  }

  void _onPayload(Map<String, dynamic> payload) {
    try {
      final rawServers = payload['servers'];
      if (rawServers == null) return;
      final list = (rawServers as List<dynamic>)
          .map((e) => ServerMetricsModel.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(
        servers: list,
        lastUpdated: DateTime.now(),
        isLoading: false,
      );
    } catch (_) {
      // Ignore malformed payload silently
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final metricsProvider =
    StateNotifierProvider<MetricsNotifier, MetricsState>((ref) {
  final stream = ref.watch(relayClientProvider).onMetrics;
  return MetricsNotifier(stream);
});

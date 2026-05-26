import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/server_metrics.dart';
import '../providers/metrics_provider.dart';
import '../providers/relay_provider.dart';
import 'pairing_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// DashboardScreen
// ─────────────────────────────────────────────────────────────────────────────

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> with WidgetsBindingObserver {
  // Tracks which server+action combos are awaiting relay ACK
  final Set<String> _pending = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final relay = ref.read(relayProvider);
      if (relay.status != RelayStatus.connected) {
        ref.read(relayProvider.notifier).reconnect();
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  bool _isPending(String key) => _pending.contains(key);

  Future<void> _withPending(String key, Future<void> Function() work) async {
    if (_isPending(key)) return;
    setState(() => _pending.add(key));
    try {
      await work();
    } finally {
      if (mounted) setState(() => _pending.remove(key));
    }
  }

  // ── 2-step confirmation dialog ─────────────────────────────────────────────

  /// Returns true only when the user clears BOTH confirmation steps.
  Future<bool> _twoStepConfirm({
    required String step1Title,
    required String step1Body,
    required String step2Title,
    required String step2Body,
    required Color accentColor,
    required IconData icon,
  }) async {
    // Step 1
    final step1 = await _showConfirmDialog(
      title: step1Title,
      body: step1Body,
      confirmLabel: 'Devam Et',
      accentColor: accentColor,
      icon: icon,
    );
    if (!step1 || !mounted) return false;

    // Step 2 — final irreversible confirmation
    final step2 = await _showConfirmDialog(
      title: step2Title,
      body: step2Body,
      confirmLabel: 'ONAYLA',
      accentColor: accentColor,
      icon: icon,
      isFinal: true,
    );
    return step2;
  }

  Future<bool> _showConfirmDialog({
    required String title,
    required String body,
    required String confirmLabel,
    required Color accentColor,
    required IconData icon,
    bool isFinal = false,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: !isFinal,
      builder: (_) => _ConfirmDialog(
        title: title,
        body: body,
        confirmLabel: confirmLabel,
        accentColor: accentColor,
        icon: icon,
        isFinal: isFinal,
      ),
    );
    return result ?? false;
  }

  // ── Action: Server Reboot ──────────────────────────────────────────────────

  Future<void> _rebootServer(ServerMetricsModel server) async {
    final key = '${server.serverId}::reboot';
    await _withPending(key, () async {
      final confirmed = await _twoStepConfirm(
        step1Title: 'Sunucu yeniden başlatılsın mı?',
        step1Body:
            '"${server.nickname}" sunucusunu yeniden başlatmak istediğinizden emin misiniz?',
        step2Title: 'Son onay',
        step2Body:
            'Bu işlem geri alınamaz. Sunucu ${server.nickname} kapatılıp yeniden başlatılacak.',
        accentColor: const Color(0xFFEF4444),
        icon: Icons.restart_alt_rounded,
      );
      if (!confirmed) return;

      ref.read(relayProvider.notifier).sendCommand(
            'server:reboot',
            server.serverId,
          );

      if (mounted) {
        _showToast('Yeniden başlatma komutu gönderildi', isError: false);
      }
    });
  }

  // ── Action: Docker Container Restart ──────────────────────────────────────

  Future<void> _showDockerSheet(ServerMetricsModel server) async {
    if (!mounted) return;
    final selected = await showModalBottomSheet<DockerContainerModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DockerSheet(server: server),
    );
    if (selected == null || !mounted) return;

    final key = '${server.serverId}::docker::${selected.id}';
    await _withPending(key, () async {
      final confirmed = await _twoStepConfirm(
        step1Title: 'Konteyner yeniden başlatılsın mı?',
        step1Body:
            '"${selected.name}" konteynerini yeniden başlatmak istiyor musunuz?',
        step2Title: 'Son onay',
        step2Body:
            '"${selected.name}" konteyneri durdurulup yeniden başlatılacak. Devam?',
        accentColor: const Color(0xFFF59E0B),
        icon: Icons.inventory_2_rounded,
      );
      if (!confirmed) return;

      ref.read(relayProvider.notifier).sendCommand(
            'docker:restart',
            server.serverId,
            containerId: selected.id,
          );

      if (mounted) {
        _showToast('${selected.name} yeniden başlatılıyor', isError: false);
      }
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  void _showToast(String message, {bool isError = true}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError
                  ? Icons.error_outline_rounded
                  : Icons.check_circle_outline_rounded,
              color: isError ? const Color(0xFFEF4444) : const Color(0xFF22C55E),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF1E2535),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  void _disconnect() {
    ref.read(relayProvider.notifier).disconnect();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const PairingScreen()),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final relayState = ref.watch(relayProvider);
    final metricsState = ref.watch(metricsProvider);
    final isConnected = relayState.status == RelayStatus.connected;

    // Snackbar when relay drops
    ref.listen<RelayState>(relayProvider, (prev, next) {
      if (prev?.status == RelayStatus.connected &&
          (next.status == RelayStatus.disconnected || next.status == RelayStatus.connecting) &&
          mounted) {
        _showToast('Relay bağlantısı koptu! Sunucuya tekrar bağlanılıyor...');
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFF0D0F14),
      appBar: _buildAppBar(relayState, metricsState, isConnected),
      body: _buildBody(metricsState, relayState.status),
    );
  }

  AppBar _buildAppBar(
      RelayState relayState, MetricsState metricsState, bool isConnected) {
    return AppBar(
      backgroundColor: const Color(0xFF151821),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      titleSpacing: 20,
      title: Row(
        children: [
          // Logo
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C63FF), Color(0xFF48CAE4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child:
                const Icon(Icons.dns_rounded, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'ONEServer',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (metricsState.lastUpdated != null)
                  Text(
                    '${metricsState.servers.length} sunucu',
                    style: const TextStyle(
                      color: Color(0xFF8B9CAF),
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        // Connection indicator dot
        _ConnectionIndicator(
          status: relayState.status,
          lastUpdated: metricsState.lastUpdated,
        ),
        const SizedBox(width: 8),
        // Disconnect
        IconButton(
          icon: const Icon(Icons.logout_rounded,
              color: Color(0xFF8B9CAF), size: 20),
          onPressed: _disconnect,
          tooltip: 'Bağlantıyı kes',
        ),
        const SizedBox(width: 4),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: const Color(0xFF1E2535)),
      ),
    );
  }

  Widget _buildBody(MetricsState metricsState, RelayStatus relayStatus) {
    final isConnected = relayStatus == RelayStatus.connected;
    final isConnecting = relayStatus == RelayStatus.connecting;

    if (metricsState.isLoading && metricsState.servers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              color: Color(0xFF6C63FF),
              strokeWidth: 2.5,
            ),
            const SizedBox(height: 20),
            Text(
              isConnecting ? 'Yeniden bağlanılıyor...' : 'Metrikler bekleniyor...',
              style: const TextStyle(color: Color(0xFF8B9CAF), fontSize: 15),
            ),
            const SizedBox(height: 8),
            Text(
              isConnecting
                  ? 'Relay sunucusuna bağlantı kuruluyor'
                  : 'Desktop\'tan veri gönderildiğinde burada görünecek',
              style: const TextStyle(color: Color(0xFF3A4560), fontSize: 12),
            ),
          ],
        ),
      );
    }

    if (metricsState.servers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_rounded,
                size: 64, color: Color(0xFF1E2535)),
            const SizedBox(height: 16),
            const Text(
              'Henüz sunucu verisi yok',
              style: TextStyle(color: Color(0xFF8B9CAF), fontSize: 15),
            ),
            if (!isConnected) ...[
              const SizedBox(height: 8),
              const Text(
                'Relay bağlantısı kurulamadı',
                style: TextStyle(color: Color(0xFF3A4560), fontSize: 12),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF6C63FF),
      backgroundColor: const Color(0xFF151821),
      onRefresh: () async {
        // Metrics are pushed by desktop; pull-to-refresh just gives visual feedback
        await Future.delayed(const Duration(milliseconds: 800));
      },
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: metricsState.servers.length,
        itemBuilder: (_, i) {
          final server = metricsState.servers[i];
          final rebootKey = '${server.serverId}::reboot';
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _ServerCard(
              server: server,
              isRelayConnected: isConnected,
              isRebootPending: _isPending(rebootKey),
              isDockerPending: _pending.any(
                  (k) => k.startsWith('${server.serverId}::docker::')),
              onReboot: () => _rebootServer(server),
              onDockerRestart: () => _showDockerSheet(server),
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection indicator in AppBar
// ─────────────────────────────────────────────────────────────────────────────

class _ConnectionIndicator extends StatefulWidget {
  const _ConnectionIndicator({required this.status, this.lastUpdated});
  final RelayStatus status;
  final DateTime? lastUpdated;

  @override
  State<_ConnectionIndicator> createState() => _ConnectionIndicatorState();
}

class _ConnectionIndicatorState extends State<_ConnectionIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.3, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = switch (widget.status) {
      RelayStatus.connected => const Color(0xFF22C55E),
      RelayStatus.connecting => const Color(0xFF3B82F6),
      RelayStatus.disconnected => const Color(0xFFEF4444),
    };
    final label = switch (widget.status) {
      RelayStatus.connected => 'Bağlı',
      RelayStatus.connecting => 'Bağlanıyor',
      RelayStatus.disconnected => 'Bağlantı Yok',
    };

    return AnimatedBuilder(
      animation: _pulse,
      builder: (_, __) {
        final animate = widget.status == RelayStatus.connected ||
            widget.status == RelayStatus.connecting;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withValues(
                      alpha: animate ? _pulse.value : 1.0),
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.5),
                      blurRadius: animate ? 6 * _pulse.value : 0,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Card
// ─────────────────────────────────────────────────────────────────────────────

class _ServerCard extends StatelessWidget {
  const _ServerCard({
    required this.server,
    required this.isRelayConnected,
    required this.isRebootPending,
    required this.isDockerPending,
    required this.onReboot,
    required this.onDockerRestart,
  });

  final ServerMetricsModel server;
  final bool isRelayConnected;
  final bool isRebootPending;
  final bool isDockerPending;
  final VoidCallback onReboot;
  final VoidCallback onDockerRestart;

  // Derived properties
  bool get _canAct => isRelayConnected && server.isOnline;

  Color get _statusColor => switch (server.status) {
        'online' => const Color(0xFF22C55E),
        'warning' => const Color(0xFFFACC15),
        'connecting' => const Color(0xFF3B82F6),
        _ => const Color(0xFFEF4444),
      };

  String get _statusLabel => switch (server.status) {
        'online' => 'Çevrimiçi',
        'warning' => 'Uyarı',
        'connecting' => 'Bağlanıyor',
        _ => 'Çevrimdışı',
      };

  @override
  Widget build(BuildContext context) {
    final isOffline = !server.isOnline;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF151821),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isOffline
              ? const Color(0xFFEF4444).withValues(alpha: 0.2)
              : const Color(0xFF1E2535),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ───────────────────────────────────────────────────────
          _buildHeader(),
          // ── Divider ──────────────────────────────────────────────────────
          const Divider(height: 1, color: Color(0xFF1E2535)),
          // ── Body: metrics OR offline banner ──────────────────────────────
          if (isOffline)
            _buildOfflineBanner()
          else
            _buildMetrics(),
          // ── Footer: action buttons ────────────────────────────────────
          const Divider(height: 1, color: Color(0xFF1E2535)),
          _buildActions(),
        ],
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Row(
        children: [
          // Server avatar icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
              border:
                  Border.all(color: _statusColor.withValues(alpha: 0.3)),
            ),
            child: Icon(Icons.computer_rounded,
                color: _statusColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  server.nickname,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.circle_rounded,
                        size: 6, color: Color(0xFF3A4560)),
                    const SizedBox(width: 5),
                    Text(
                      server.ip,
                      style: const TextStyle(
                          color: Color(0xFF8B9CAF), fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Status badge
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border:
                  Border.all(color: _statusColor.withValues(alpha: 0.35)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _statusColor,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  _statusLabel,
                  style: TextStyle(
                    color: _statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Offline banner ────────────────────────────────────────────────────────

  Widget _buildOfflineBanner() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFEF4444).withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFFEF4444).withValues(alpha: 0.2)),
        ),
        child: const Column(
          children: [
            Icon(Icons.wifi_off_rounded,
                color: Color(0xFFEF4444), size: 28),
            SizedBox(height: 6),
            Text(
              'Sunucu Offline',
              style: TextStyle(
                color: Color(0xFFEF4444),
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: 2),
            Text(
              'SSH bağlantısı kurulamıyor',
              style: TextStyle(
                  color: Color(0xFF8B9CAF), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  Widget _buildMetrics() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        children: [
          _MetricRow(label: 'CPU', value: server.cpuPercent),
          const SizedBox(height: 10),
          _MetricRow(label: 'RAM', value: server.ramPercent),
          const SizedBox(height: 10),
          _MetricRow(label: 'Disk', value: server.diskPercent),
          const SizedBox(height: 14),
          // Meta row: docker count + last update
          Row(
            children: [
              const Icon(Icons.inventory_2_rounded,
                  color: Color(0xFF8B9CAF), size: 14),
              const SizedBox(width: 5),
              Text(
                '${server.dockerCount} konteyner',
                style: const TextStyle(
                    color: Color(0xFF8B9CAF), fontSize: 12),
              ),
              const Spacer(),
              const Icon(Icons.access_time_rounded,
                  color: Color(0xFF3A4560), size: 12),
              const SizedBox(width: 4),
              Text(
                _relativeTime(server.collectedAt),
                style: const TextStyle(
                    color: Color(0xFF3A4560), fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Action buttons ────────────────────────────────────────────────────────

  Widget _buildActions() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Row(
        children: [
          // Docker restart
          Expanded(
            child: _ActionButton(
              label: 'Docker',
              icon: Icons.inventory_2_rounded,
              color: const Color(0xFFF59E0B),
              loading: isDockerPending,
              enabled: _canAct && server.dockerCount > 0,
              onTap: onDockerRestart,
            ),
          ),
          const SizedBox(width: 8),
          // Server reboot
          Expanded(
            child: _ActionButton(
              label: 'Yeniden Başlat',
              icon: Icons.restart_alt_rounded,
              color: const Color(0xFFEF4444),
              loading: isRebootPending,
              enabled: _canAct,
              onTap: onReboot,
            ),
          ),
        ],
      ),
    );
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 5) return 'az önce';
    if (diff.inSeconds < 60) return '${diff.inSeconds}s önce';
    if (diff.inMinutes < 60) return '${diff.inMinutes}dk önce';
    return '${diff.inHours}sa önce';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric row with progress bar
// ─────────────────────────────────────────────────────────────────────────────

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.label, required this.value});
  final String label;
  final double value;

  Color get _color {
    if (value >= 85) return const Color(0xFFEF4444);
    if (value >= 65) return const Color(0xFFFACC15);
    return const Color(0xFF22C55E);
  }

  @override
  Widget build(BuildContext context) {
    final clamped = (value / 100).clamp(0.0, 1.0);
    return Row(
      children: [
        SizedBox(
          width: 32,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF8B9CAF),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: Stack(
            children: [
              Container(
                height: 7,
                decoration: BoxDecoration(
                  color: const Color(0xFF1E2535),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              FractionallySizedBox(
                widthFactor: clamped,
                child: Container(
                  height: 7,
                  decoration: BoxDecoration(
                    color: _color,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: [
                      BoxShadow(
                        color: _color.withValues(alpha: 0.4),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 38,
          child: Text(
            '${value.toStringAsFixed(1)}%',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: _color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action button (card footer)
// ─────────────────────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.loading = false,
    this.enabled = true,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = enabled ? color : const Color(0xFF3A4560);

    return GestureDetector(
      onTap: (enabled && !loading) ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: enabled
              ? effectiveColor.withValues(alpha: loading ? 0.06 : 0.1)
              : const Color(0xFF151821),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: effectiveColor.withValues(alpha: enabled ? 0.3 : 0.15),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(
                width: 13,
                height: 13,
                child: CircularProgressIndicator(
                    color: effectiveColor, strokeWidth: 2),
              )
            else
              Icon(icon, color: effectiveColor, size: 15),
            const SizedBox(width: 6),
            Text(
              loading ? 'Bekleniyor...' : label,
              style: TextStyle(
                color: loading
                    ? effectiveColor.withValues(alpha: 0.6)
                    : effectiveColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Docker container bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _DockerSheet extends StatelessWidget {
  const _DockerSheet({required this.server});
  final ServerMetricsModel server;

  @override
  Widget build(BuildContext context) {
    final containers = server.containers;
    // Fallback: if containers list is empty but dockerCount > 0,
    // generate placeholder entries so user can still send a command.
    final items = containers.isNotEmpty
        ? containers
        : List.generate(
            server.dockerCount,
            (i) => DockerContainerModel(
              id: 'container-$i',
              name: 'Konteyner ${i + 1}',
              image: '—',
              state: 'unknown',
              status: '',
            ),
          );

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.85,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF151821),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: Color(0xFF1E2535))),
        ),
        child: Column(
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 4),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF2A3550),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Sheet header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_rounded,
                        color: Color(0xFFF59E0B), size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          server.nickname,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${items.length} konteyner — yeniden başlatılacak olanı seçin',
                          style: const TextStyle(
                              color: Color(0xFF8B9CAF), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded,
                        color: Color(0xFF8B9CAF), size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFF1E2535)),
            // Container list
            Expanded(
              child: ListView.separated(
                controller: scrollCtrl,
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (_, i) {
                  final c = items[i];
                  return _ContainerTile(
                    container: c,
                    onTap: () => Navigator.pop(context, c),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container tile in the docker sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ContainerTile extends StatelessWidget {
  const _ContainerTile({required this.container, required this.onTap});
  final DockerContainerModel container;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isRunning = container.isRunning;
    final stateColor =
        isRunning ? const Color(0xFF22C55E) : const Color(0xFF8B9CAF);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0D0F14),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1E2535)),
        ),
        child: Row(
          children: [
            // State dot
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: stateColor,
                boxShadow: isRunning
                    ? [
                        BoxShadow(
                          color: stateColor.withValues(alpha: 0.5),
                          blurRadius: 6,
                        )
                      ]
                    : null,
              ),
            ),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    container.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (container.image.isNotEmpty &&
                      container.image != '—') ...[
                    const SizedBox(height: 2),
                    Text(
                      container.image,
                      style: const TextStyle(
                          color: Color(0xFF8B9CAF), fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (container.status.isNotEmpty) ...[
                    const SizedBox(height: 1),
                    Text(
                      container.status,
                      style: const TextStyle(
                          color: Color(0xFF3A4560), fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            // Restart icon
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.restart_alt_rounded,
                  color: Color(0xFFF59E0B), size: 16),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2-step confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

class _ConfirmDialog extends StatelessWidget {
  const _ConfirmDialog({
    required this.title,
    required this.body,
    required this.confirmLabel,
    required this.accentColor,
    required this.icon,
    this.isFinal = false,
  });

  final String title;
  final String body;
  final String confirmLabel;
  final Color accentColor;
  final IconData icon;
  final bool isFinal;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1A1F2E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      contentPadding: EdgeInsets.zero,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 24),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.08),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(
                  bottom:
                      BorderSide(color: accentColor.withValues(alpha: 0.15))),
            ),
            child: Column(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: accentColor.withValues(alpha: 0.4), width: 1.5),
                  ),
                  child: Icon(icon, color: accentColor, size: 26),
                ),
                if (isFinal) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '⚠️  Geri alınamaz',
                      style: TextStyle(
                        color: accentColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  style: const TextStyle(
                    color: Color(0xFF8B9CAF),
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          // Actions
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF8B9CAF),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(11),
                        side: const BorderSide(color: Color(0xFF1E2535)),
                      ),
                    ),
                    child: const Text('VAZGEÇ',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(11)),
                    ),
                    child: Text(
                      confirmLabel,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

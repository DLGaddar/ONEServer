import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../providers/relay_provider.dart';
import 'dashboard_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// PairingScreen – two-tab approach: QR scan | Manual entry
// ─────────────────────────────────────────────────────────────────────────────

class PairingScreen extends ConsumerStatefulWidget {
  const PairingScreen({super.key});

  @override
  ConsumerState<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends ConsumerState<PairingScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Called from either tab after parsing code + url.
  Future<void> _handlePair(String pairingCode, String relayUrl) async {
    final code = pairingCode.trim().toUpperCase();
    final url = relayUrl.trim();
    if (code.isEmpty || url.isEmpty) return;
    await ref.read(relayProvider.notifier).connect(url, code);
    // Navigation happens reactively via ref.listen in build()
  }

  @override
  Widget build(BuildContext context) {
    // Reactive navigation to dashboard on successful connection
    ref.listen<RelayState>(relayProvider, (prev, next) {
      if (next.status == RelayStatus.connected && mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      }
    });

    final relayState = ref.watch(relayProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D0F14),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabBar(),
            if (relayState.status == RelayStatus.connecting)
              _buildConnectingBanner(),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _QrTab(onPair: _handlePair),
                  _ManualTab(
                    onPair: _handlePair,
                    isConnecting:
                        relayState.status == RelayStatus.connecting,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Logo + title ────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C63FF), Color(0xFF48CAE4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(13),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x556C63FF),
                  blurRadius: 16,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.dns_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 14),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ONEServer',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              Text(
                'Cihaz eşleştirme',
                style: TextStyle(color: Color(0xFF8B9CAF), fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Custom tab bar ──────────────────────────────────────────────────────────
  Widget _buildTabBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: const Color(0xFF151821),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1E2535)),
        ),
        child: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF8B9CAF),
          labelStyle: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(
              fontSize: 14, fontWeight: FontWeight.w500),
          indicator: BoxDecoration(
            color: const Color(0xFF6C63FF),
            borderRadius: BorderRadius.circular(9),
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          indicatorPadding: const EdgeInsets.all(4),
          dividerColor: Colors.transparent,
          splashBorderRadius: BorderRadius.circular(9),
          tabs: const [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner_rounded, size: 17),
                  SizedBox(width: 7),
                  Text('QR Tara'),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.keyboard_rounded, size: 17),
                  SizedBox(width: 7),
                  Text('Manuel'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectingBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              color: Color(0xFF3B82F6),
              strokeWidth: 2,
            ),
          ),
          SizedBox(width: 10),
          Text(
            'Relay sunucusuna bağlanıyor...',
            style: TextStyle(
              color: Color(0xFF3B82F6),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — QR Scanner
// ─────────────────────────────────────────────────────────────────────────────

class _QrTab extends StatefulWidget {
  const _QrTab({required this.onPair});
  final Future<void> Function(String pairingCode, String relayUrl) onPair;

  @override
  State<_QrTab> createState() => _QrTabState();
}

class _QrTabState extends State<_QrTab> {
  final MobileScannerController _controller = MobileScannerController();
  bool _scanned = false;
  bool _torchOn = false;
  String? _errorMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Parses QR data. Supports two formats:
  /// 1. JSON: {"pairingCode":"ABCD-1234","relayUrl":"ws://..."}
  /// 2. Plain: "ABCD-1234|ws://..."
  (String, String)? _parseQrData(String raw) {
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final code = json['pairingCode'] as String?;
      final url = json['relayUrl'] as String?;
      if (code != null && url != null && code.isNotEmpty && url.isNotEmpty) {
        return (code, url);
      }
    } catch (_) {}

    // Fallback: pipe-separated
    final parts = raw.split('|');
    if (parts.length == 2 &&
        parts[0].isNotEmpty &&
        (parts[1].startsWith('ws://') || parts[1].startsWith('wss://'))) {
      return (parts[0].trim(), parts[1].trim());
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 16),
          // ── Camera view ───────────────────────────────────────────────────
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Stack(
                children: [
                  MobileScanner(
                    controller: _controller,
                    onDetect: (capture) async {
                      if (_scanned) return;
                      final List<Barcode> barcodes = capture.barcodes;
                      if (barcodes.isEmpty) return;

                      final raw = barcodes.first.rawValue;
                      if (raw == null || raw.isEmpty) return;

                      debugPrint('QR bulundu: $raw');
                      _scanned = true;

                      final parsed = _parseQrData(raw);
                      if (parsed == null) {
                        if (mounted) {
                          setState(() {
                            _errorMessage = 'Geçersiz QR kodu. ONEServer QR kodu tarayın.';
                            _scanned = false;
                          });
                        }
                        return;
                      }

                      final (code, url) = parsed;
                      await widget.onPair(code, url);

                      if (mounted) {
                        // If pair fails, allow re-scan
                        setState(() => _scanned = false);
                      }
                    },
                  ),
                  // Torch toggle
                  Positioned(
                    bottom: 20,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: GestureDetector(
                        onTap: () async {
                          await _controller.toggleTorch();
                          setState(() => _torchOn = !_torchOn);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF151821).withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(
                                color: const Color(0xFF1E2535)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _torchOn
                                    ? Icons.flashlight_on_rounded
                                    : Icons.flashlight_off_rounded,
                                color: _torchOn
                                    ? const Color(0xFFFACC15)
                                    : const Color(0xFF8B9CAF),
                                size: 18,
                              ),
                              const SizedBox(width: 7),
                              Text(
                                _torchOn ? 'Işık Açık' : 'Işık Kapalı',
                                style: TextStyle(
                                  color: _torchOn
                                      ? const Color(0xFFFACC15)
                                      : const Color(0xFF8B9CAF),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Instructions / error ──────────────────────────────────────────
          if (_errorMessage != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(0xFFEF4444), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Color(0xFFEF4444),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFF8B9CAF), size: 16),
                const SizedBox(width: 8),
                Text(
                  'Desktop uygulamasındaki QR kodu tarayın',
                  style: TextStyle(
                    color: const Color(0xFF8B9CAF).withValues(alpha: 0.8),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — Manual entry
// ─────────────────────────────────────────────────────────────────────────────

class _ManualTab extends StatefulWidget {
  const _ManualTab({required this.onPair, required this.isConnecting});
  final Future<void> Function(String pairingCode, String relayUrl) onPair;
  final bool isConnecting;

  @override
  State<_ManualTab> createState() => _ManualTabState();
}

class _ManualTabState extends State<_ManualTab> {
  final _formKey = GlobalKey<FormState>();
  final _codeCtrl = TextEditingController();
  final _urlCtrl = TextEditingController(text: 'ws://192.168.1.100:8080');

  @override
  void dispose() {
    _codeCtrl.dispose();
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await widget.onPair(_codeCtrl.text.trim(), _urlCtrl.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Pairing code ────────────────────────────────────────────────
            const _FieldLabel(label: 'Pairing Kodu'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _codeCtrl,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]')),
                _PairingCodeFormatter(),
              ],
              textCapitalization: TextCapitalization.characters,
              maxLength: 9,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w700,
                letterSpacing: 5,
              ),
              decoration: _codeDecoration(),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Pairing kodu gerekli';
                if (v.replaceAll('-', '').length != 8) {
                  return 'Format: XXXX-XXXX (8 karakter)';
                }
                return null;
              },
            ),
            const SizedBox(height: 20),

            // ── Relay URL ───────────────────────────────────────────────────
            const _FieldLabel(label: 'Relay URL'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _urlCtrl,
              keyboardType: TextInputType.url,
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: _urlDecoration(),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'URL gerekli';
                final t = v.trim();
                if (!t.startsWith('ws://') && !t.startsWith('wss://')) {
                  return 'ws:// veya wss:// ile başlamalı';
                }
                return null;
              },
            ),
            const SizedBox(height: 32),

            // ── Connect button ──────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: widget.isConnecting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  disabledBackgroundColor: const Color(0xFF2D2B55),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: widget.isConnecting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.link_rounded,
                              color: Colors.white, size: 20),
                          SizedBox(width: 9),
                          Text(
                            'Bağlan',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Hint card ───────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF151821),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1E2535)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.lightbulb_outline_rounded,
                      color: Color(0xFF6C63FF), size: 17),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Desktop uygulamasında "Pair Device" butonuna basarak '
                      'pairing kodunu ve relay URL\'ini öğrenebilirsiniz.',
                      style: TextStyle(
                        color: Color(0xFF8B9CAF),
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _codeDecoration() {
    return InputDecoration(
      hintText: 'XXXX-XXXX',
      hintStyle: const TextStyle(
        color: Color(0xFF2A3550),
        fontSize: 24,
        fontWeight: FontWeight.w700,
        letterSpacing: 5,
      ),
      counterText: '',
      filled: true,
      fillColor: const Color(0xFF0D0F14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: _border(const Color(0xFF1E2535)),
      enabledBorder: _border(const Color(0xFF1E2535)),
      focusedBorder: _border(const Color(0xFF6C63FF), width: 1.5),
      errorBorder: _border(const Color(0xFFEF4444)),
      focusedErrorBorder: _border(const Color(0xFFEF4444), width: 1.5),
      errorStyle: const TextStyle(color: Color(0xFFEF4444)),
    );
  }

  InputDecoration _urlDecoration() {
    return InputDecoration(
      hintText: 'ws://192.168.1.100:8080',
      hintStyle: const TextStyle(color: Color(0xFF2A3550), fontSize: 15),
      filled: true,
      fillColor: const Color(0xFF0D0F14),
      prefixIcon: const Padding(
        padding: EdgeInsets.only(left: 14, right: 10),
        child: Icon(Icons.cable_rounded, color: Color(0xFF8B9CAF), size: 18),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: _border(const Color(0xFF1E2535)),
      enabledBorder: _border(const Color(0xFF1E2535)),
      focusedBorder: _border(const Color(0xFF6C63FF), width: 1.5),
      errorBorder: _border(const Color(0xFFEF4444)),
      focusedErrorBorder: _border(const Color(0xFFEF4444), width: 1.5),
      errorStyle: const TextStyle(color: Color(0xFFEF4444)),
    );
  }

  OutlineInputBorder _border(Color color, {double width = 1.0}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color, width: width),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        color: Color(0xFF8B9CAF),
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
      ),
    );
  }
}

// XXXX-XXXX formatter – inserts dash automatically at position 4
class _PairingCodeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final raw = newValue.text.replaceAll('-', '').toUpperCase();
    if (raw.length > 8) return oldValue;
    final buf = StringBuffer();
    for (int i = 0; i < raw.length; i++) {
      if (i == 4) buf.write('-');
      buf.write(raw[i]);
    }
    final formatted = buf.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

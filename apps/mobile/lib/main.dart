import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/relay_provider.dart';
import 'screens/pairing_screen.dart';
import 'screens/dashboard_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF0D0F14),
  ));
  runApp(const ProviderScope(child: ONEServerApp()));
}

class ONEServerApp extends StatelessWidget {
  const ONEServerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ONEServer',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      home: const _AppRoot(),
    );
  }

  ThemeData _buildTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF0D0F14),
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF6C63FF),
        brightness: Brightness.dark,
        surface: const Color(0xFF151821),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App root: checks secure storage on startup and auto-connects if session exists.
// Shows a splash while checking, then routes to PairingScreen or DashboardScreen.
// ─────────────────────────────────────────────────────────────────────────────

class _AppRoot extends ConsumerStatefulWidget {
  const _AppRoot();

  @override
  ConsumerState<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends ConsumerState<_AppRoot> with WidgetsBindingObserver {
  /// true while we're reading SecureStorage
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(relayProvider.notifier).reconnect();
    }
  }

  /// Reads stored credentials and triggers reconnect if present.
  Future<void> _restoreSession() async {
    final storage = ref.read(secureStorageProvider);
    final code = await storage.getPairingCode();
    final url = await storage.getRelayUrl();

    if (code != null && url != null && mounted) {
      // Fire connection — navigation happens reactively via RelayState listener
      await ref.read(relayProvider.notifier).connect(url, code);
    }

    if (mounted) setState(() => _checking = false);
  }

  @override
  Widget build(BuildContext context) {
    // Splash while checking storage
    if (_checking) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D0F14),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(0xFF6C63FF),
            strokeWidth: 2.5,
          ),
        ),
      );
    }

    final relayState = ref.watch(relayProvider);

    if (relayState.pairingCode != null) {
      return const DashboardScreen();
    }
    return const PairingScreen();
  }
}

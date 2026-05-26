import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wraps FlutterSecureStorage for persistent, encrypted pairing session storage.
class SecureStorageService {
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyPairingCode = 'pairing_code';
  static const _keyRelayUrl = 'relay_url';

  /// Saves the pairing code persistently in secure keychain.
  Future<void> savePairingCode(String code) async {
    await _storage.write(key: _keyPairingCode, value: code.trim());
  }

  /// Saves the relay URL persistently in secure keychain.
  Future<void> saveRelayUrl(String url) async {
    await _storage.write(key: _keyRelayUrl, value: url.trim());
  }

  /// Fetches the pairing code from secure storage.
  Future<String?> getPairingCode() async {
    return _storage.read(key: _keyPairingCode);
  }

  /// Fetches the relay URL from secure storage.
  Future<String?> getRelayUrl() async {
    return _storage.read(key: _keyRelayUrl);
  }

  /// Clears the entire pairing session from storage.
  Future<void> clearAll() async {
    await _storage.delete(key: _keyPairingCode);
    await _storage.delete(key: _keyRelayUrl);
  }
}

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/crypto_service.dart';

void main() {
  group('CryptoService', () {
    const testPairingCode = 'ABCD-1234';

    test('deriveKey returns 32-byte AES-256 key', () {
      final key = CryptoService.deriveKey(testPairingCode);
      expect(key, isA<Uint8List>());
      expect(key.length, equals(32));
    });

    test('deriveKey is deterministic for same input', () {
      final key1 = CryptoService.deriveKey(testPairingCode);
      final key2 = CryptoService.deriveKey(testPairingCode);
      expect(key1, equals(key2));
    });

    test('deriveKey produces different keys for different codes', () {
      final key1 = CryptoService.deriveKey('AAAA-0000');
      final key2 = CryptoService.deriveKey('BBBB-1111');
      expect(key1, isNot(equals(key2)));
    });

    test('encrypt returns non-empty iv, ciphertext, tag', () {
      final key = CryptoService.deriveKey(testPairingCode);
      final plaintext = jsonEncode({'action': 'server:reboot', 'serverId': 'srv-1'});
      final result = CryptoService.encrypt(plaintext, key);

      expect(result['iv'], isNotEmpty);
      expect(result['ciphertext'], isNotEmpty);
      expect(result['tag'], isNotEmpty);
      // IV must be 12 bytes = 24 hex chars
      expect(result['iv']!.length, equals(24));
      // Tag must be 16 bytes = 32 hex chars
      expect(result['tag']!.length, equals(32));
    });

    test('encrypt produces different ciphertexts for same plaintext (random IV)', () {
      final key = CryptoService.deriveKey(testPairingCode);
      const plaintext = 'hello world';
      final r1 = CryptoService.encrypt(plaintext, key);
      final r2 = CryptoService.encrypt(plaintext, key);
      // IVs should differ (random)
      expect(r1['iv'], isNot(equals(r2['iv'])));
    });

    test('decrypt recovers original plaintext after encrypt', () {
      final key = CryptoService.deriveKey(testPairingCode);
      const original = 'ONEServer relay test message 🚀';
      final encrypted = CryptoService.encrypt(original, key);
      final decrypted = CryptoService.decrypt(
        encrypted['iv']!,
        encrypted['ciphertext']!,
        encrypted['tag']!,
        key,
      );
      expect(decrypted, equals(original));
    });

    test('decrypt recovers JSON payload correctly', () {
      final key = CryptoService.deriveKey(testPairingCode);
      final payload = jsonEncode({
        'action': 'docker:restart',
        'serverId': 'srv-42',
        'containerId': 'container-abc',
      });
      final encrypted = CryptoService.encrypt(payload, key);
      final decrypted = CryptoService.decrypt(
        encrypted['iv']!,
        encrypted['ciphertext']!,
        encrypted['tag']!,
        key,
      );
      final decoded = jsonDecode(decrypted) as Map<String, dynamic>;
      expect(decoded['action'], equals('docker:restart'));
      expect(decoded['serverId'], equals('srv-42'));
      expect(decoded['containerId'], equals('container-abc'));
    });

    test('hexEncode and hexDecode are inverse operations', () {
      final original = Uint8List.fromList([0, 15, 16, 255, 128, 64]);
      final hex = CryptoService.hexEncode(original);
      final decoded = CryptoService.hexDecode(hex);
      expect(decoded, equals(original));
    });

    test('decrypt throws on tampered ciphertext (GCM authentication)', () {
      final key = CryptoService.deriveKey(testPairingCode);
      final encrypted = CryptoService.encrypt('sensitive data', key);

      // Tamper the ciphertext (flip one byte)
      final ciphertext = encrypted['ciphertext']!;
      final tampered = '${ciphertext.substring(0, ciphertext.length - 2)}ff';

      expect(
        () => CryptoService.decrypt(encrypted['iv']!, tampered, encrypted['tag']!, key),
        throwsA(anything),
      );
    });
  });
}

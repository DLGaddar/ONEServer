import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:pointycastle/export.dart';

class CryptoService {
  /// Derives a 256-bit AES key from the pairing code using PBKDF2 with 100k iterations and a static salt.
  static Uint8List deriveKey(String pairingCode) {
    final salt = utf8.encode('oneserver-pairing-salt');
    final pkcs = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64));
    pkcs.init(Pbkdf2Parameters(Uint8List.fromList(salt), 100000, 32));
    return pkcs.process(Uint8List.fromList(utf8.encode(pairingCode)));
  }

  /// Encrypts plaintext using AES-256-GCM. Returns hex-encoded iv, ciphertext, and tag.
  static Map<String, String> encrypt(String plaintext, Uint8List key) {
    // Generate cryptographically secure random 12-byte IV
    final rand = Random.secure();
    final iv = Uint8List(12);
    for (var i = 0; i < 12; i++) {
      iv[i] = rand.nextInt(256);
    }

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(true, params); // true for encryption

    final input = Uint8List.fromList(utf8.encode(plaintext));
    final ciphertextWithTag = cipher.process(input);

    // GCM authentication tag is the last 16 bytes (128 bits)
    final ciphertext = ciphertextWithTag.sublist(0, ciphertextWithTag.length - 16);
    final tag = ciphertextWithTag.sublist(ciphertextWithTag.length - 16);

    return {
      'iv': hexEncode(iv),
      'ciphertext': hexEncode(ciphertext),
      'tag': hexEncode(tag),
    };
  }

  /// Decrypts hex-encoded AES-256-GCM data.
  static String decrypt(String ivHex, String ciphertextHex, String tagHex, Uint8List key) {
    final iv = hexDecode(ivHex);
    final ciphertext = hexDecode(ciphertextHex);
    final tag = hexDecode(tagHex);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(false, params); // false for decryption

    final input = Uint8List.fromList([...ciphertext, ...tag]);
    final decrypted = cipher.process(input);
    return utf8.decode(decrypted);
  }

  // --- HEX UTILITIES ---

  static String hexEncode(Uint8List bytes) {
    return bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  }

  static Uint8List hexDecode(String hex) {
    final bytes = Uint8List(hex.length ~/ 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return bytes;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DockerContainerModel
// ─────────────────────────────────────────────────────────────────────────────

class DockerContainerModel {
  final String id;
  final String name;
  final String image;
  final String state; // running | exited | paused | restarting | ...
  final String status; // "Up 3 hours", "Exited (0) 2 minutes ago", ...

  const DockerContainerModel({
    required this.id,
    required this.name,
    required this.image,
    required this.state,
    required this.status,
  });

  bool get isRunning => state == 'running';

  factory DockerContainerModel.fromJson(Map<String, dynamic> json) {
    return DockerContainerModel(
      id: (json['id'] ?? json['Id'] ?? '').toString(),
      name: (json['name'] ?? json['Name'] ?? 'unknown')
          .toString()
          .replaceAll(RegExp(r'^/'), ''), // strip leading slash
      image: (json['image'] ?? json['Image'] ?? '').toString(),
      state: (json['state'] ?? json['State'] ?? 'unknown').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ServerMetricsModel
// ─────────────────────────────────────────────────────────────────────────────

class ServerMetricsModel {
  final String serverId;
  final String nickname;
  final String ip;
  final String status; // online | offline | warning | connecting
  final double cpuPercent;
  final double ramPercent;
  final double diskPercent;
  final int dockerCount;
  final List<DockerContainerModel> containers;
  final DateTime collectedAt;

  const ServerMetricsModel({
    required this.serverId,
    required this.nickname,
    required this.ip,
    required this.status,
    required this.cpuPercent,
    required this.ramPercent,
    required this.diskPercent,
    required this.dockerCount,
    required this.containers,
    required this.collectedAt,
  });

  bool get isOnline => status == 'online' || status == 'warning';

  factory ServerMetricsModel.fromJson(Map<String, dynamic> json) {
    final cpuJson = json['cpu'] as Map<String, dynamic>?;
    final ramJson = json['ram'] as Map<String, dynamic>?;
    final diskJson = json['disk'] as Map<String, dynamic>?;

    final rawContainers = json['containers'];
    final containers = rawContainers is List
        ? rawContainers
            .whereType<Map<String, dynamic>>()
            .map(DockerContainerModel.fromJson)
            .toList()
        : <DockerContainerModel>[];

    return ServerMetricsModel(
      serverId: (json['serverId'] ?? '').toString(),
      nickname: (json['nickname'] ?? '').toString(),
      ip: (json['ip'] ?? '').toString(),
      status: (json['status'] ?? 'offline').toString(),
      cpuPercent: ((cpuJson?['percent'] ?? 0.0) as num).toDouble(),
      ramPercent: ((ramJson?['percent'] ?? 0.0) as num).toDouble(),
      diskPercent: ((diskJson?['percent'] ?? 0.0) as num).toDouble(),
      dockerCount: (json['dockerCount'] ?? containers.length) as int,
      containers: containers,
      collectedAt: json['collectedAt'] != null
          ? DateTime.tryParse(json['collectedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

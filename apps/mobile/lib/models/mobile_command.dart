class MobileCommand {
  final String action;
  final String serverId;
  final String? containerId;

  MobileCommand({
    required this.action,
    required this.serverId,
    this.containerId,
  });

  Map<String, dynamic> toJson() => {
        'action': action,
        'serverId': serverId,
        if (containerId != null) 'containerId': containerId,
      };

  factory MobileCommand.fromJson(Map<String, dynamic> json) {
    return MobileCommand(
      action: json['action'] as String,
      serverId: json['serverId'] as String,
      containerId: json['containerId'] as String?,
    );
  }
}

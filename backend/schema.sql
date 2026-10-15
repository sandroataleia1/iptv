CREATE TABLE IF NOT EXISTS app_devices (
    device_id CHAR(36) NOT NULL PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    username VARCHAR(190) NOT NULL,
    password_encrypted TEXT NOT NULL,
    expires_on DATE NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_app_devices_expiry (expires_on),
    KEY idx_app_devices_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_device_registrations (
    device_id CHAR(36) NOT NULL PRIMARY KEY,
    app_version VARCHAR(32) NOT NULL DEFAULT '',
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_app_device_registrations_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_device_configurations (
    device_id CHAR(36) NOT NULL PRIMARY KEY,
    configuration_type VARCHAR(16) NOT NULL DEFAULT 'xtream',
    provider_url VARCHAR(2048) NOT NULL DEFAULT '',
    playlist_url_encrypted TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_device_configurations_device
        FOREIGN KEY (device_id) REFERENCES app_devices (device_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_releases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(32) NOT NULL,
    filename VARCHAR(128) NOT NULL,
    release_notes TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_app_releases_version (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_renewals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    device_id CHAR(36) NOT NULL,
    previous_expiry DATE NOT NULL,
    new_expiry DATE NOT NULL,
    amount DECIMAL(10,2) NULL,
    payment_reference VARCHAR(190) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_app_renewals_device (device_id),
    CONSTRAINT fk_app_renewals_device
        FOREIGN KEY (device_id) REFERENCES app_devices (device_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

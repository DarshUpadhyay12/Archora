export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  university: string;
  semester: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRecord, 'password_hash'>;

export interface SessionRecord {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  title: string;
  category: string;
  semester: string;
  subject: string;
  year: number;
  site_location: string;
  site_dimensions: string;
  site_area: string;
  typology: string;
  description: string;
  architectural_style: string;
  start_date: string;
  expected_completion_date: string;
  design_requirements: string;
  notes: string; // JSON string of string[]
  status: 'In Progress' | 'Completed' | 'Review Ready';
  created_at: string;
  updated_at: string;
}

export interface ProjectNoteRecord {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export type FileCategory =
  | 'Architectural Drawings'
  | 'Floor Plans'
  | 'Elevations'
  | 'Sections'
  | 'Site Analysis'
  | 'Reference Images'
  | 'Material References'
  | 'PDFs and Documents'
  | 'Other';

export interface ProjectFileRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  original_filename: string;
  storage_filename: string;
  storage_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  description: string;
  category: FileCategory | string;
  created_at: string;
  updated_at: string;
  project_title?: string | null;
  google_drive_file_id?: string | null;
  cloud_storage_status?: 'local' | 'synced' | 'cloud_only' | 'pending_upload' | 'pending_delete';
  cloud_web_view_link?: string | null;
  cloud_thumbnail_link?: string | null;
  cloud_md5_checksum?: string | null;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  project_id?: string | null;
  module: 'tutor' | 'concept' | 'portfolio';
  title: string;
  topic: string;
  created_at: string;
  updated_at: string;
  messages_count?: number;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json: string;
  follow_up_suggestions_json: string;
  token_count: number;
  created_at: string;
}

export interface SavedOutputRecord {
  id: string;
  user_id: string;
  project_id?: string | null;
  type: string;
  title: string;
  content: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRecord {
  user_id: string;
  parchment_warmth: 'soft' | 'standard' | 'deep';
  high_contrast_mode: number; // 0 or 1
  reduced_motion: number; // 0 or 1
  font_size: 'standard' | 'large';
  auto_save_interval_sec: number;
  auto_backup_enabled?: number;
  auto_backup_frequency?: 'daily' | 'weekly' | 'manual';
  auto_backup_max_retained?: number;
  auto_backup_destination?: string | null;
  auto_backup_last_run?: string | null;
  google_drive_folder_id?: string | null;
  google_drive_folder_name?: string | null;
  google_drive_folder_status?: 'unverified' | 'verified' | 'inaccessible' | 'permission_denied';
  google_drive_last_verified?: string | null;
  google_drive_last_backup?: string | null;
  updated_at: string;
}

export type ExportDocumentType =
  | 'project_report'
  | 'concept_report'
  | 'tutor_notes'
  | 'jury_prep'
  | 'portfolio'
  | 'vastu_report';

export interface ExportCustomOptions {
  title?: string;
  subtitle?: string;
  authorName?: string;
  institutionName?: string;
  date?: string;
  pageSize?: 'A4' | 'A3';
  orientation?: 'portrait' | 'landscape';
  sections?: { [key: string]: boolean };
  includeImages?: boolean;
}

export interface PdfExportRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  export_type: ExportDocumentType;
  document_title: string;
  options_json: string;
  file_path: string | null;
  page_count: number;
  created_at: string;
  project_title?: string | null;
}

export interface UsageEventRecord {
  id: string;
  user_id?: string | null;
  request_id?: string | null;
  module: string;
  tokens_used: number;
  model_name: string;
  status: 'success' | 'error' | 'rate_limited';
  prompt_tokens?: number | null;
  candidates_tokens?: number | null;
  total_tokens?: number | null;
  error_category?: string | null;
  duration_ms: number;
  input_chars: number;
  created_at: string;
}

export interface AppLimitsRecord {
  id: string;
  user_id?: string | null;
  max_requests_per_day: number;
  max_requests_per_month: number;
  max_input_chars: number;
  max_concurrent_requests: number;
  daily_warning_threshold: number;
  monthly_warning_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface BackupRecord {
  id: string;
  user_id?: string | null;
  filename: string;
  file_path: string;
  file_size_bytes: number;
  backup_version: string;
  schema_version: number;
  is_automatic: number;
  checksum_sha256?: string | null;
  file_count: number;
  created_at: string;
}

export interface BackupManifest {
  backupVersion: string;
  appVersion: string;
  createdAt: string;
  databaseSchemaVersion: number;
  databaseName: string;
  includedCategories: string[];
  fileCount: number;
  totalSizeBytes: number;
  checksums: { [relPath: string]: string };
  metadata: {
    userCount: number;
    projectCount: number;
    filesCount: number;
    conversationCount: number;
    savedOutputCount: number;
    pdfExportCount: number;
    os: string;
    nodeVersion: string;
  };
}

export interface BackupVerificationResult {
  valid: boolean;
  errors: string[];
  manifest?: BackupManifest;
  archiveSize: number;
  filename: string;
}

export interface BackupSummaryItem {
  id?: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  backupVersion: string;
  schemaVersion: number;
  isAutomatic: boolean;
  fileCount: number;
  manifest?: BackupManifest;
  integrityOk: boolean;
}

export interface GoogleOAuthTokenRecord {
  user_id: string;
  google_email: string | null;
  google_name: string | null;
  google_picture: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expiry: number | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudBackupRecord {
  id: string;
  user_id: string;
  local_backup_id: string | null;
  google_drive_file_id: string;
  google_drive_folder_id: string;
  filename: string;
  file_size_bytes: number;
  checksum_sha256: string | null;
  file_count: number;
  created_at: string;
  uploaded_at: string;
}

export interface GoogleDriveFolderInfo {
  id: string;
  name: string;
  exists: boolean;
  isFolder: boolean;
  trashed: boolean;
  canAddChildren: boolean;
  webViewLink?: string;
  error?: string;
}

export interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  googleEmail?: string | null;
  googleName?: string | null;
  googlePicture?: string | null;
  folderId: string;
  folderName?: string | null;
  folderStatus: 'unverified' | 'verified' | 'inaccessible' | 'permission_denied';
  canUpload: boolean;
  lastVerified?: string | null;
  lastBackup?: string | null;
  googlePickerApiKeyConfigured?: boolean;
}

export interface CloudBackupItem {
  id: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  uploadedAt: string;
  folderId: string;
  md5Checksum?: string;
  sha256Checksum?: string;
  webViewLink?: string;
}

export interface CloudSyncStateRecord {
  user_id: string;
  last_sync_at: string | null;
  sync_status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  snapshot_drive_file_id: string | null;
  snapshot_version: number;
  total_synced_projects: number;
  total_synced_conversations: number;
  total_synced_files: number;
  auto_sync_enabled: number;
  error_message: string | null;
  updated_at: string;
}

export interface OfflineSyncQueueRecord {
  id: string;
  user_id: string;
  action_type: 'file_upload' | 'file_delete' | 'data_sync';
  entity_id: string;
  payload_json: string;
  retry_count: number;
  status: 'pending' | 'processing' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsiteSyncSnapshot {
  version: number;
  createdAt: string;
  studioName: string;
  userEmail?: string;
  projects: any[];
  projectNotes: any[];
  conversations: any[];
  messages: any[];
  savedOutputs: any[];
  filesMetadata: any[];
  userSettings: any;
}



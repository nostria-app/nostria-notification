export interface BackupJob {
  id: string;
  type: 'backup-job'; // Document type for CosmosDB querying
  pubkey: string; // The user requesting the backup
  status: BackupJobStatus;
  backupType: BackupType;
  requested: number;
  scheduled?: number;
  started?: number;
  completed?: number;
  errorMessage?: string;
  resultUrl?: string; // URL where the backup can be downloaded (once completed)
  expires?: number; // When the backup download link expires
  metadata?: {
    originalSize?: number;
    compressedSize?: number;
    fileCount?: number;
    [key: string]: any;
  };
}

export enum BackupJobStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled', 
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  SELECTIVE = 'selective'
}

export interface CreateBackupJobRequest {
  backupType: BackupType;
  scheduled?: number; // Optional: schedule for later
  metadata?: {
    description?: string;
    [key: string]: any;
  };
}

export interface BackupJobResponse {
  id: string;
  status: BackupJobStatus;
  backupType: BackupType;
  requested: number;
  scheduled?: number;
  started?: number;
  completed?: number;
  errorMessage?: string;
  resultUrl?: string;
  expires?: number;
  metadata?: any;
}

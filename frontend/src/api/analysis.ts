import { apiClient } from './client';
import type { TaskResult, TaskStatus } from '../hooks/useTaskPolling';

export type { TaskState, TaskStatus, TaskResult } from '../hooks/useTaskPolling';

export interface BlastParams {
  sequence: string;
  evalue: number;
  db: string;
}

export interface MsaParams {
  sequence: string;
}

export interface PeptideCalcParams {
  target_mass: number;
  error_range: number;
  num_amino_acids: number;
}

export interface PrimerDesignParams {
  sequence: string;
  product_size_range: string;
  tm_opt: number;
}

export interface AntibodyAnnotationParams {
  sequence: string;
  scheme: 'imgt' | 'kabat' | 'chothia';
}

export interface SequenceAnalysisPayload {
  fasta_file?: File;
  fasta_content?: string;
}

export interface BlastResult {
  output: string;
}

export interface MsaResult {
  output: string;
}

export interface PeptideCalcResult {
  csv_content: string;
}

export interface PrimerPair {
  rank: number;
  forward: { sequence: string; tm: number; gc_percent: number; start: number; length: number };
  reverse: { sequence: string; tm: number; gc_percent: number; start: number; length: number };
  product_size: number;
}

export interface PrimerDesignResult {
  primers: PrimerPair[];
}

export interface AntibodyAnnotationResult {
  chain_type: string;
  scheme: string;
  regions: {
    FR1: string;
    CDR1: string;
    FR2: string;
    CDR2: string;
    FR3: string;
    CDR3: string;
    FR4: string;
  };
  numbering: Record<string, string>;
}

export interface SequenceAnalysisResult {
  sequences: {
    id: string;
    num_cysteines: number;
    molecular_weight: number;
  }[];
  total_summary: {
    total_isoelectric_point: number;
    total_molecular_weight: number;
    extinction_coefficient: number;
    total_sequences_count: number;
  };
}

export const analysisApi = {
  submitBlast: async (params: BlastParams): Promise<TaskStatus> => {
    const response = await apiClient.post<TaskStatus>('/analysis/blast/', params);
    return response.data;
  },

  submitMsa: async (params: MsaParams): Promise<TaskStatus> => {
    const response = await apiClient.post<TaskStatus>('/analysis/msa/', params);
    return response.data;
  },

  submitPeptideCalc: async (params: PeptideCalcParams): Promise<TaskStatus> => {
    const response = await apiClient.post<TaskStatus>('/analysis/peptide-calc/', params);
    return response.data;
  },

  submitPrimerDesign: async (params: PrimerDesignParams): Promise<TaskStatus> => {
    const response = await apiClient.post<TaskStatus>('/analysis/primer-design/', params);
    return response.data;
  },

  submitAntibodyAnnotation: async (params: AntibodyAnnotationParams): Promise<TaskStatus> => {
    const response = await apiClient.post<TaskStatus>('/analysis/antibody-annotation/', params);
    return response.data;
  },

  /** Sync inline endpoint — accepts multipart file OR JSON content. */
  runSequenceAnalysis: async (
    payload: SequenceAnalysisPayload,
  ): Promise<SequenceAnalysisResult> => {
    const formData = new FormData();
    if (payload.fasta_file) formData.append('fasta_file', payload.fasta_file);
    if (payload.fasta_content) formData.append('fasta_content', payload.fasta_content);
    const response = await apiClient.post<SequenceAnalysisResult>(
      '/analysis/sequence-analysis/',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  /** Fetch the full task record + result payload once status is SUCCESS. */
  getTaskResult: async <T>(id: string): Promise<TaskResult<T>> => {
    const response = await apiClient.get<TaskResult<T>>(`/analysis/tasks/${id}/result/`);
    return response.data;
  },
};

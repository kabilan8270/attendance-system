import { query } from '../config/db';

export interface FaceVerificationInput {
  employeeId: string; // internal UUID
  submittedDescriptor: number[]; // 128-d face-api.js descriptor from the live camera capture
  livenessScore: number; // 0-1, computed client-side (blink/head-turn challenge result)
  livenessPassed: boolean; // explicit boolean flag from the liveness challenge
}

export interface FaceVerificationResult {
  success: boolean;
  matchScore?: number; // similarity score, higher = better match (0-1)
  reason?: string;
}

const MIN_LIVENESS_SCORE = 0.6;

/**
 * Euclidean distance between two 128-d face descriptors.
 * face-api.js descriptors: distance < ~0.6 is typically considered the same person.
 */
const euclideanDistance = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
};

/** Converts a raw Euclidean distance into a 0-1 similarity score. */
const distanceToSimilarity = (distance: number): number => {
  const clamped = Math.max(0, Math.min(distance, 1.2));
  return Math.max(0, 1 - clamped / 1.2);
};

const getFaceMatchThreshold = async (): Promise<number> => {
  const result = await query(`SELECT value FROM settings WHERE key = 'face_match_threshold'`);
  if (result.rowCount === 0) return 0.55;
  return Number(result.rows[0].value);
};

/**
 * Verifies a live-captured face against the employee's stored reference descriptor.
 * Rejects the attempt outright if liveness detection failed (blocks photo/video/replay attacks),
 * regardless of how close the descriptor match is.
 */
export const verifyEmployeeFace = async (
  input: FaceVerificationInput
): Promise<FaceVerificationResult> => {
  // 1. Liveness gate — must pass before any descriptor comparison is even attempted.
  if (!input.livenessPassed || input.livenessScore < MIN_LIVENESS_SCORE) {
    return {
      success: false,
      reason: 'Liveness check failed. Please look directly at the camera and follow the on-screen prompt.',
    };
  }

  if (!Array.isArray(input.submittedDescriptor) || input.submittedDescriptor.length !== 128) {
    return { success: false, reason: 'Invalid face data captured. Please try again.' };
  }

  // 2. Load the employee's enrolled reference descriptor.
  const empResult = await query(`SELECT face_descriptor FROM employees WHERE id = $1`, [
    input.employeeId,
  ]);

  if (empResult.rowCount === 0 || !empResult.rows[0].face_descriptor) {
    return {
      success: false,
      reason: 'No face has been enrolled for this employee. Please contact admin.',
    };
  }

  const storedDescriptor: number[] = empResult.rows[0].face_descriptor;

  // 3. Compare descriptors.
  const distance = euclideanDistance(storedDescriptor, input.submittedDescriptor);
  const similarity = distanceToSimilarity(distance);
  const threshold = await getFaceMatchThreshold();

  if (similarity < threshold) {
    return {
      success: false,
      matchScore: similarity,
      reason: 'Face does not match enrolled employee record.',
    };
  }

  return { success: true, matchScore: similarity };
};

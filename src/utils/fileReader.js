/**
 * File reader utilities for image/PDF → base64 (e.g. for Gemini inlineData).
 */

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Read a File as base64 for API upload (image or PDF).
 * Rejects if file exceeds MAX_FILE_SIZE_BYTES.
 * @param {File} file
 * @returns {Promise<{ mimeType: string, data: string }>}
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new Error("파일이 너무 큽니다 (최대 20MB)"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.startsWith("data:")) {
        reject(new Error("파일을 읽을 수 없습니다"));
        return;
      }
      const match = result.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        reject(new Error("파일 형식을 인식할 수 없습니다"));
        return;
      }
      const mimeType = match[1].trim();
      const data = match[2];
      resolve({ mimeType, data });
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a random 8-character room code using uppercase letters and numbers
 * @returns A unique room code string (e.g., "A3K9M2P7")
 */
export function generateRoomCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
}

/**
 * Validates a room code format (8 uppercase alphanumeric characters)
 * @param code - The room code to validate
 * @returns True if valid, false otherwise
 */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

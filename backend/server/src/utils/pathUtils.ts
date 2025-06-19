/**
 * Safely quotes a path for shell command usage, handling spaces and special characters
 * @param path The path to quote
 * @returns The safely quoted path
 */
export function quotePath(path: string): string {
  // If path already contains quotes, strip them first to avoid double-quoting
  const cleanPath = path.replace(/^["']|["']$/g, '')
  
  // Quote the path to handle spaces and special characters
  return `"${cleanPath.replace(/"/g, '\\"')}"`
}

/**
 * Safely escapes a path component for use in file operations
 * @param pathComponent A single path component (file or folder name)
 * @returns The escaped path component
 */
export function escapePathComponent(pathComponent: string): string {
  // Replace any potentially problematic characters
  return pathComponent.replace(/[^a-zA-Z0-9._\- ]/g, '_')
} 
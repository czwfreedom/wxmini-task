export namespace FileUtils {
  export function postfix(v?: string): string {
    if (!v) return '';
    const index = v.lastIndexOf('.');
    return index >= 0 ? v.substring(index + 1).toLowerCase() : '';
  }
}

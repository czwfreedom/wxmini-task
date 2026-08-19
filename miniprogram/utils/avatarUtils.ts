export namespace AvatarUtils {
  export function randomColor(seed?: string): string {
    const colors = ['c1', 'c2', 'c3', 'c4'];
    if (!seed) return 'avatar_' + colors[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 'avatar_' + colors[Math.abs(hash) % colors.length];
  }
}

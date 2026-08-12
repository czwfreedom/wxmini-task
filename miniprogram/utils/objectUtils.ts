export namespace ObjectUtils {
  export function deleteSame(newObj: any, oldObj: any) {
    for (const k of Object.keys(newObj)) {
      const nv = newObj[k];
      const ov = oldObj[k];
      if (!nv || !ov) continue; // 如果都为空，不处理。
      if (nv === ov) delete newObj[k];
    }
  }
}

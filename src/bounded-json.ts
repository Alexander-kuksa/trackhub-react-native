/** Serialize JSON data without running getters/toJSON or traversing unbounded graphs. */
export function encodeBoundedJSON(payload: unknown): string {
  try {
    const parts: string[] = [];
    const ancestors = new Set<object>();
    let remaining = 65536;
    let nodes = 2048;
    function append(value: string) {
      if (value.length > remaining) throw new Error();
      remaining -= value.length;
      parts.push(value);
    }
    function string(value: string) {
      if (value.length > remaining) throw new Error();
      append(JSON.stringify(value));
    }
    function visit(value: unknown, depth: number): void {
      if (depth > 16 || --nodes < 0) throw new Error();
      if (value === null) {append('null'); return;}
      if (typeof value === 'string') {string(value); return;}
      if (typeof value === 'boolean') {append(value ? 'true' : 'false'); return;}
      if (typeof value === 'number' && Number.isFinite(value)) {append(String(value)); return;}
      if (typeof value !== 'object' || ancestors.has(value)) throw new Error();
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          if (value.length > nodes) throw new Error();
          append('[');
          for (let i = 0; i < value.length; i++) {
            if (i) append(',');
            const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
            if (descriptor && !('value' in descriptor)) throw new Error();
            visit(descriptor?.value === undefined ? null : descriptor.value, depth + 1);
          }
          append(']');
        } else {
          const prototype = Object.getPrototypeOf(value);
          if (prototype !== null && prototype !== Object.prototype) throw new Error();
          append('{');
          let first = true;
          for (const key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            if (--nodes < 0) throw new Error();
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !('value' in descriptor)) throw new Error();
            if (descriptor.value === undefined) continue;
            if (!first) append(',');
            first = false;
            string(key); append(':'); visit(descriptor.value, depth + 1);
          }
          append('}');
        }
      } finally {ancestors.delete(value);}
    }
    visit(payload, 0);
    return parts.join('');
  } catch {
    throw new TypeError('TrackHub: payload must be bounded, JSON-serializable data');
  }
}

export function assertJsonValue(value: unknown, label = "JSON value"): void {
  visitJsonValue(value, label, new WeakSet<object>());
}

function visitJsonValue(value: unknown, path: string, active: WeakSet<object>): void {
  if (value === null) return;

  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return;
  if (kind === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number that JSON cannot preserve.`);
    return;
  }
  if (kind === "undefined" || kind === "bigint" || kind === "function" || kind === "symbol") {
    throw new Error(`${path} contains unsupported JSON value type "${kind}".`);
  }
  if (kind !== "object") throw new Error(`${path} contains an unsupported JSON value.`);

  const object = value as object;
  if (active.has(object)) throw new Error(`${path} contains a cyclic reference.`);
  active.add(object);
  try {
    if (Array.isArray(value)) {
      validateJsonArray(value, path, active);
      return;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} must contain plain JSON objects, not class instances or special objects.`);
    }

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") throw new Error(`${path} contains a symbol-keyed property that JSON would discard.`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if (!descriptor.enumerable) throw new Error(`${propertyPath(path, key)} is non-enumerable and JSON would discard it.`);
      if (!("value" in descriptor)) throw new Error(`${propertyPath(path, key)} is an accessor property and is not durable JSON state.`);
      visitJsonValue(descriptor.value, propertyPath(path, key), active);
    }
  } finally {
    active.delete(object);
  }
}

function validateJsonArray(value: readonly unknown[], path: string, active: WeakSet<object>): void {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) throw new Error(`${path} is sparse at index ${index}; JSON would replace the hole with null.`);
    visitJsonValue(value[index], `${path}[${index}]`, active);
  }

  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key === "symbol") throw new Error(`${path} contains a symbol-keyed array property that JSON would discard.`);
    if (!isCanonicalArrayIndex(key, value.length)) throw new Error(`${propertyPath(path, key)} is an extra array property that JSON would discard.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(`${propertyPath(path, key)} is not a canonical JSON array element.`);
    }
  }
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function propertyPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

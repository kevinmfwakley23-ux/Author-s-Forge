declare global {
  interface ArrayConstructor {
    /** Preserve the element type when validating a value already typed as a readonly array. */
    isArray<T>(arg: readonly T[]): arg is T[];
  }
}

export {};

export function toPlainJsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([key, nestedValue]) => [
      String(key),
      toPlainJsonValue(nestedValue),
    ]);
    return Object.fromEntries(entries);
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlainJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        toPlainJsonValue(nestedValue),
      ]),
    );
  }

  return value;
}

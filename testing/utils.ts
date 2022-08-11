export const deepCopy = <T>(db: T): T => {
  return Object.keys(db).reduce((built, key) => {
    if (typeof built[key] === 'object') {
      built[key] = deepCopy<T>(built[key]);
    }
    return built;
  }, { ...db } as any);
}

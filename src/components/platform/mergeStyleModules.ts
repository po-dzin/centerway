export function mergeStyleModules(
  modules: Array<Record<string, string>>,
): Record<string, string> {
  const styles: Record<string, string> = {};

  for (const moduleStyles of modules) {
    for (const [key, value] of Object.entries(moduleStyles)) {
      styles[key] = styles[key] ? `${styles[key]} ${value}` : value;
    }
  }

  return styles;
}

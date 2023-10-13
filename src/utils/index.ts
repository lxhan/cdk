export function getEnvVarOrThrow(varName: string) {
  const envVar = process.env[varName];
  if (!envVar) {
    throw new Error(`${varName} is not set`);
  }
  return envVar;
}

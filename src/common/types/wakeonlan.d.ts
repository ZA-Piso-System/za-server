declare module "wakeonlan" {
  function wake(mac: string, options?: { address?: string }): Promise<void>;
  export default wake;
}

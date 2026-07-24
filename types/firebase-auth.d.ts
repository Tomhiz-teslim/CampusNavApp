import { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  function getReactNativePersistence(storage: unknown): Persistence;
  export { getReactNativePersistence };
}
declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MdxComponent: ComponentType<any>;
  export default MdxComponent;
}

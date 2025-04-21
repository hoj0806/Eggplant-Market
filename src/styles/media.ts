import { css, type CSSObject, type Interpolation } from "styled-components";

export type Breakpoints = "small" | "medium" | "large";

export const breakpoints: Record<Breakpoints, string> = {
  small: "@media (max-width: 375px)",
  medium: "@media (max-width: 768px)",
  large: "@media (max-width: 1280px)",
};

type MediaFunction = (
  first: TemplateStringsArray | CSSObject,
  ...interpolations: Interpolation<object>[]
) => ReturnType<typeof css>;

type Media = Record<Breakpoints, MediaFunction>;

const media = (Object.entries(breakpoints) as [Breakpoints, string][]).reduce(
  (acc, [key, value]) => {
    acc[key] = (
      first: TemplateStringsArray | CSSObject,
      ...interpolations: Interpolation<object>[]
    ) => css`
      ${value} {
        ${css(first, ...interpolations)}
      }
    `;
    return acc;
  },
  {} as Partial<Media>
) as Media;

export default media;

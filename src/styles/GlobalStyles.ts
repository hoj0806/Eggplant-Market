import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body, div, span, applet, object, iframe,
  h1, h2, h3, h4, h5, h6, p, blockquote, pre,
  a, abbr, acronym, address, big, cite, code,
  del, dfn, em, img, ins, kbd, q, s, samp,
  small, strike, strong, sub, sup, tt, var,
  b, u, i, center,
  dl, dt, dd, menu, ol, ul, li,
  fieldset, form, label, legend,
  table, caption, tbody, tfoot, thead, tr, th, td,
  article, aside, canvas, details, embed, 
  figure, figcaption, footer, header, hgroup, 
  main, menu, nav, output, ruby, section, summary,
  time, mark, audio, video {
    margin: 0;
    padding: 0;
    border: 0;
    font: inherit;
    vertical-align: baseline;
  }

  article, aside, details, figcaption, figure, 
  footer, header, hgroup, main, menu, nav, section {
    display: block;
  }

  body {
    line-height: 1.5;
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: var(--color-background);
    color: var(--color-text);
  }

  ol, ul {
    list-style: none;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  button {
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
  }

  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  input, textarea, select {
    font: inherit;
    outline: none;
    border: none;
  }


  :root {
    /* Light Theme */
    --color-primary: #6C5CE7;
    --color-secondary: #00B894;
    --color-accent: #FAB1A0;

    --color-background: #F9F9F9;
    --color-surface: #FFFFFF;
    --color-text: #2D3436;
    --color-muted: #636e72;

    /* Dark Theme (예시용 주석 처리) */
    /* 
    --color-background: #1E1E1E;
    --color-surface: #2C2C2C;
    --color-text: #F1F1F1;
    --color-muted: #B2BEC3;
    */
  }

  html {
    font-size: 62.5%;
  }
`;

export default GlobalStyles;

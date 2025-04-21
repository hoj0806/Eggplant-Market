import styled from "styled-components";
import media from "../styles/media";

const Form = styled.form`
  ${media.large`
  background-color : red;
`}

  ${media.medium`
    background-color: pink;
    padding: 1rem;
  `}

  ${media.small`
    background-color: yellow;
  `}
`;

export default Form;

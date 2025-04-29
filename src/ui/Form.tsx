import styled from "styled-components";
import media from "../styles/media";

const Form = styled.form`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  ${media.large`
    padding: 1.5rem;
  `}

  ${media.medium`
    padding: 1rem;
  `}

  ${media.small`
    padding: 0.8rem;
  `}
`;

export default Form;

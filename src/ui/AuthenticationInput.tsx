import styled from "styled-components";

const Input = styled.input`
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
  transition: border 0.3s ease;

  &:focus {
    border-color: #4d90fe;
    outline: none;
  }
`;

export default Input;

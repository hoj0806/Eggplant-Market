import { ReactNode } from "react";
import styled from "styled-components";

const StyledButton = styled.button`
  background-color: purple;
  color: #fff;
  padding: 0.7rem 1.2rem;
  border-radius: 1rem;
  font-size: 1.2rem;
  font-weight: bold;

  &:hover {
    background-color: #c75bc7;
  }
`;
const ProductControlButton: React.FC<{
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
}> = ({ children, onClick, disabled }) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled}>
      {children}
    </StyledButton>
  );
};

export default ProductControlButton;

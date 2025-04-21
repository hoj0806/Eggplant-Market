import styled from "styled-components";

const StyledFormRow = styled.div`
  background-color: yellow;
`;

const Label = styled.label`
  background-color: green;
`;
const FormRow: React.FC<{
  children: React.ReactNode;
  label?: string;
  htmlFor?: string;
}> = ({ children, label, htmlFor }) => {
  return (
    <StyledFormRow>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
    </StyledFormRow>
  );
};

export default FormRow;

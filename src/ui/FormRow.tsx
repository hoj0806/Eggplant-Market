import styled from "styled-components";

const StyledFormRow = styled.div`
  margin-bottom: 1.6rem;
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: bold;
  margin-bottom: 0.4rem;
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

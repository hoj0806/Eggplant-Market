// ui/ReservedStatusBadge.tsx
import { ReactNode } from "react";
import styled from "styled-components";

const Badge = styled.span`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 0.4rem 0.8rem;
  font-size: 1.2rem;
  font-weight: bold;
  border-radius: 0.6rem;
  z-index: 1;
  pointer-events: none;
`;

const StatusBadge: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  return <Badge>{children}</Badge>;
};

export default StatusBadge;

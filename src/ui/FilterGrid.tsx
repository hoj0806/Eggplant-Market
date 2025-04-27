import styled from "styled-components";
import CategotyFilter from "./CategoryFilter";

// 스타일 정의
const Grid = styled.div`
  padding-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 0.05rem solid #999;
`;

const GridTitle = styled.p`
  font-size: 1.8rem;
  font-weight: bold;
`;

// 타입 지정
interface FilterGridProps {
  title: string;
  children: ReactNode;
}

const FilterGrid: React.FC<FilterGridProps> = ({ title, children }) => {
  return (
    <Grid>
      <GridTitle>{title}</GridTitle>
      {children}
    </Grid>
  );
};

export default FilterGrid;

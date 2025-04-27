import styled from "styled-components";

const ImageContainer = styled.div`
  width: 60rem;
  height: 60rem;
  border-radius: 2rem;
  background-color: orange;
  overflow: hidden;
  display: flex;
`;

const ProductImage = styled.img.attrs<{ imageUrl: string }>((props) => ({
  src: props.imageUrl,
}))`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DetailImageContainer: React.FC<{
  images: string;
}> = ({ images }) => {
  const parsedImages = JSON.parse(images);
  return (
    <ImageContainer>
      <ProductImage imageUrl={parsedImages[0]} />
      <ProductImage imageUrl={parsedImages[0]} />
      <ProductImage imageUrl={parsedImages[0]} />
    </ImageContainer>
  );
};

export default DetailImageContainer;

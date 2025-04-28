import { useState } from "react";
import styled from "styled-components";

const SliderContainer = styled.div`
  width: 60rem;
  height: 60rem;
  overflow: hidden;
  border-radius: 0.5rem;
  position: relative;
`;

const ImageContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.5s ease-in-out;
`;

const Image = styled.img`
  width: 100%;
  object-fit: cover;
`;

const Button = styled.button<{ direction: "left" | "right" }>`
  position: absolute;
  top: 50%;
  ${({ direction }) => (direction === "left" ? `left: 10px;` : `right: 10px;`)}
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  padding: 1rem;
  cursor: pointer;
  font-size: 2rem;
  border-radius: 50%;
  visibility: ${(props) =>
    props.direction === "left" && props.showLeftButton === false
      ? "hidden"
      : props.direction === "right" && props.showRightButton === false
      ? "hidden"
      : "visible"};
`;

const DotsContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
`;

const Dot = styled.div<{ isActive: boolean }>`
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: ${(props) =>
    props.isActive ? "white" : "rgba(255, 255, 255, 0.5)"};
  cursor: pointer;
  transition: background-color 0.3s ease;
`;

interface ImageSliderProps {
  images: string[]; // Prop to accept image URLs
}

const ImageSlider: React.FC<ImageSliderProps> = ({ images }) => {
  const [imageNumber, setImageNumber] = useState(0);

  const handleNextButton = () => {
    if (imageNumber < images.length - 1) {
      setImageNumber((prev) => prev + 1);
    }
  };

  const handlePrevButton = () => {
    if (imageNumber > 0) {
      setImageNumber((prev) => prev - 1);
    }
  };

  const handleDotClick = (index: number) => {
    setImageNumber(index);
  };

  return (
    <SliderContainer>
      <ImageContainer
        style={{ transform: `translateX(-${imageNumber * 100}%)` }}
      >
        {images.map((src, index) => (
          <Image key={index} src={src} alt={`Image ${index + 1}`} />
        ))}
      </ImageContainer>
      <Button
        direction='left'
        onClick={handlePrevButton}
        showLeftButton={imageNumber > 0}
      >
        &lt;
      </Button>
      <Button
        direction='right'
        onClick={handleNextButton}
        showRightButton={imageNumber < images.length - 1}
      >
        &gt;
      </Button>
      <DotsContainer>
        {images.map((_, index) => (
          <Dot
            key={index}
            isActive={index === imageNumber}
            onClick={() => handleDotClick(index)}
          />
        ))}
      </DotsContainer>
    </SliderContainer>
  );
};

export default ImageSlider;

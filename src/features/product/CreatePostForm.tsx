import { useState } from "react";
import Input from "../../ui/AuthenticationInput";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import AddressInput from "./AddressInput";
import FileInput from "../../ui/FileInput";
import { useForm } from "react-hook-form";
import Button from "../../ui/Button";
import { useCreatePost } from "./useCreatePost";
import { useUser } from "../authentication/useUser";
import styled from "styled-components";

// 이미지 썸네일을 위한 스타일
const ThumbnailContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 10px;
`;

const Thumbnail = styled.img`
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 5px;
  position: relative;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CustomFileInputButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
`;

// Textarea 스타일
const StyledTextarea = styled.textarea`
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  resize: vertical;
  min-height: 100px;
  font-size: 14px;
`;

const CreatePostForm = () => {
  const { user } = useUser();
  const currentUserId = user?.id;
  const [address, setAddress] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]); // 이미지 파일 상태 (URL이 아닌 파일 객체로 변경)

  const { register, handleSubmit } = useForm();
  const { createProductPost } = useCreatePost();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setImageFiles((prevFiles) => [...prevFiles, ...fileArray]); // 새 이미지 추가
    }
  };

  // 이미지 삭제 함수
  const removeImage = (file: File) => {
    setImageFiles((prevFiles) => prevFiles.filter((image) => image !== file));
  };

  function onSubmit(data) {
    // 이미지가 없다면 빈 배열로 처리
    const imagesToSend = imageFiles.length > 0 ? imageFiles : undefined;

    createProductPost({
      ...data,
      category: "가전",
      image: imagesToSend, // 이미지가 없다면 undefined
      address,
      sellerNickname: user?.user_metadata.nickname,
      sellerId: currentUserId,
    });
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label='제목' htmlFor='postTitle'>
        <Input type='text' id='postTitle' {...register("postTitle")} />
      </FormRow>

      <FormRow label='내용' htmlFor='description'>
        {/* Textarea로 변경 */}
        <StyledTextarea id='description' {...register("description")} />
      </FormRow>

      <FormRow label='가격' htmlFor='price'>
        <Input type='number' id='price' {...register("price")} />
      </FormRow>

      <FormRow label='이미지'>
        {/* FileInput에서 기본 텍스트를 안보이게 하고, 버튼을 추가하여 파일을 선택하도록 유도 */}
        <input
          id='image'
          type='file'
          accept='image/*'
          multiple // 여러 파일을 한번에 선택할 수 있도록 설정
          onChange={handleImageChange}
          style={{ display: "none" }} // 기본 텍스트 숨기기
        />
        <CustomFileInputButton
          onClick={() => document.getElementById("image")?.click()}
        >
          이미지 선택
        </CustomFileInputButton>
        <ThumbnailContainer>
          {imageFiles.map((file, index) => {
            const imageUrl = URL.createObjectURL(file); // 이미지 URL 생성
            return (
              <div key={index} style={{ position: "relative" }}>
                <Thumbnail src={imageUrl} alt={`image-thumbnail-${index}`} />
                <RemoveButton onClick={() => removeImage(file)}>X</RemoveButton>
              </div>
            );
          })}
        </ThumbnailContainer>
      </FormRow>

      <AddressInput setAddress={setAddress} />

      <FormRow>
        <Button>글 올리기</Button>
      </FormRow>
    </Form>
  );
};

export default CreatePostForm;
